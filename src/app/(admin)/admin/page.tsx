import { adminClient } from "@/lib/supabase/admin";
import { Clock, Loader, TrendingUp, Users } from "lucide-react";
import OrderLedger from "@/components/admin/OrderLedger";
import type { OrderRow } from "@/components/admin/OrderLedger";
import type { Database } from "@/lib/supabase/types";

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
      <p className="text-3xl font-semibold text-slate-900 tracking-tight">{value}</p>
      <p className="text-xs text-slate-400 mt-2">{sub}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function AdminCommandCenterPage({ searchParams }: PageProps) {
  const { page: pageStr, search, status, dateFrom, dateTo } = await searchParams;
  const page = Math.max(1, parseInt(pageStr ?? "1", 10));

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
  let ordersQuery = adminClient
    .from("orders")
    .select(
      `id, reference_number, created_at, status, payment_method,
       subtotal, vat_amount, total_amount, order_notes,
       profiles ( business_name, account_number ),
       order_items ( sku, product_name, quantity, unit_price, line_total )`,
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (status) ordersQuery = ordersQuery.eq("status", status as OrderStatus);
  // dateFrom/dateTo are YYYY-MM-DD strings — filter on created_at (inclusive)
  if (dateFrom) ordersQuery = ordersQuery.gte("created_at", `${dateFrom}T00:00:00.000Z`);
  if (dateTo)   ordersQuery = ordersQuery.lte("created_at", `${dateTo}T23:59:59.999Z`);

  const { data: rawOrders, count: totalCount } = await ordersQuery;

  type RawProfile = { business_name: string; account_number: string | null };
  type RawItem = {
    sku: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    line_total: number;
  };

  const orders: OrderRow[] = (rawOrders ?? []).map((o) => {
    const profile = o.profiles as RawProfile | null;
    return {
      id: o.id,
      reference_number: o.reference_number,
      created_at: o.created_at,
      status: o.status,
      payment_method: o.payment_method,
      subtotal: Number(o.subtotal),
      vat_amount: Number(o.vat_amount),
      total_amount: Number(o.total_amount),
      business_name: profile?.business_name ?? "—",
      account_number: profile?.account_number ?? null,
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

  return (
    <div>
      {/* Page title */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
          Command Center
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Overview of your order pipeline and revenue metrics.
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
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

      {/* Action bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
        <form method="GET" className="flex flex-wrap items-center gap-4">
          {/* Search */}
          <input
            type="text"
            name="search"
            defaultValue={search ?? ""}
            placeholder="Reference or client…"
            className="h-9 w-52 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all"
          />

          {/* Status — only actionable states */}
          <select
            name="status"
            defaultValue={status ?? ""}
            className="h-9 px-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
          </select>

          {/* Date range */}
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs text-slate-400 font-medium">From</label>
            <input
              type="date"
              name="dateFrom"
              defaultValue={dateFrom ?? ""}
              className="h-9 px-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all"
            />
            <label className="text-xs text-slate-400 font-medium">To</label>
            <input
              type="date"
              name="dateTo"
              defaultValue={dateTo ?? ""}
              className="h-9 px-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all"
            />
          </div>

          <button
            type="submit"
            className="h-9 px-4 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors"
          >
            Apply
          </button>

          {(search || status || dateFrom || dateTo) && (
            <a
              href="/admin"
              className="h-9 px-4 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors flex items-center"
            >
              Clear
            </a>
          )}
        </form>
      </div>

      {/* Order ledger */}
      <OrderLedger
        orders={orders}
        totalCount={totalCount ?? 0}
        page={page}
        pageSize={PAGE_SIZE}
        search={search ?? ""}
        status={status ?? ""}
        dateFrom={dateFrom ?? ""}
        dateTo={dateTo ?? ""}
      />
    </div>
  );
}
