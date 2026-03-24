"use client";

import { useState, useTransition, useCallback } from "react";
import { Loader2, Info } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { createClientAction, updateClientAction, bulkMarkOrdersSettledAction } from "@/app/actions/admin";
import type { UnpaidOrder } from "@/app/(admin)/admin/clients/ClientsTable";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ClientForDrawer {
  id: string;
  account_number: string | null;
  business_name: string;
  trading_name: string | null;
  contact_name: string;
  email: string | null;
  phone: string | null;
  role: "buyer_default" | "buyer_30_day";
  vat_number: string | null;
  credit_limit: number | null;
  available_credit: number | null;
  payment_terms_days: number | null;
  notes: string | null;
  is_active: boolean;
}

interface ClientDrawerProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  client?: ClientForDrawer | null;
  unpaidOrders?: UnpaidOrder[];
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

function InputField({
  name,
  label,
  type = "text",
  defaultValue,
  placeholder,
  required,
}: {
  name: string;
  label: string;
  type?: string;
  defaultValue?: string | number | null;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <input
        type={type}
        name={name}
        required={required}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all"
      />
    </div>
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
// Credit Utilization section
// ---------------------------------------------------------------------------

function CreditSection({
  client,
  unpaidOrders,
  onSettled,
}: {
  client: ClientForDrawer;
  unpaidOrders: UnpaidOrder[];
  onSettled: () => void;
}) {
  const creditLimit = client.credit_limit ?? 0;
  const creditUsed = unpaidOrders.reduce((sum, o) => sum + o.total_amount, 0);
  const available = creditLimit - creditUsed;
  const pct = creditLimit > 0 ? Math.min(100, (creditUsed / creditLimit) * 100) : 0;
  const isCritical = pct >= 90;

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [settleError, setSettleError] = useState<string | null>(null);

  const allSelected =
    unpaidOrders.length > 0 && selectedIds.size === unpaidOrders.length;
  const someSelected = selectedIds.size > 0;

  const toggleOne = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      checked ? next.add(id) : next.delete(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback((checked: boolean) => {
    setSelectedIds(checked ? new Set(unpaidOrders.map((o) => o.id)) : new Set());
  }, [unpaidOrders]);

  const handleSettleSelected = () => {
    setSettleError(null);
    startTransition(async () => {
      const result = await bulkMarkOrdersSettledAction(Array.from(selectedIds));
      if (result.error) {
        setSettleError(result.error);
      } else {
        setSelectedIds(new Set());
        onSettled();
      }
    });
  };

  return (
    <div className="pt-2 border-t border-slate-100 space-y-4">
      {/* Progress bar */}
      <div>
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

      {/* Unpaid orders list */}
      <div>
        {unpaidOrders.length === 0 ? (
          <>
            <FieldLabel>Unpaid Orders</FieldLabel>
            <p className="text-[12px] text-slate-400 py-2">No outstanding orders.</p>
          </>
        ) : (
          <>
            {/* Header row: label + Select All */}
            <div className="flex items-center justify-between mb-2">
              <FieldLabel>Unpaid Orders</FieldLabel>
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={(checked) => toggleAll(Boolean(checked))}
                  id="select-all-orders"
                />
                <span className="text-[11px] text-slate-500">Select all</span>
              </label>
            </div>

            <div className="space-y-2">
              {unpaidOrders.map((order) => (
                <label
                  key={order.id}
                  htmlFor={`order-${order.id}`}
                  className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors"
                >
                  <Checkbox
                    id={`order-${order.id}`}
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
              <p className="text-xs text-red-600 mt-2">{settleError}</p>
            )}

            {/* Settle Selected button */}
            <button
              type="button"
              disabled={!someSelected || isPending}
              onClick={handleSettleSelected}
              className="mt-3 w-full h-9 px-4 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-40 disabled:pointer-events-none"
            >
              {isPending ? (
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
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ClientDrawer({
  open,
  onClose,
  onSaved,
  client,
  unpaidOrders = [],
}: ClientDrawerProps) {
  const isEdit = Boolean(client);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<"buyer_default" | "buyer_30_day">(
    client?.role ?? "buyer_default"
  );
  const is30Day = role === "buyer_30_day";

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setError(null);
      onClose();
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = isEdit
        ? await updateClientAction(formData)
        : await createClientAction(formData);

      if (result && "error" in result) {
        setError(result.error);
      } else {
        onSaved();
        onClose();
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
          <SheetTitle className="text-lg font-semibold text-slate-900">
            {isEdit ? "Edit Client" : "Register New Client"}
          </SheetTitle>
        </SheetHeader>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col flex-1 overflow-hidden"
        >
          {isEdit && (
            <input type="hidden" name="id" value={client!.id} />
          )}

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">

            {/* Account info */}
            <div className="space-y-4">
              <InputField
                name="account_number"
                label="Account Number"
                defaultValue={client?.account_number}
                placeholder="e.g. ACC-1234"
                required
              />
              <InputField
                name="business_name"
                label="Business Name"
                defaultValue={client?.business_name}
                placeholder="e.g. Acme Corp Ltd."
                required
              />
              <InputField
                name="trading_name"
                label="Trading Name (optional)"
                defaultValue={client?.trading_name}
                placeholder="t/a Trading Name"
              />
            </div>

            {/* Contact */}
            <div className="space-y-4 pt-2 border-t border-slate-100">
              <InputField
                name="contact_name"
                label="Contact Name"
                defaultValue={client?.contact_name}
                placeholder="Full name"
                required
              />
              <InputField
                name="email"
                label="Email Address"
                type="email"
                defaultValue={client?.email}
                placeholder="email@business.com"
              />
              <InputField
                name="phone"
                label="Phone Number"
                type="tel"
                defaultValue={client?.phone}
                placeholder="+27 11 000 0000"
              />
            </div>

            {/* Billing */}
            <div className="space-y-4 pt-2 border-t border-slate-100">
              <div>
                <FieldLabel>Billing Role</FieldLabel>
                <Select
                  name="role"
                  value={role}
                  onValueChange={(val) =>
                    setRole(val as "buyer_default" | "buyer_30_day")
                  }
                >
                  <SelectTrigger className="h-10 text-sm border-slate-200 focus:ring-slate-900">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="buyer_default">
                      EFT Default (buyer_default)
                    </SelectItem>
                    <SelectItem value="buyer_30_day">
                      30-Day Account (buyer_30_day)
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-slate-400 mt-1.5">
                  30-Day accounts skip the payment page at checkout.
                </p>
              </div>

              {is30Day && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <InputField
                      name="credit_limit"
                      label="Credit Limit (R)"
                      type="number"
                      defaultValue={client?.credit_limit ?? ""}
                      placeholder="0.00"
                    />
                    <InputField
                      name="payment_terms_days"
                      label="Terms (days)"
                      type="number"
                      defaultValue={client?.payment_terms_days ?? ""}
                      placeholder="30"
                    />
                  </div>
                </>
              )}

              <InputField
                name="vat_number"
                label="VAT Registration Number"
                defaultValue={client?.vat_number}
                placeholder="e.g. 4123456789"
              />
            </div>

            {/* Credit utilization (30-day edit mode only) */}
            {isEdit && is30Day && client && (
              <CreditSection
                client={client}
                unpaidOrders={unpaidOrders}
                onSettled={onSaved}
              />
            )}

            {/* Notes */}
            <div className="pt-2 border-t border-slate-100">
              <FieldLabel>Internal Notes</FieldLabel>
              <Textarea
                name="notes"
                rows={3}
                defaultValue={client?.notes ?? ""}
                placeholder="Any internal notes about this client…"
                className="text-sm border-slate-200 focus:ring-slate-900 resize-none"
              />
            </div>

            {/* Active toggle (edit mode) */}
            {isEdit && (
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Account Active
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Inactive clients cannot log in
                  </p>
                </div>
                <input
                  type="hidden"
                  name="is_active"
                  value={client?.is_active ? "true" : "false"}
                />
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    defaultChecked={client?.is_active ?? true}
                    onChange={(e) => {
                      const hidden = e.currentTarget
                        .closest("form")
                        ?.querySelector<HTMLInputElement>('input[name="is_active"]');
                      if (hidden) hidden.value = e.currentTarget.checked ? "true" : "false";
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-200 rounded-full peer-checked:bg-slate-900 transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
                </label>
              </div>
            )}

            {/* Info notice */}
            <div className="flex gap-4 p-4 bg-blue-50/50 border border-blue-100/50 rounded-lg">
              <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-medium text-blue-900">Login credentials</p>
                <p className="text-[11px] text-blue-700 mt-1 leading-relaxed">
                  Buyers log in with their account number. No password is required — share the account number securely with the client.
                </p>
              </div>
            </div>
          </div>

          {/* Sticky footer */}
          <div className="p-6 border-t border-slate-100 bg-white">
            {error && (
              <p className="text-xs text-red-600 mb-3">{error}</p>
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
                className="flex-1 h-10 px-4 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-all shadow-sm disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-2"
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving…
                  </>
                ) : isEdit ? (
                  "Save Changes"
                ) : (
                  "Save Client"
                )}
              </button>
            </div>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
