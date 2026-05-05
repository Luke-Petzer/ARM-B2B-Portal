import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { adminClient } from "@/lib/supabase/admin";
import OrderHistoryTable from "@/components/portal/OrderHistoryTable";

export default async function OrdersPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const { data: orders, error } = await adminClient
    .from("orders")
    .select(
      `id, reference_number, created_at, subtotal, vat_amount, total_amount, status,
       order_items ( id, sku, product_name, unit_price, quantity, line_total ),
       refund_requests ( id, reference, status, created_at )`
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
  type RawRefundRequest = {
    id: string;
    reference: string;
    status: "pending" | "acknowledged" | "resolved";
    created_at: string;
  };
  type RawOrder = typeof orders extends (infer T)[] | null ? T : never;

  const rows = (orders ?? []).map((o: RawOrder) => {
    const refundRequests = ((o as unknown as { refund_requests: RawRefundRequest[] }).refund_requests) ?? [];
    // Show the most recent refund request status (requests ordered DESC by the main query)
    const latestRefund = refundRequests.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0] ?? null;

    return {
      id: o.id,
      reference_number: o.reference_number,
      created_at: o.created_at,
      subtotal: Number(o.subtotal),
      vat_amount: Number(o.vat_amount),
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
      refundStatus: latestRefund?.status ?? null,
      refundReference: latestRefund?.reference ?? null,
    };
  });

  return (
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
  );
}
