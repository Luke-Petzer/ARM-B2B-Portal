export const dynamic = "force-dynamic";

import { adminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { Clock, Download, Loader, TrendingUp, Users } from "lucide-react";
import OrderLedger from "@/components/admin/OrderLedger";
import type { OrderRow } from "@/components/admin/OrderLedger";
import AdminOrdersShell from "@/components/admin/AdminOrdersShell";
import type { Database } from "@/lib/supabase/types";
import type { Route } from "next";
import { checkCreditStatus } from "@/lib/credit/checkCreditStatus";
import type { CreditStatus } from "@/lib/credit/checkCreditStatus";

const PAGE_SIZE = 20;

const ZAR = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
  minimumFractionDigits: 2,
});

interface PageProps {
  searchParams: Promise<{
    page?: string;
    search?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
  }>;
}

type OrderStatus = Database["public"]["Tables"]["orders"]["Row"]["status"];

// ---------------------------------------------------------------------------
// KPI card
// ---------------------------------------------------------------------------

function KpiCard({
  label,
  value,
  sub,
  icon,
  iconBg,
  badge,
  badgeColor,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  iconBg: string;
  badge: string;
  badgeColor: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 hover:border-slate-300 transition-colors">
      <div className="flex items-center justify-between mb-4">
        <div className={`w-10 h-10 rounded-lg ${iconBg} flex items-center justify-center`}>
          {icon}
        </div>
        <span className={`text-xs font-medium px-2 py-1 rounded-md ${badgeColor}`}>
          {badge}
        </span>
      </div>
      <p className="text-sm font-medium text-slate-500 mb-1">{label}</p>
      <p className="text-2xl md:text-3xl font-semibold text-slate-900 tracking-tight">{value}</p>
      <p className="text-xs text-slate-400 mt-2">{sub}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function AdminCommandCenterPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session?.isAdmin) redirect("/admin/login" as Route);

  const { page: pageStr, search, status, dateFrom, dateTo } = await searchParams;
  const page = Math.max(1, parseInt(pageStr ?? "1", 10));

  const adminRole = session.adminRole ?? "employee";
  const currentAdminProfileId = session.profileId;

  // ── KPI queries (parallel) ──────────────────────────────────────────────
  const [pendingResult, processingResult, revenueResult, clientCountResult] =
    await Promise.all([
      adminClient
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      adminClient
        .from("orders")
        .select("id", { count: "exact", head: true })
        .in("status", ["confirmed", "processing"]),
      adminClient
        .from("orders")
        .select("total_amount")
        .eq("status", "fulfilled"),
      adminClient
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .in("role", ["buyer_default", "buyer_30_day"])
        .eq("is_active", true),
    ]);

  const pendingCount = pendingResult.count ?? 0;
  const processingCount = processingResult.count ?? 0;
  const totalRevenue = (revenueResult.data ?? []).reduce(
    (sum, o) => sum + Number(o.total_amount),
    0
  );
  const activeClients = clientCountResult.count ?? 0;

  // ── Order ledger query ──────────────────────────────────────────────────
  // Use FK disambiguation since orders has two FKs to profiles:
  //   profile_id  → buyer profile  (aliased as "buyer")
  //   assigned_to → admin profile  (aliased as "assignee")
  let ordersQuery = adminClient
    .from("orders")
    .select(
      `id, profile_id, reference_number, created_at, status, payment_method, payment_status, assigned_to,
       subtotal, vat_amount, total_amount, order_notes,
       buyer:profiles!profile_id ( business_name, account_number ),
       assignee:profiles!assigned_to ( email ),
       order_items ( sku, product_name, quantity, unit_price, line_total )`,
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (status) ordersQuery = ordersQuery.eq("status", status as OrderStatus);
  if (dateFrom) ordersQuery = ordersQuery.gte("created_at", `${dateFrom}T00:00:00.000Z`);
  if (dateTo)   ordersQuery = ordersQuery.lte("created_at", `${dateTo}T23:59:59.999Z`);
  if (search) {
    // 1. Escape to prevent ILIKE injection.
    //    Order matters: backslash must be escaped first so the subsequent
    //    wildcard replacements don't accidentally introduce new backslashes
    //    that would then escape the wrong character.
    const escaped = search
      .slice(0, 200)
      .replace(/\\/g, "\\\\")
      .replace(/%/g, "\\%")
      .replace(/_/g, "\\_");
    const pattern = `%${escaped}%`;

    // 2. Pre-query: find profile_ids where business_name or account_number matches
    const { data: matchedProfiles, error: profilesError } = await adminClient
      .from("profiles")
      .select("id")
      .or(`business_name.ilike.${pattern},account_number.ilike.${pattern}`)
      .limit(100);

    if (profilesError) {
      console.error("[admin/search] profiles pre-query failed:", profilesError.message);
    }

    const profileIds = (matchedProfiles ?? []).map((p) => p.id);

    // Cap at 100 profiles — beyond that, profile_id.in.(...) exceeds HTTP query-string
    // limits (~37 KB for 1000 UUIDs). Broad searches fall back to reference_number only
    // for the overflow. Acceptable for an admin panel with a bounded buyer list.
    // 3. Apply to orders: reference_number match OR buyer profile_id in matching set
    if (profileIds.length > 0) {
      ordersQuery = ordersQuery.or(
        `reference_number.ilike.${pattern},profile_id.in.(${profileIds.join(",")})`
      );
    } else {
      // No profile name/account matches — search only on reference_number
      ordersQuery = ordersQuery.ilike("reference_number", pattern);
    }
  }

  // RBAC filter — employees only see unassigned or their own orders
  if (adminRole === "employee" && !session.isSuperAdmin) {
    ordersQuery = ordersQuery.or(
      `assigned_to.is.null,assigned_to.eq.${currentAdminProfileId}`
    );
  }

  const { data: rawOrders, count: totalCount } = await ordersQuery;

  type RawBuyer = { business_name: string; account_number: string | null };
  type RawAssignee = { email: string } | null;
  type RawItem = {
    sku: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    line_total: number;
  };

  const orders: OrderRow[] = (rawOrders ?? []).map((o) => {
    const raw = o as any;
    const buyer = raw.buyer as RawBuyer | null;
    const assignee = raw.assignee as RawAssignee;
    return {
      id: o.id,
      profile_id: raw.profile_id as string,
      reference_number: o.reference_number,
      created_at: o.created_at,
      status: o.status,
      payment_method: o.payment_method,
      payment_status: (o as { payment_status?: string | null }).payment_status ?? null,
      assigned_to: (o as { assigned_to?: string | null }).assigned_to ?? null,
      assignee_email: assignee?.email ?? null,
      subtotal: Number(o.subtotal),
      vat_amount: Number(o.vat_amount),
      total_amount: Number(o.total_amount),
      business_name: buyer?.business_name ?? "—",
      account_number: buyer?.account_number ?? null,
      order_notes: o.order_notes ?? null,
      items: (o.order_items as RawItem[]).map((item) => ({
        sku: item.sku,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: Number(item.unit_price),
        line_total: Number(item.line_total),
      })),
    };
  });

  // ── Credit status checks for 30-day pending orders ─────────────────────
  // Collect unique profile IDs for 30-day accounts with pending orders
  const thirtyDayPendingProfileIds = [
    ...new Set(
      orders
        .filter(
          (o) => o.payment_method === "30_day_account" && o.status === "pending"
        )
        .map((o) => o.profile_id)
    ),
  ];

  // checkCreditStatus is feature-gated via CREDIT_CHECK_ENABLED in
  // src/lib/credit/checkCreditStatus.ts. When the flag is false (current
  // default), every call returns { blocked: false, outstanding: 0, ... } without
  // hitting the DB — so no credit warnings render in the admin command centre.
  // Re-enabling requires a documented business decision + addressing FINDING-101.
  const creditStatusEntries = await Promise.all(
    thirtyDayPendingProfileIds.map(async (profileId) => {
      const status = await checkCreditStatus(profileId);
      return [profileId, status] as [string, CreditStatus];
    })
  );

  const creditStatusByProfileId: Record<string, CreditStatus> =
    Object.fromEntries(creditStatusEntries);

  return (
    <div>
      {/* Page title */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
            Command Center
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Overview of your order pipeline and revenue metrics.
          </p>
        </div>

        {adminRole === "manager" && (
          <a
            href="/api/reports/daily"
            className="inline-flex items-center gap-2 h-9 px-4 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Download className="w-4 h-4" />
            Download Today&apos;s Report
          </a>
        )}
      </div>

      {/*
        ── SIMPLIFIED BRANCH: KPI STAT CARDS REMOVED ──────────────────────────
        Four summary cards were displayed here in a 2-col / 4-col responsive
        grid. To restore them, add back:

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <KpiCard
              label="Pending Orders"
              value={String(pendingCount)}
              sub="Awaiting EFT verification"
              icon={<Clock className="w-5 h-5 text-amber-600" />}
              iconBg="bg-amber-50"
              badge="EFT"
              badgeColor="text-amber-600 bg-amber-50"
            />
            <KpiCard
              label="In Progress"
              value={String(processingCount)}
              sub="Confirmed & processing"
              icon={<Loader className="w-5 h-5 text-sky-600" />}
              iconBg="bg-sky-50"
              badge="Active"
              badgeColor="text-sky-600 bg-sky-50"
            />
            <KpiCard
              label="Total Revenue"
              value={ZAR.format(totalRevenue)}
              sub="From fulfilled orders"
              icon={<TrendingUp className="w-5 h-5 text-emerald-600" />}
              iconBg="bg-emerald-50"
              badge="Fulfilled"
              badgeColor="text-emerald-600 bg-emerald-50"
            />
            <KpiCard
              label="Active Clients"
              value={String(activeClients)}
              sub="Registered buyer accounts"
              icon={<Users className="w-5 h-5 text-violet-600" />}
              iconBg="bg-violet-50"
              badge="Accounts"
              badgeColor="text-violet-600 bg-violet-50"
            />
          </div>

        All data queries (pendingCount, processingCount, totalRevenue,
        activeClients) and the KpiCard component are still in this file.
        ────────────────────────────────────────────────────────────────────── */}

      {/*
        AdminOrdersShell owns useTransition + router.push.
        It dims the ledger (opacity 70%) while the server streams new data,
        keeping the old table mounted so there's no flash of empty content.
      */}
      <AdminOrdersShell
        filterProps={{
          search: search ?? "",
          status: status ?? "",
          dateFrom: dateFrom ?? "",
          dateTo: dateTo ?? "",
        }}
      >
        <OrderLedger
          orders={orders}
          totalCount={totalCount ?? 0}
          page={page}
          pageSize={PAGE_SIZE}
          search={search ?? ""}
          status={status ?? ""}
          dateFrom={dateFrom ?? ""}
          dateTo={dateTo ?? ""}
          adminRole={adminRole}
          isSuperAdmin={session.isSuperAdmin}
          currentAdminProfileId={currentAdminProfileId}
          creditStatusByProfileId={creditStatusByProfileId}
        />
      </AdminOrdersShell>
    </div>
  );
}
