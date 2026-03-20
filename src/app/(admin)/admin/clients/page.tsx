import { adminClient } from "@/lib/supabase/admin";
import ClientsTable from "./ClientsTable";

const PAGE_SIZE = 20;

interface PageProps {
  searchParams: Promise<{ page?: string; search?: string }>;
}

export default async function AdminClientsPage({ searchParams }: PageProps) {
  const { page: pageStr, search } = await searchParams;
  const page = Math.max(1, parseInt(pageStr ?? "1", 10));

  let query = adminClient
    .from("profiles")
    .select("*", { count: "exact" })
    .in("role", ["buyer_default", "buyer_30_day"])
    .order("business_name", { ascending: true })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (search) {
    query = query.or(
      `business_name.ilike.%${search}%,account_number.ilike.%${search}%,contact_name.ilike.%${search}%`
    );
  }

  const { data: clients, count } = await query;

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
  }));

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
        totalCount={count ?? 0}
        page={page}
        pageSize={PAGE_SIZE}
        search={search ?? ""}
      />
    </div>
  );
}
