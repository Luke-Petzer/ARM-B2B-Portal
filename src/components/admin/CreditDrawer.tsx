"use client";

import { useState, useTransition, useCallback } from "react";
import { Loader2, Send } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import {
  updateClientAction,
  bulkMarkOrdersSettledAction,
  sendClientStatementAction,
} from "@/app/actions/admin";
import type { ClientForDrawer } from "@/components/admin/ClientDrawer";
import type { UnpaidOrder } from "@/app/(admin)/admin/clients/ClientsTable";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CreditDrawerProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  client: ClientForDrawer;
  unpaidOrders: UnpaidOrder[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
      {children}
    </label>
  );
}

function fmtCurrency(n: number) {
  return `R ${n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CreditDrawer({
  open,
  onClose,
  onSaved,
  client,
  unpaidOrders,
}: CreditDrawerProps) {
  const [isPending, startTransition] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);

  // Settle-orders state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSettling, startSettleTransition] = useTransition();
  const [settleError, setSettleError] = useState<string | null>(null);

  // Send statement state
  const [isSending, startSendTransition] = useTransition();
  const [sendResult, setSendResult] = useState<{ ok: boolean; message: string } | null>(null);

  const creditLimit = client.credit_limit ?? 0;
  const creditUsed = unpaidOrders.reduce((sum, o) => sum + o.total_amount, 0);
  const available = creditLimit - creditUsed;
  const pct = creditLimit > 0 ? Math.min(100, (creditUsed / creditLimit) * 100) : 0;
  const isCritical = pct >= 90;

  const allSelected = unpaidOrders.length > 0 && selectedIds.size === unpaidOrders.length;
  const someSelected = selectedIds.size > 0;

  const toggleOne = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      checked ? next.add(id) : next.delete(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(
    (checked: boolean) => {
      setSelectedIds(checked ? new Set(unpaidOrders.map((o) => o.id)) : new Set());
    },
    [unpaidOrders]
  );

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setSaveError(null);
      setSettleError(null);
      setSendResult(null);
      onClose();
    }
  };

  // Save credit limit changes
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaveError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await updateClientAction(formData);
      if (result && "error" in result) {
        setSaveError(result.error);
      } else {
        onSaved();
        onClose();
      }
    });
  };

  // Settle selected orders
  const handleSettle = () => {
    setSettleError(null);
    startSettleTransition(async () => {
      const result = await bulkMarkOrdersSettledAction(Array.from(selectedIds));
      if (result.error) {
        setSettleError(result.error);
      } else {
        setSelectedIds(new Set());
        onSaved();
      }
    });
  };

  // Send statement email
  const handleSendStatement = () => {
    setSendResult(null);
    startSendTransition(async () => {
      const result = await sendClientStatementAction(client.id);
      if (result?.error) {
        setSendResult({ ok: false, message: result.error });
      } else {
        setSendResult({ ok: true, message: "Statement sent successfully." });
      }
    });
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:w-[420px] p-0 flex flex-col gap-0"
      >
        <SheetHeader className="h-16 px-6 border-b border-slate-100 flex flex-row items-center justify-between space-y-0">
          <div>
            <SheetTitle className="text-lg font-semibold text-slate-900">
              Credit Account
            </SheetTitle>
            <p className="text-xs text-slate-400 mt-0.5">{client.business_name}</p>
          </div>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <input type="hidden" name="id" value={client.id} />
          {/* Pass through all existing profile fields unchanged */}
          <input type="hidden" name="account_number" value={client.account_number ?? ""} />
          <input type="hidden" name="business_name" value={client.business_name} />
          <input type="hidden" name="trading_name" value={client.trading_name ?? ""} />
          <input type="hidden" name="contact_name" value={client.contact_name} />
          <input type="hidden" name="email" value={client.email ?? ""} />
          <input type="hidden" name="phone" value={client.phone ?? ""} />
          <input type="hidden" name="role" value={client.role} />
          <input type="hidden" name="vat_number" value={client.vat_number ?? ""} />
          <input type="hidden" name="notes" value={client.notes ?? ""} />
          <input type="hidden" name="is_active" value={client.is_active ? "true" : "false"} />
          <input type="hidden" name="payment_terms_days" value={client.payment_terms_days ?? ""} />

          <div className="flex-1 overflow-y-auto p-6 space-y-6">

            {/* Credit limit fields */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FieldLabel>Credit Limit (R)</FieldLabel>
                  <input
                    type="number"
                    name="credit_limit"
                    defaultValue={client.credit_limit ?? ""}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all"
                  />
                </div>
                <div>
                  <FieldLabel>Available Credit (R)</FieldLabel>
                  <div className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-500 flex items-center select-none">
                    {fmtCurrency(Math.max(0, available))}
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-slate-400">
                Available credit is calculated automatically: Credit Limit − Current Outstanding Balance.
              </p>
            </div>

            {/* Utilization bar */}
            <div className="pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <FieldLabel>Credit Utilization</FieldLabel>
                <span className={`text-[11px] font-medium ${isCritical ? "text-red-600" : "text-slate-400"}`}>
                  {pct.toFixed(0)}%
                </span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${isCritical ? "bg-red-500" : "bg-primary"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-[11px] text-slate-500">
                  {fmtCurrency(creditUsed)} utilized
                </span>
                <span className="text-[11px] text-slate-500">
                  {fmtCurrency(Math.max(0, available))} available of {fmtCurrency(creditLimit)}
                </span>
              </div>
            </div>

            {/* Unpaid orders */}
            <div className="pt-2 border-t border-slate-100 space-y-3">
              {unpaidOrders.length === 0 ? (
                <>
                  <FieldLabel>Unpaid Orders</FieldLabel>
                  <p className="text-[12px] text-slate-400 py-2">No outstanding orders.</p>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <FieldLabel>Unpaid Orders</FieldLabel>
                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={(checked) => toggleAll(Boolean(checked))}
                        id="credit-drawer-select-all"
                      />
                      <span className="text-[11px] text-slate-500">Select all</span>
                    </label>
                  </div>

                  <div className="space-y-2">
                    {unpaidOrders.map((order) => (
                      <label
                        key={order.id}
                        htmlFor={`credit-order-${order.id}`}
                        className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors"
                      >
                        <Checkbox
                          id={`credit-order-${order.id}`}
                          checked={selectedIds.has(order.id)}
                          onCheckedChange={(checked) => toggleOne(order.id, Boolean(checked))}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-slate-900">
                            #{order.reference_number}
                          </p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {fmtDate(order.created_at)} · {fmtCurrency(order.total_amount)}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>

                  {settleError && (
                    <p className="text-xs text-red-600">{settleError}</p>
                  )}

                  <button
                    type="button"
                    disabled={!someSelected || isSettling}
                    onClick={handleSettle}
                    className="w-full h-9 px-4 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-40 disabled:pointer-events-none"
                  >
                    {isSettling ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Settling…
                      </>
                    ) : (
                      `Settle Selected${someSelected ? ` (${selectedIds.size})` : ""}`
                    )}
                  </button>
                </>
              )}
            </div>

            {/* Send Statement */}
            <div className="pt-2 border-t border-slate-100">
              <FieldLabel>Account Statement</FieldLabel>
              <p className="text-[11px] text-slate-400 mb-3">
                Sends a statement of all outstanding orders to{" "}
                <span className="font-medium text-slate-600">{client.email ?? "the client"}</span>.
              </p>

              {sendResult && (
                <p className={`text-xs mb-3 ${sendResult.ok ? "text-emerald-600" : "text-red-600"}`}>
                  {sendResult.message}
                </p>
              )}

              <button
                type="button"
                disabled={isSending || !client.email}
                onClick={handleSendStatement}
                className="w-full h-9 px-4 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-40 disabled:pointer-events-none"
              >
                {isSending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Sending…
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    Send Statement
                  </>
                )}
              </button>
              {!client.email && (
                <p className="text-[11px] text-amber-600 mt-1.5">No email address on file.</p>
              )}
            </div>

          </div>

          {/* Footer */}
          <div className="p-6 border-t border-slate-100 bg-white">
            {saveError && (
              <p className="text-xs text-red-600 mb-3">{saveError}</p>
            )}
            <div className="flex gap-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 h-10 px-4 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="flex-1 h-10 px-4 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-all shadow-sm disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-2"
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Save"
                )}
              </button>
            </div>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
