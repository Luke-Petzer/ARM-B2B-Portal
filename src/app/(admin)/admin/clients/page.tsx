import { adminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import type { Route } from "next";
import ClientsTable, { type UnpaidOrder } from "./ClientsTable";

export default async function AdminClientsPage() {
  const session = await getSession();
  if (!session?.isAdmin) redirect("/admin/login" as Route);

  const { data: clients } = await adminClient
    .from("profiles")
    .select("*")
    .in("role", ["buyer_default", "buyer_30_day"])
    .order("business_name", { ascending: true });

  const rows = (clients ?? []).map((c) => ({
    id: c.id,
    account_number: c.account_number,
    business_name: c.business_name,
    trading_name: c.trading_name,
    contact_name: c.contact_name,
    email: c.email,
    phone: c.phone,
    role: c.role as "buyer_default" | "buyer_30_day",
    vat_number: c.vat_number,
    credit_limit: c.credit_limit !== null ? Number(c.credit_limit) : null,
    available_credit: c.available_credit !== null ? Number(c.available_credit) : null,
    payment_terms_days: c.payment_terms_days,
    notes: c.notes,
    is_active: c.is_active,
    client_discount_pct: Number(c.client_discount_pct ?? 0),
  }));

  // Fetch unpaid orders for all 30-day clients
  const thirtyDayIds = rows
    .filter((r) => r.role === "buyer_30_day")
    .map((r) => r.id);

  let unpaidOrdersByClientId: Record<string, UnpaidOrder[]> = {};

  if (thirtyDayIds.length > 0) {
    const { data: unpaidOrders } = await adminClient
      .from("orders")
      .select("id, reference_number, created_at, total_amount, profile_id")
      .in("profile_id", thirtyDayIds)
      .in("payment_status", ["unpaid", "credit_approved"])
      .not("confirmed_at", "is", null)
      .neq("status", "cancelled")
      .order("created_at", { ascending: false });

    for (const o of unpaidOrders ?? []) {
      if (!unpaidOrdersByClientId[o.profile_id]) {
        unpaidOrdersByClientId[o.profile_id] = [];
      }
      unpaidOrdersByClientId[o.profile_id].push({
        id: o.id,
        reference_number: o.reference_number,
        created_at: o.created_at,
        total_amount: Number(o.total_amount),
      });
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
          Client Profiles
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage your B2B enterprise accounts and billing roles.
        </p>
      </div>

      <ClientsTable
        clients={rows}
        unpaidOrdersByClientId={unpaidOrdersByClientId}
      />
    </div>
  );
}
