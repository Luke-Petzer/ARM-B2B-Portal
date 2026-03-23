"use client";

import React, { useState, useEffect, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  ChevronDown,
  Download,
  CheckCircle,
  Loader2,
} from "lucide-react";
import { markProcessedAction, approveOrderAction, exportOrdersCsvAction } from "@/app/actions/admin";
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
// Expanded row
// ---------------------------------------------------------------------------

function ExpandedRow({
  order,
  onMarked,
  onApproved,
}: {
  order: OrderRow;
  onMarked: (id: string) => void;
  onApproved: (id: string) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [isApproving, startApprove] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isProcessed = order.status === "fulfilled";

  const handleMark = () => {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("orderId", order.id);
      const result = await markProcessedAction(fd);
      if (result?.error) {
        setError(result.error);
      } else {
        onMarked(order.id);
      }
    });
  };

  const handleApprove = () => {
    setError(null);
    startApprove(async () => {
      const fd = new FormData();
      fd.set("orderId", order.id);
      const result = await approveOrderAction(fd);
      if (result?.error) {
        setError(result.error);
      } else {
        onApproved(order.id);
      }
    });
  };

  return (
    <tr>
      <td colSpan={6} className="p-0">
        <div className="bg-slate-50 px-8 py-6 border-t border-slate-200">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-900 tracking-tight">
              Line Items — {order.reference_number}
            </h3>
            <span className="text-xs text-slate-400">
              {order.items.length} item{order.items.length !== 1 ? "s" : ""}
            </span>
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

          {/* Actions row */}
          <div className="flex items-center justify-between mt-4">
            <span className="text-xs text-slate-400">
              Created: {fmtDate(order.created_at)} ·{" "}
              <span className="capitalize">{order.payment_method.replace(/_/g, " ")}</span>
            </span>
            <div className="flex items-center gap-4">
              {error && (
                <span className="text-xs text-red-600">{error}</span>
              )}
              {/* Approve Order — visible for pending orders only */}
              {order.status === "pending" && (
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={isApproving}
                  className="h-9 px-4 bg-sky-600 text-white rounded-lg text-sm font-medium hover:bg-sky-700 transition-colors shadow-sm flex items-center gap-2 disabled:opacity-40 disabled:pointer-events-none"
                >
                  {isApproving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  Approve Order
                </button>
              )}
              <button
                type="button"
                onClick={handleMark}
                disabled={isProcessed || isPending}
                className="h-9 px-5 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors shadow-sm flex items-center gap-2 disabled:opacity-40 disabled:pointer-events-none"
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Updating…
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    {isProcessed ? "Marked Processed" : "Mark Processed in POS"}
                  </>
                )}
              </button>
            </div>
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

  // Supabase Realtime subscription — INSERT and UPDATE on orders table
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    const channel = supabase
      .channel("admin-orders-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        (payload) => {
          // The INSERT payload contains base columns but not joined data
          // (business_name, items). Prepend with available fields, then
          // router.refresh() so the server re-fetches full data.
          const row = payload.new as {
            id: string;
            reference_number: string;
            created_at: string;
            status: string;
            payment_method: string;
            subtotal: number;
            vat_amount: number;
            total_amount: number;
            order_notes: string | null;
          };
          const newOrder: OrderRow = {
            id: row.id,
            reference_number: row.reference_number,
            created_at: row.created_at,
            status: row.status,
            payment_method: row.payment_method,
            subtotal: Number(row.subtotal),
            vat_amount: Number(row.vat_amount),
            total_amount: Number(row.total_amount),
            business_name: "—",
            account_number: null,
            order_notes: row.order_notes,
            items: [],
          };
          setOrders((prev) => [newOrder, ...prev]);
          setLiveCount((prev) => prev + 1);
          // Refresh server component so full join data (client name, items) loads in
          router.refresh();
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders" },
        (payload) => {
          const updated = payload.new as { id: string; status: string };
          setOrders((prev) =>
            prev.map((o) =>
              o.id === updated.id ? { ...o, status: updated.status } : o
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  const totalPages = Math.ceil(liveCount / pageSize);

  const handleMarked = useCallback((orderId: string) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: "fulfilled" } : o))
    );
  }, []);

  const handleApproved = useCallback((orderId: string) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: "confirmed" } : o))
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
          className="h-9 px-5 bg-slate-900 text-white rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-slate-800 transition-colors shadow-sm disabled:opacity-40 disabled:pointer-events-none"
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
                      onMarked={handleMarked}
                      onApproved={handleApproved}
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
                    ? "bg-slate-900 text-white"
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
                    ? "bg-slate-900 text-white"
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
