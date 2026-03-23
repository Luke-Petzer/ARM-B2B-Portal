import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { adminClient } from "@/lib/supabase/admin";
import NavBar from "@/components/portal/NavBar";
import OrderHistoryTable from "@/components/portal/OrderHistoryTable";

export default async function OrdersPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const { data: orders, error } = await adminClient
    .from("orders")
    .select(
      `id, reference_number, created_at, total_amount, status,
       order_items ( id, sku, product_name, unit_price, quantity, line_total )`
    )
    .eq("profile_id", session.profileId)
    .order("created_at", { ascending: false });

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

  return (
    <>
      <NavBar />

      <div className="flex-1 overflow-y-auto bg-[#fcfcfc]">
        <main className="max-w-[1200px] w-full mx-auto px-4 md:px-8 pt-12 pb-24">
          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-slate-900">
              Order History
            </h1>
          </div>

          <OrderHistoryTable orders={rows} />
        </main>
      </div>
    </>
  );
}
