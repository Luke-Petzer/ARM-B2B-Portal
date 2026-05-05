import { adminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import type { Route } from "next";
import RefundRequestActions from "./RefundRequestActions";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Refund Requests | Admin",
};

function StatusBadge({ status }: { status: "pending" | "acknowledged" | "resolved" }) {
  const styles = {
    pending:      "bg-orange-50 text-orange-700 border border-orange-200",
    acknowledged: "bg-blue-50 text-blue-700 border border-blue-200",
    resolved:     "bg-emerald-50 text-emerald-700 border border-emerald-200",
  };
  const labels = {
    pending:      "Pending",
    acknowledged: "Acknowledged",
    resolved:     "Resolved",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

const REASON_LABELS: Record<string, string> = {
  defective_damaged: "Defective / damaged",
  incorrect_items:   "Incorrect items",
  not_as_described:  "Not as described",
  other:             "Other",
};

export default async function AdminRefundRequestsPage() {
  const session = await getSession();
  if (!session?.isAdmin) redirect("/admin/login" as Route);

  const { data: requests, error } = await adminClient
    .from("refund_requests")
    .select(
      `id, reference, reason, date_received, details, status, created_at,
       acknowledged_at, resolved_at, resolution_notes,
       order:orders!order_id ( reference_number ),
       buyer:profiles!profile_id ( business_name, contact_name, email )`
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[admin/refund-requests] fetch error:", error.message);
  }

  type RawOrder  = { reference_number: string } | null;
  type RawBuyer  = { business_name: string; contact_name: string; email: string | null } | null;
  type RawRequest = typeof requests extends (infer T)[] | null ? T : never;

  const rows = (requests ?? []).map((r: RawRequest) => ({
    id:            r.id,
    reference:     r.reference,
    reason:        r.reason,
    dateReceived:  r.date_received,
    details:       r.details,
    status:        r.status as "pending" | "acknowledged" | "resolved",
    createdAt:     r.created_at,
    acknowledgedAt: r.acknowledged_at,
    resolvedAt:    r.resolved_at,
    orderRef:      ((r as unknown as { order: RawOrder }).order)?.reference_number ?? "—",
    buyer:         (r as unknown as { buyer: RawBuyer }).buyer,
  }));

  const pendingCount = rows.filter((r) => r.status === "pending").length;

  return (
    <div>
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
            Refund Requests
          </h1>
          {pendingCount > 0 && (
            <span className="bg-orange-100 text-orange-700 text-xs font-semibold px-2.5 py-1 rounded-full">
              {pendingCount} pending
            </span>
          )}
        </div>
        <p className="text-sm text-slate-500 mt-1">
          Buyer return requests submitted via the portal. Acknowledge receipt, then resolve once reviewed.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 w-full max-w-full overflow-x-auto shadow-sm">
        <table className="w-full min-w-[900px] text-left">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50">
              <th className="px-6 py-4 text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                Reference
              </th>
              <th className="px-6 py-4 text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                Order
              </th>
              <th className="px-6 py-4 text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                Buyer
              </th>
              <th className="px-6 py-4 text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                Reason
              </th>
              <th className="px-6 py-4 text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                Submitted
              </th>
              <th className="px-6 py-4 text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-4 text-[11px] font-medium text-slate-400 uppercase tracking-wider text-right">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-16 text-center text-sm text-slate-400">
                  No refund requests yet.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const ts = new Date(row.createdAt);
                return (
                  <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                    {/* Reference */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-mono text-sm font-medium text-slate-900">
                        {row.reference}
                      </span>
                    </td>

                    {/* Order */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-slate-700 uppercase tracking-tight">
                        {row.orderRef}
                      </span>
                    </td>

                    {/* Buyer */}
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-slate-800 block">
                        {row.buyer?.business_name ?? "—"}
                      </span>
                      {row.buyer?.email && (
                        <span className="text-[11px] text-slate-400">
                          {row.buyer.email}
                        </span>
                      )}
                    </td>

                    {/* Reason */}
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-600">
                        {REASON_LABELS[row.reason] ?? row.reason}
                      </span>
                      {row.details && (
                        <span
                          className="block text-[11px] text-slate-400 max-w-[200px] truncate"
                          title={row.details}
                        >
                          {row.details}
                        </span>
                      )}
                    </td>

                    {/* Submitted date */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-slate-600">
                        {ts.toLocaleDateString("en-ZA", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                      <span className="block text-[11px] text-slate-400">
                        Goods received: {row.dateReceived}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4">
                      <StatusBadge status={row.status} />
                      {row.acknowledgedAt && (
                        <span className="block text-[10px] text-slate-400 mt-1">
                          Ack. {new Date(row.acknowledgedAt).toLocaleDateString("en-ZA", { day: "2-digit", month: "short" })}
                        </span>
                      )}
                      {row.resolvedAt && (
                        <span className="block text-[10px] text-slate-400 mt-1">
                          Res. {new Date(row.resolvedAt).toLocaleDateString("en-ZA", { day: "2-digit", month: "short" })}
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 text-right">
                      <RefundRequestActions
                        refundRequestId={row.id}
                        status={row.status}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
