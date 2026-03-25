import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { adminClient } from "@/lib/supabase/admin";
import NavBar from "@/components/portal/NavBar";

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

function PaymentStatusBadge({ status }: { status: string }) {
  const isCreditApproved = status === "credit_approved";
  return (
    <span
      className={[
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
        isCreditApproved
          ? "bg-blue-50 text-blue-700 border border-blue-200"
          : "bg-amber-50 text-amber-700 border border-amber-200",
      ].join(" ")}
    >
      {isCreditApproved ? "On Credit" : "Awaiting Payment"}
    </span>
  );
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
         order_items ( id )`
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

  type RawOrder = NonNullable<typeof ordersResult.data>[number];

  const orders = (ordersResult.data ?? []).map((o: RawOrder) => ({
    id: o.id,
    reference_number: o.reference_number,
    confirmed_at: o.confirmed_at,
    total_amount: Number(o.total_amount),
    payment_status: o.payment_status,
    item_count: Array.isArray(o.order_items) ? o.order_items.length : 0,
  }));

  const totalOutstanding = orders.reduce((sum, o) => sum + o.total_amount, 0);

  return (
    <>
      <NavBar role={session.role} />

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
              {/* Orders list */}
              <div className="flex flex-col gap-3">
                {orders.map((order) => (
                  <div
                    key={order.id}
                    className="bg-white border border-gray-100 rounded-xl px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-sm"
                  >
                    {/* Left: ref + date + items */}
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-semibold text-slate-900">
                        #{order.reference_number}
                      </span>
                      <span className="text-xs text-slate-500">
                        {formatDate(order.confirmed_at)} &middot;{" "}
                        {order.item_count}{" "}
                        {order.item_count === 1 ? "item" : "items"}
                      </span>
                    </div>

                    {/* Right: status + amount */}
                    <div className="flex items-center gap-4 sm:gap-6">
                      <PaymentStatusBadge status={order.payment_status} />
                      <span className="text-sm font-semibold text-slate-900 tabular-nums">
                        {formatZAR(order.total_amount)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer: total outstanding */}
              <div className="mt-6 flex justify-end">
                <div className="bg-slate-900 text-white rounded-xl px-6 py-4 flex items-center gap-8">
                  <span className="text-sm font-medium opacity-80">
                    Total Outstanding
                  </span>
                  <span className="text-lg font-bold tabular-nums">
                    {formatZAR(totalOutstanding)}
                  </span>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </>
  );
}
