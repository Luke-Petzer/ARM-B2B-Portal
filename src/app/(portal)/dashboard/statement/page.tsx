import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { adminClient } from "@/lib/supabase/admin";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatZAR(amount: number): string {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default async function StatementPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "buyer_30_day") redirect("/dashboard");

  // Fetch profile for header info and orders in parallel
  const [profileResult, ordersResult] = await Promise.all([
    adminClient
      .from("profiles")
      .select("business_name, trading_name, account_number")
      .eq("id", session.profileId)
      .single(),
    adminClient
      .from("orders")
      .select(
        `id, reference_number, confirmed_at, total_amount, payment_status,
         order_items ( id, sku, product_name, quantity, line_total )`
      )
      .eq("profile_id", session.profileId)
      .in("payment_status", ["unpaid", "credit_approved"])
      .order("confirmed_at", { ascending: true }),
  ]);

  if (profileResult.error) {
    console.error("[statement] profile fetch error:", profileResult.error.message);
  }
  if (ordersResult.error) {
    console.error("[statement] orders fetch error:", ordersResult.error.message);
  }

  const profile = profileResult.data;
  const displayName =
    profile?.trading_name ?? profile?.business_name ?? "Your Account";

  type RawItem = {
    id: string;
    sku: string;
    product_name: string;
    quantity: number;
    line_total: number;
  };

  const orders = (ordersResult.data ?? []).map((o) => ({
    id: o.id,
    reference_number: o.reference_number,
    confirmed_at: o.confirmed_at,
    total_amount: Number(o.total_amount),
    payment_status: o.payment_status,
    items: ((o.order_items ?? []) as RawItem[]).map((item) => ({
      id: item.id,
      sku: item.sku,
      product_name: item.product_name,
      quantity: item.quantity,
      line_total: Number(item.line_total),
    })),
  }));

  const totalOutstanding = orders.reduce((sum, o) => sum + o.total_amount, 0);

  return (
    <div className="flex-1 overflow-y-auto bg-[#fcfcfc]">
        <main className="max-w-[1200px] w-full mx-auto px-4 md:px-8 pt-12 pb-24">
          {/* Page header */}
          <div className="mb-2">
            <h1 className="text-2xl font-semibold text-slate-900">
              Account Statement
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {displayName}
              {profile?.account_number ? (
                <> &middot; Account #{profile.account_number}</>
              ) : null}
            </p>
          </div>

          {/* Sub-heading */}
          <p className="text-sm text-slate-600 mb-8">
            Outstanding orders awaiting payment or currently on credit.
          </p>

          {/* Empty state */}
          {orders.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-white px-8 py-16 text-center">
              <p className="text-sm font-medium text-slate-500">
                You have no outstanding orders.
              </p>
            </div>
          ) : (
            <>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-[140px]">Order Ref</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-[110px]">Date</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Items</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-[120px]">Order Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order, idx) => (
                      <tr
                        key={order.id}
                        className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"}
                      >
                        <td className="px-4 py-4 align-top">
                          <span className="font-mono text-xs font-semibold text-slate-700">
                            {order.reference_number}
                          </span>
                        </td>
                        <td className="px-4 py-4 align-top text-xs text-slate-500 whitespace-nowrap">
                          {formatDate(order.confirmed_at)}
                        </td>
                        <td className="px-4 py-4 align-top">
                          <ul className="space-y-1">
                            {order.items.map((item) => (
                              <li key={item.id} className="flex items-baseline gap-2 text-xs">
                                <span className="font-mono text-slate-400 w-[64px] shrink-0">{item.sku}</span>
                                <span className="text-slate-700 flex-1">{item.product_name}</span>
                                <span className="text-slate-500 shrink-0">×{item.quantity}</span>
                                <span className="font-mono text-slate-600 shrink-0 w-[80px] text-right">{formatZAR(item.line_total)}</span>
                              </li>
                            ))}
                          </ul>
                        </td>
                        <td className="px-4 py-4 align-top text-right font-mono text-sm font-semibold text-slate-900">
                          {formatZAR(order.total_amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-900 bg-white">
                      <td colSpan={3} className="px-4 py-4 text-sm font-semibold text-slate-700">
                        Total Outstanding
                      </td>
                      <td className="px-4 py-4 text-right font-mono text-base font-bold text-slate-900">
                        {formatZAR(totalOutstanding)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}
        </main>
      </div>
  );
}
