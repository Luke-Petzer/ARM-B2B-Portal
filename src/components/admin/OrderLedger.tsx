"use client";

import React, { useState, useEffect, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  ChevronDown,
  Download,
  CheckCircle,
  Loader2,
  AlertTriangle,
  Send,
} from "lucide-react";
import { approveOrderAction, assignOrderAction, cancelOrderAction, exportOrdersCsvAction, sendClientStatementAction } from "@/app/actions/admin";
import type { CreditStatus } from "@/lib/credit/checkCreditStatus";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OrderRow {
  id: string;
  reference_number: string;
  created_at: string;
  status: string;
  payment_method: string;
  payment_status: string | null;
  assigned_to: string | null;
  assignee_email: string | null;
  profile_id: string;
  subtotal: number;
  vat_amount: number;
  total_amount: number;
  business_name: string;
  account_number: string | null;
  order_notes: string | null;
  items: {
    sku: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    line_total: number;
  }[];
}

interface OrderLedgerProps {
  orders: OrderRow[];
  totalCount: number;
  page: number;
  pageSize: number;
  /** Filter state — passed back through URL in parent */
  search: string;
  status: string;
  dateFrom: string;
  dateTo: string;
  adminRole: "manager" | "employee";
  isSuperAdmin?: boolean;
  currentAdminProfileId: string;
  /** Map of profile_id → CreditStatus for 30-day clients with pending orders */
  creditStatusByProfileId: Record<string, CreditStatus>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ZAR = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
  minimumFractionDigits: 2,
});

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending:
      "bg-amber-50 text-amber-700 border border-amber-200",
    confirmed:
      "bg-sky-50 text-sky-700 border border-sky-200",
    processing:
      "bg-blue-50 text-blue-700 border border-blue-200",
    fulfilled:
      "bg-emerald-50 text-emerald-700 border border-emerald-200",
    cancelled:
      "bg-red-50 text-red-600 border border-red-200",
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium capitalize ${
        map[status] ?? "bg-slate-100 text-slate-500 border border-slate-200"
      }`}
    >
      {status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// ApproveDialog — reusable confirmation wrapper for approve buttons
// ---------------------------------------------------------------------------

function ApproveDialog({
  label,
  description,
  confirmLabel = "Confirm Approval",
  onConfirm,
  isLoading,
  variant = "primary",
}: {
  label: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
  isLoading: boolean;
  variant?: "primary" | "secondary";
}) {
  const triggerClass =
    variant === "primary"
      ? "h-9 px-4 bg-sky-600 text-white rounded-lg text-sm font-medium hover:bg-sky-700 transition-colors shadow-sm flex items-center gap-2 disabled:opacity-40 disabled:pointer-events-none"
      : "h-9 px-4 bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors shadow-sm flex items-center gap-2 disabled:opacity-40 disabled:pointer-events-none";

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button type="button" disabled={isLoading} className={triggerClass}>
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <CheckCircle className="w-4 h-4" />
          )}
          {label}
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirm: {label}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-sky-600 hover:bg-sky-700 text-white"
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ---------------------------------------------------------------------------
// Expanded row
// ---------------------------------------------------------------------------

function ExpandedRow({
  order,
  currentAdminProfileId,
  creditStatus,
  isSuperAdmin,
  onApproved,
  onAssigned,
  onCancelled,
}: {
  order: OrderRow;
  currentAdminProfileId: string;
  creditStatus: CreditStatus | null;
  isSuperAdmin: boolean;
  onApproved: (id: string, update: { status?: string; payment_status: string }) => void;
  onAssigned: (id: string, assignedTo: string, email: string) => void;
  onCancelled: (id: string) => void;
}) {
  const [isApproving, startApprove] = useTransition();
  const [isAssigning, startAssign] = useTransition();
  const [isCancelling, startCancel] = useTransition();
  const [isSendingStatement, startSendStatement] = useTransition();
  const [statementResult, setStatementResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creditOverrideAcknowledged, setCreditOverrideAcknowledged] = useState(false);

  const handleApprove = (approvalType: "paid" | "credit_approved") => {
    setError(null);
    startApprove(async () => {
      const fd = new FormData();
      fd.set("orderId", order.id);
      fd.set("approvalType", approvalType);
      const result = await approveOrderAction(fd);
      if (result?.error) {
        setError(result.error);
      } else {
        const isFirstApproval = order.status === "pending";
        onApproved(order.id, {
          status: isFirstApproval ? "confirmed" : order.status,
          payment_status: approvalType,
        });
      }
    });
  };

  const handleCancel = () => {
    setError(null);
    startCancel(async () => {
      const fd = new FormData();
      fd.set("orderId", order.id);
      const result = await cancelOrderAction(fd);
      if (result?.error) {
        setError(result.error);
      } else {
        onCancelled(order.id);
      }
    });
  };

  const handleAssign = () => {
    setError(null);
    startAssign(async () => {
      const fd = new FormData();
      fd.set("orderId", order.id);
      const result = await assignOrderAction(fd);
      if (result?.error) {
        setError(result.error);
      } else {
        onAssigned(order.id, currentAdminProfileId, "you");
      }
    });
  };

  const handleSendStatement = () => {
    setStatementResult(null);
    startSendStatement(async () => {
      const result = await sendClientStatementAction(order.profile_id);
      if (result?.error) {
        setStatementResult({ ok: false, message: result.error });
      } else {
        setStatementResult({ ok: true, message: "Statement sent." });
      }
    });
  };

  const isOverdue = creditStatus?.reason === "overdue";

  // Prospective liability: existing outstanding + this order's total
  const prospectiveTotal = (creditStatus?.outstanding ?? 0) + order.total_amount;
  const willExceedLimit =
    creditStatus?.creditLimit != null &&
    creditStatus.creditLimit > 0 &&
    prospectiveTotal > creditStatus.creditLimit;

  // Hard block (all roles): overdue invoices from previous period
  // Soft block (employees only): credit limit would be exceeded
  const isHardBlocked = isOverdue;
  const approveOnCreditDisabled =
    isApproving ||
    isHardBlocked ||
    (willExceedLimit && (!isSuperAdmin || !creditOverrideAcknowledged));

  // Build the assignee display badge text
  const assigneeName = order.assigned_to
    ? order.assigned_to === currentAdminProfileId
      ? "You"
      : (order.assignee_email?.split("@")[0] ?? "Admin")
    : null;

  return (
    <tr>
      <td colSpan={6} className="p-0">
        <div className="bg-slate-50 px-8 py-6 border-t border-slate-200">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-900 tracking-tight">
              Line Items — {order.reference_number}
            </h3>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400">
                {order.items.length} item{order.items.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>

          {/* Inner table */}
          <div className="bg-white rounded-lg border border-slate-200 w-full max-w-full overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left text-[11px] font-medium text-slate-400 uppercase tracking-wider px-4 py-2.5">
                    Product
                  </th>
                  <th className="text-left text-[11px] font-medium text-slate-400 uppercase tracking-wider px-4 py-2.5">
                    SKU
                  </th>
                  <th className="text-right text-[11px] font-medium text-slate-400 uppercase tracking-wider px-4 py-2.5">
                    Qty
                  </th>
                  <th className="text-right text-[11px] font-medium text-slate-400 uppercase tracking-wider px-4 py-2.5">
                    Unit Price
                  </th>
                  <th className="text-right text-[11px] font-medium text-slate-400 uppercase tracking-wider px-4 py-2.5">
                    Subtotal
                  </th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item, i) => (
                  <tr
                    key={i}
                    className={i < order.items.length - 1 ? "border-b border-slate-50" : ""}
                  >
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {item.product_name}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400 font-mono">
                      {item.sku}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 text-right">
                      {item.quantity}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 text-right">
                      {ZAR.format(Number(item.unit_price))}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900 font-medium text-right">
                      {ZAR.format(Number(item.line_total))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Order Notes */}
          {order.order_notes && (
            <div className="mt-4 bg-amber-50 border border-amber-100 rounded-lg p-4">
              <p className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider mb-1">
                Order Notes & Special Requests
              </p>
              <p className="text-sm text-slate-700">{order.order_notes}</p>
            </div>
          )}

          {/* Credit banners — 30-day orders only */}
          {order.payment_method === "30_day_account" && isOverdue && (
            <div className="mt-4 flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
              <p className="text-xs text-red-700 font-medium">Overdue invoices from the previous statement period. Credit approval is disabled.</p>
            </div>
          )}
          {order.payment_method === "30_day_account" && !isOverdue && willExceedLimit && creditStatus?.creditLimit != null && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 space-y-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-red-700 uppercase tracking-wider mb-1">⚠ Credit Limit Violation</p>
                  <p className="text-xs text-red-700">
                    Approving this order would bring total liability to{" "}
                    <span className="font-semibold">{ZAR.format(prospectiveTotal)}</span>
                    {" "}— exceeding the approved credit limit of{" "}
                    <span className="font-semibold">{ZAR.format(creditStatus.creditLimit)}</span>.
                  </p>
                  {!isSuperAdmin && (
                    <p className="text-xs text-red-600 mt-1 font-medium">Approval blocked. Only a Super Admin can override.</p>
                  )}
                </div>
              </div>
              {isSuperAdmin && (
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={creditOverrideAcknowledged}
                    onChange={(e) => setCreditOverrideAcknowledged(e.target.checked)}
                    className="mt-0.5 h-3.5 w-3.5 rounded border-red-400 text-red-600 focus:ring-red-500"
                  />
                  <span className="text-xs text-red-700">
                    I acknowledge this order will exceed the client&apos;s credit limit and authorise approval.
                  </span>
                </label>
              )}
            </div>
          )}

          {/* Actions row */}
          <div className="flex items-center mt-4">
            <span className="text-xs text-slate-400">
              Created: {fmtDate(order.created_at)} ·{" "}
              <span className="capitalize">{order.payment_method.replace(/_/g, " ")}</span>
            </span>
          </div>
        </div>
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function OrderLedger({
  orders: initialOrders,
  totalCount,
  page,
  pageSize,
  search,
  status,
  dateFrom,
  dateTo,
  adminRole,
  isSuperAdmin = false,
  currentAdminProfileId,
  creditStatusByProfileId,
}: OrderLedgerProps) {
  const router = useRouter();
  const [orders, setOrders] = useState<OrderRow[]>(initialOrders);
  const [liveCount, setLiveCount] = useState<number>(totalCount);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isExporting, startExport] = useTransition();

  // Sync state when the server re-renders (e.g. after router.refresh())
  useEffect(() => {
    setOrders(initialOrders);
    setLiveCount(totalCount);
  }, [initialOrders, totalCount]);

  // Supabase Realtime — Broadcast channel.
  // The checkoutAction sends a broadcast ping via REST after each order insert.
  // This approach avoids postgres_changes RLS evaluation entirely — no policies,
  // no WAL publication concerns, no auth token injection needed.
  // On broadcast: router.refresh() re-runs the server component so the full order
  // (with profile join and items) flows back in via the initialOrders sync above.
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    const channel = supabase
      .channel("admin-orders")
      .on("broadcast", { event: "new_order" }, () => {
        router.refresh();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  const totalPages = Math.ceil(liveCount / pageSize);

  const handleApproved = useCallback(
    (orderId: string, update: { status?: string; payment_status: string }) => {
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, ...update } : o))
      );
    },
    []
  );

  const handleCancelled = useCallback((orderId: string) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: "cancelled" } : o))
    );
  }, []);

  const handleAssigned = useCallback((orderId: string, assignedTo: string, _email: string) => {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? { ...o, assigned_to: assignedTo, assignee_email: "you" }
          : o
      )
    );
  }, []);

  const handleExportCsv = () => {
    startExport(async () => {
      const fd = new FormData();
      if (status) fd.set("status", status);
      if (search) fd.set("search", search);
      const result = await exportOrdersCsvAction(fd);
      if ("error" in result) {
        console.error("[csv]", result.error);
        return;
      }
      // Trigger browser download
      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `orders-export-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  const buildPageUrl = (p: number) => {
    const params = new URLSearchParams();
    params.set("page", String(p));
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    return `?${params.toString()}`;
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 w-full max-w-full overflow-x-auto">
      {/* Table header */}
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900 tracking-tight">
            Order Ledger
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {liveCount} order{liveCount !== 1 ? "s" : ""} total
          </p>
        </div>
        <button
          type="button"
          onClick={handleExportCsv}
          disabled={isExporting}
          className="h-9 px-5 bg-primary text-primary-foreground rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-40 disabled:pointer-events-none"
        >
          {isExporting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Exporting…
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              Download CSV
            </>
          )}
        </button>
      </div>

      <table className="w-full min-w-[900px]">
        <thead>
          <tr className="border-b border-slate-100">
            <th className="w-10 px-6 py-3" />
            <th className="text-left text-[11px] font-medium text-slate-400 uppercase tracking-wider px-6 py-3">
              Order Date
            </th>
            <th className="text-left text-[11px] font-medium text-slate-400 uppercase tracking-wider px-6 py-3">
              Ref Number
            </th>
            <th className="text-left text-[11px] font-medium text-slate-400 uppercase tracking-wider px-6 py-3">
              Client
            </th>
            <th className="text-right text-[11px] font-medium text-slate-400 uppercase tracking-wider px-6 py-3">
              Total Value
            </th>
            <th className="text-center text-[11px] font-medium text-slate-400 uppercase tracking-wider px-6 py-3">
              POS Status
            </th>
          </tr>
        </thead>
        <tbody>
          {orders.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-6 py-16 text-center text-sm text-slate-400">
                No orders found.
              </td>
            </tr>
          ) : (
            orders.map((order) => {
              const isExpanded = expandedId === order.id;
              return (
                <React.Fragment key={order.id}>
                  <tr
                    onClick={() =>
                      setExpandedId(isExpanded ? null : order.id)
                    }
                    className={`border-b border-slate-50 cursor-pointer transition-colors ${
                      isExpanded ? "bg-slate-50/80" : "hover:bg-slate-50/50"
                    }`}
                  >
                    <td className="px-6 py-4">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-slate-900" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-300" />
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {fmtDate(order.created_at)}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-900 font-mono font-medium">
                      {order.reference_number}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700">
                      {order.business_name}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-900 font-medium text-right">
                      {ZAR.format(Number(order.total_amount))}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <StatusBadge status={order.status} />
                    </td>
                  </tr>
                  {isExpanded && (
                    <ExpandedRow
                      order={order}
                      currentAdminProfileId={currentAdminProfileId}
                      creditStatus={creditStatusByProfileId[order.profile_id] ?? null}
                      isSuperAdmin={isSuperAdmin}
                      onApproved={handleApproved}
                      onAssigned={handleAssigned}
                      onCancelled={handleCancelled}
                    />
                  )}
                </React.Fragment>
              );
            })
          )}
        </tbody>
      </table>

      {/* Pagination */}
      <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
        <p className="text-xs text-slate-400">
          Showing {Math.min((page - 1) * pageSize + 1, liveCount)}–
          {Math.min(page * pageSize, liveCount)} of {liveCount} orders
        </p>
        <div className="flex items-center gap-1">
          {page > 1 && (
            <a
              href={buildPageUrl(page - 1)}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 transition-colors"
            >
              <ChevronRight className="w-4 h-4 rotate-180" />
            </a>
          )}
          {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
            const p = i + 1;
            return (
              <a
                key={p}
                href={buildPageUrl(p)}
                className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-medium transition-colors ${
                  p === page
                    ? "bg-primary text-primary-foreground"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {p}
              </a>
            );
          })}
          {totalPages > 5 && (
            <>
              <span className="w-8 h-8 flex items-center justify-center text-slate-400 text-xs">
                …
              </span>
              <a
                href={buildPageUrl(totalPages)}
                className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-medium transition-colors ${
                  totalPages === page
                    ? "bg-primary text-primary-foreground"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {totalPages}
              </a>
            </>
          )}
          {page < totalPages && (
            <a
              href={buildPageUrl(page + 1)}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
