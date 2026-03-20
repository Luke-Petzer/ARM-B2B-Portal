import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { adminClient } from "@/lib/supabase/admin";
import NavBar from "@/components/portal/NavBar";
import OrderHistoryTable from "@/components/portal/OrderHistoryTable";
import { Filter, Download } from "lucide-react";

const PAGE_SIZE = 10;

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function OrdersPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10));
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data: orders, error, count } = await adminClient
    .from("orders")
    .select(
      `id, reference_number, created_at, total_amount, status,
       order_items ( id, sku, product_name, unit_price, quantity, line_total )`,
      { count: "exact" }
    )
    .eq("profile_id", session.profileId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    console.error("[orders] fetch error:", error.message);
  }

  type RawItem = {
    id: string;
    sku: string;
    product_name: string;
    unit_price: number;
    quantity: number;
    line_total: number;
  };
  type RawOrder = typeof orders extends (infer T)[] | null ? T : never;

  const rows = (orders ?? []).map((o: RawOrder) => ({
    id: o.id,
    reference_number: o.reference_number,
    created_at: o.created_at,
    total_amount: Number(o.total_amount),
    status: o.status,
    item_count: ((o.order_items as RawItem[]) ?? []).length,
    items: ((o.order_items as RawItem[]) ?? []).map((i) => ({
      id: i.id,
      sku: i.sku,
      product_name: i.product_name,
      unit_price: Number(i.unit_price),
      quantity: i.quantity,
      line_total: Number(i.line_total),
    })),
  }));

  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE);

  return (
    <>
      <NavBar />

      <div className="flex-1 overflow-y-auto bg-[#fcfcfc]">
      <main className="max-w-[1200px] w-full mx-auto px-4 md:px-8 pt-12 pb-24">
        {/* Page header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-semibold text-slate-900">
            Order History
          </h1>
          <div className="grid grid-cols-2 gap-2 md:flex md:w-auto md:items-center md:gap-4">
            <button className="flex justify-center items-center gap-2 text-xs font-medium px-4 py-2 bg-white border border-gray-200 rounded hover:bg-gray-50 transition-colors text-gray-600">
              <Filter className="w-4 h-4" />
              Filter
            </button>
            <button className="flex justify-center items-center gap-2 text-xs font-medium px-4 py-2 bg-white border border-gray-200 rounded hover:bg-gray-50 transition-colors text-gray-600">
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>

        <OrderHistoryTable orders={rows} />

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between">
            <p className="text-[13px] text-gray-400">
              Showing {from + 1}–{Math.min(to + 1, count ?? 0)} of{" "}
              {count ?? 0} orders
            </p>
            <div className="flex items-center gap-2">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                <a
                  key={n}
                  href={`/orders?page=${n}`}
                  className={[
                    "w-8 h-8 rounded flex items-center justify-center text-[13px] font-medium transition-colors",
                    n === page
                      ? "bg-slate-900 text-white"
                      : "bg-white border border-gray-100 text-gray-600 hover:bg-gray-50",
                  ].join(" ")}
                >
                  {n}
                </a>
              ))}
            </div>
          </div>
        )}
      </main>
      </div>
    </>
  );
}
