"use client";

import { useState, useTransition } from "react";
import { ChevronDown, ChevronRight, Loader2, Search } from "lucide-react";
import { reorderAction } from "@/app/actions/order";

function getBuyerDisplay(status: string): { label: string; className: string } {
  if (status === "cancelled") {
    return { label: "Cancelled", className: "bg-red-50 text-red-600 border border-red-200" };
  }
  if (status === "fulfilled") {
    return { label: "Dispatched", className: "bg-emerald-50 text-emerald-700 border border-emerald-200" };
  }
  return { label: "Processing", className: "bg-blue-50 text-blue-700 border border-blue-200" };
}

function StatusBadge({ status }: { status: string }) {
  const { label, className } = getBuyerDisplay(status);
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${className}`}
    >
      {label}
    </span>
  );
}

const ZAR = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
  minimumFractionDigits: 2,
});

interface OrderItem {
  id: string;
  sku: string;
  product_name: string;
  unit_price: number;
  quantity: number;
  line_total: number;
}

interface OrderRow {
  id: string;
  reference_number: string;
  created_at: string;
  total_amount: number;
  status: string;
  item_count: number;
  items: OrderItem[];
}

interface OrderHistoryTableProps {
  orders: OrderRow[];
}

export default function OrderHistoryTable({ orders }: OrderHistoryTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const filteredOrders = searchTerm.trim()
    ? orders.filter((o) => {
        const q = searchTerm.toLowerCase();
        return (
          o.reference_number.toLowerCase().includes(q) ||
          getBuyerDisplay(o.status).label.toLowerCase().includes(q) ||
          o.items.some(
            (i) =>
              i.sku.toLowerCase().includes(q) ||
              i.product_name.toLowerCase().includes(q)
          )
        );
      })
    : orders;

  const handleReorder = (orderId: string) => {
    setPendingId(orderId);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("orderId", orderId);
      try {
        await reorderAction(fd);
      } finally {
        setPendingId(null);
      }
    });
  };

  const toggle = (id: string) =>
    setExpandedId((prev) => (prev === id ? null : id));

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-ZA", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

  if (orders.length === 0) {
    return (
      <p className="text-sm text-gray-400 text-center py-16">
        No orders yet. Place your first order from the catalogue.
      </p>
    );
  }

  return (
    <div>
      {/* Search */}
      <div className="relative mb-4 w-full md:w-80">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by reference, SKU, or status…"
          className="h-10 w-full pl-9 pr-3 bg-white border border-gray-200 rounded-lg text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all"
        />
      </div>

    <div className="bg-white border border-gray-100 rounded-lg overflow-hidden shadow-sm">
      {/* Table header — desktop only */}
      <div
        className="hidden md:grid items-center px-6 py-4 bg-gray-50/50 border-b border-gray-100"
        style={{ gridTemplateColumns: "140px 180px 1fr 140px 120px" }}
      >
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Date
        </span>
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Reference ID
        </span>
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Items
        </span>
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Total Cost
        </span>
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider text-right">
          Action
        </span>
      </div>

      {filteredOrders.length === 0 && (
        <div className="px-6 py-16 text-center text-sm text-gray-400">
          No orders found for &ldquo;{searchTerm}&rdquo;.
        </div>
      )}
      {filteredOrders.map((order) => {
        const isExpanded = expandedId === order.id;
        return (
          <div key={order.id} className="border-b border-gray-50 last:border-b-0">
            {/* Mobile card — hidden on md+ */}
            <div
              className="md:hidden px-4 py-4 flex flex-col gap-2 cursor-pointer"
              onClick={() => toggle(order.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  )}
                  <span className="text-sm font-semibold text-slate-900 uppercase tracking-tight">
                    {order.reference_number}
                  </span>
                </div>
                <StatusBadge status={order.status} />
              </div>
              <span className="text-sm text-gray-500 pl-6">
                {formatDate(order.created_at)}
              </span>
              <span className="text-sm text-gray-500 pl-6">
                {order.item_count} Unique{" "}
                {order.item_count === 1 ? "Item" : "Items"}
              </span>
              <div
                className="flex items-center justify-between pl-6"
                onClick={(e) => e.stopPropagation()}
              >
                <span className="text-sm font-semibold text-slate-900">
                  {ZAR.format(order.total_amount)}
                </span>
                <button
                  type="button"
                  onClick={() => handleReorder(order.id)}
                  disabled={pendingId === order.id}
                  className={[
                    "text-[12px] font-bold px-4 py-2 rounded transition-colors disabled:opacity-60 disabled:cursor-not-allowed",
                    isExpanded
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200",
                  ].join(" ")}
                >
                  {pendingId === order.id ? (
                    <><Loader2 className="w-3 h-3 animate-spin mr-1 inline" />Adding...</>
                  ) : (
                    "Reorder"
                  )}
                </button>
              </div>
            </div>

            {/* Desktop row — hidden below md */}
            <div
              className={[
                "hidden md:grid items-center px-6 py-5 cursor-pointer transition-colors",
                isExpanded ? "bg-slate-50" : "hover:bg-gray-50",
              ].join(" ")}
              style={{ gridTemplateColumns: "140px 180px 1fr 140px 120px" }}
              onClick={() => toggle(order.id)}
            >
              <span className="text-[14px] text-gray-500">
                {formatDate(order.created_at)}
              </span>
              <div className="flex items-center gap-2">
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                )}
                <span className="text-[14px] font-medium text-slate-900 uppercase tracking-tight">
                  {order.reference_number}
                </span>
              </div>
              <span className="text-[14px] text-gray-500">
                {order.item_count} Unique{" "}
                {order.item_count === 1 ? "Item" : "Items"}
              </span>
              <span className="text-[14px] font-medium text-slate-900">
                {ZAR.format(order.total_amount)}
              </span>
              <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => handleReorder(order.id)}
                  disabled={pendingId === order.id}
                  className={[
                    "text-[12px] font-bold px-4 py-2 rounded transition-colors disabled:opacity-60 disabled:cursor-not-allowed",
                    isExpanded
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200",
                  ].join(" ")}
                >
                  {pendingId === order.id ? (
                    <><Loader2 className="w-3 h-3 animate-spin mr-1 inline" />Adding...</>
                  ) : (
                    "Reorder"
                  )}
                </button>
              </div>
            </div>

            {/* Accordion — line items */}
            {isExpanded && (
              <div className="bg-gray-50 px-3 md:px-6 py-4 md:py-6">
                <div className="bg-white border border-gray-100 rounded shadow-sm divide-y divide-gray-50">
                  {/* Desktop column headers — hidden on mobile */}
                  <div className="hidden md:grid grid-cols-[1fr_2fr_1fr_80px_100px] px-4 py-2.5 bg-gray-50/30">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">SKU</span>
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Description</span>
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Unit Price</span>
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider text-right">Qty</span>
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider text-right">Subtotal</span>
                  </div>

                  {order.items.map((item) => (
                    <div key={item.id}>
                      {/* Mobile card */}
                      <div className="md:hidden px-4 py-4 flex flex-col gap-1">
                        <p className="text-sm font-semibold text-slate-900">{item.product_name}</p>
                        <p className="text-xs text-gray-400">{item.sku}</p>
                        <div className="flex justify-between items-center mt-1">
                          <span className="text-xs text-gray-500">Qty: {item.quantity}</span>
                          <span className="text-sm font-semibold text-slate-900">{ZAR.format(item.line_total)}</span>
                        </div>
                      </div>

                      {/* Desktop row */}
                      <div className="hidden md:grid grid-cols-[1fr_2fr_1fr_80px_100px] items-center px-4 py-4">
                        <span className="text-[13px] font-medium text-slate-900">{item.sku}</span>
                        <span className="text-[13px] text-gray-500">{item.product_name}</span>
                        <span className="text-[13px] text-gray-500">{ZAR.format(item.unit_price)}</span>
                        <span className="text-[13px] text-gray-900 font-medium text-right">{item.quantity}</span>
                        <span className="text-[13px] text-slate-900 font-medium text-right">{ZAR.format(item.line_total)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
    </div>
  );
}
