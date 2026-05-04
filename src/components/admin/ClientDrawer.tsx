"use client";

import { useState, useTransition, useEffect } from "react";
import { Loader2, Info, Search, X } from "lucide-react";
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
import {
  inviteClientAction,
  updateClientAction,
  listClientCustomPricesAction,
  setClientCustomPriceAction,
  removeClientCustomPriceAction,
  updateClientDiscountPctAction,
  searchProductsAction,
} from "@/app/actions/admin";

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
  client_discount_pct: number;
}

interface ClientDrawerProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  client?: ClientForDrawer | null;
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ClientDrawer({
  open,
  onClose,
  onSaved,
  client,
}: ClientDrawerProps) {
  const isEdit = Boolean(client);
  const [isPending, startTransition] = useTransition();
  const [fetchingPrices, startFetchPrices] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<"buyer_default" | "buyer_30_day">(
    client?.role ?? "buyer_default"
  );
  const is30Day = role === "buyer_30_day";

  // Custom pricing state
  const [discountPct, setDiscountPct] = useState<string>(
    String(client?.client_discount_pct ?? 0)
  );
  const [customPrices, setCustomPrices] = useState<{
    id: string; product_id: string; product_name: string; product_sku: string;
    base_price: number; custom_price: number; notes: string | null;
  }[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [searchResults, setSearchResults] = useState<{ id: string; name: string; sku: string; price: number }[]>([]);
  const [addingPrice, setAddingPrice] = useState<{ productId: string; productName: string; basPrice: number } | null>(null);
  const [newCustomPrice, setNewCustomPrice] = useState("");

  useEffect(() => {
    if (isEdit && client && open) {
      // Load custom prices and sync discount % when the drawer opens.
      // Both state updates are inside a useTransition async callback to avoid
      // synchronous setState in the effect body (react-hooks/set-state-in-effect).
      // client.client_discount_pct is read synchronously inside the async fn —
      // the value is already available so there is no perceptible delay.
      const capturedDiscountPct = String(client.client_discount_pct ?? 0);
      const capturedClientId = client.id;
      startFetchPrices(async () => {
        const result = await listClientCustomPricesAction(capturedClientId);
        if ("data" in result) setCustomPrices(result.data);
        setDiscountPct(capturedDiscountPct);
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, client?.id, open]);

  const handleProductSearch = async (q: string) => {
    setProductSearch(q);
    if (q.trim().length < 2) { setSearchResults([]); return; }
    const result = await searchProductsAction(q.trim());
    if ("data" in result) {
      // Filter out products that already have a custom price
      const existingIds = new Set(customPrices.map((cp) => cp.product_id));
      setSearchResults(result.data.filter((p) => !existingIds.has(p.id)));
    }
  };

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
    if (isEdit) formData.set("id", client!.id);

    startTransition(async () => {
      const result = isEdit
        ? await updateClientAction(formData)
        : await inviteClientAction(formData);

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
            {isEdit ? "Edit Client" : "Invite New Client"}
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

            {/* Create mode: invite form */}
            {!isEdit && (
              <div className="space-y-4">
                <div>
                  <FieldLabel>Email *</FieldLabel>
                  <input
                    name="email"
                    type="email"
                    required
                    placeholder="client@company.com"
                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all"
                  />
                </div>
                <div>
                  <FieldLabel>Contact Name *</FieldLabel>
                  <input
                    name="contact_name"
                    type="text"
                    required
                    placeholder="Full name"
                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all"
                  />
                </div>
                <div>
                  <FieldLabel>Business Name</FieldLabel>
                  <input
                    name="business_name"
                    type="text"
                    placeholder="Leave blank if individual"
                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all"
                  />
                </div>
                <p className="text-xs text-slate-500">
                  An invitation email will be sent to the client. Their account is created
                  when they accept and set a password.
                </p>
              </div>
            )}

            {/* Edit mode: full form */}
            {isEdit && (
              <>
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
                    <InputField
                      name="payment_terms_days"
                      label="Payment Terms (days)"
                      type="number"
                      defaultValue={client?.payment_terms_days ?? ""}
                      placeholder="30"
                    />
                  )}

                  <InputField
                    name="vat_number"
                    label="VAT Registration Number"
                    defaultValue={client?.vat_number}
                    placeholder="e.g. 4123456789"
                  />
                </div>

                {/* Custom Pricing — visible for 30-day accounts only (extensible later) */}
                {isEdit && is30Day && (
                  <div className="space-y-4 pt-2 border-t border-slate-100">
                    <div>
                      <FieldLabel>Client Discount (%)</FieldLabel>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          value={discountPct}
                          onChange={(e) => setDiscountPct(e.target.value)}
                          className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all"
                          placeholder="e.g. 5"
                        />
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => {
                            const val = parseFloat(discountPct);
                            if (isNaN(val) || val < 0 || val > 100) return;
                            startTransition(async () => {
                              const result = await updateClientDiscountPctAction(client!.id, val);
                              if (result && "error" in result) setError(result.error);
                            });
                          }}
                          className="h-10 px-3 bg-slate-100 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-200 transition-colors whitespace-nowrap"
                        >
                          Save %
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1.5">
                        Blanket discount applied to all products without a custom price.
                      </p>
                    </div>

                    <div>
                      <FieldLabel>Per-Product Custom Prices</FieldLabel>

                      {/* Search for products */}
                      <div className="relative mb-3">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <input
                          type="text"
                          value={productSearch}
                          onChange={(e) => handleProductSearch(e.target.value)}
                          placeholder="Search by SKU or product name..."
                          className="w-full h-9 pl-9 pr-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all"
                        />
                      </div>

                      {/* Search results dropdown */}
                      {searchResults.length > 0 && (
                        <div className="mb-3 border border-slate-200 rounded-lg overflow-hidden max-h-[160px] overflow-y-auto">
                          {searchResults.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                setAddingPrice({ productId: p.id, productName: p.name, basPrice: p.price });
                                setNewCustomPrice(String(p.price));
                                setSearchResults([]);
                                setProductSearch("");
                              }}
                              className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-b-0"
                            >
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-slate-700 truncate">{p.name}</p>
                                <p className="text-[11px] text-slate-400">{p.sku}</p>
                              </div>
                              <span className="text-xs text-slate-500 ml-2">R{p.price.toFixed(2)}</span>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Add custom price inline form */}
                      {addingPrice && (
                        <div className="mb-3 p-3 bg-blue-50/50 border border-blue-100 rounded-lg space-y-2">
                          <p className="text-xs font-medium text-slate-700">{addingPrice.productName}</p>
                          <p className="text-[11px] text-slate-400">Base price: R{addingPrice.basPrice.toFixed(2)}</p>
                          <div className="flex gap-2">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={newCustomPrice}
                              onChange={(e) => setNewCustomPrice(e.target.value)}
                              placeholder="Custom price"
                              className="flex-1 h-8 px-2 bg-white border border-slate-200 rounded text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                            />
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => {
                                const price = parseFloat(newCustomPrice);
                                if (isNaN(price) || price < 0) return;
                                startTransition(async () => {
                                  const result = await setClientCustomPriceAction(client!.id, addingPrice!.productId, price);
                                  if (result && "success" in result) {
                                    // Refresh the list
                                    const listResult = await listClientCustomPricesAction(client!.id);
                                    if ("data" in listResult) setCustomPrices(listResult.data);
                                    setAddingPrice(null);
                                    setNewCustomPrice("");
                                  } else if (result && "error" in result) {
                                    setError(result.error);
                                  }
                                });
                              }}
                              className="h-8 px-3 bg-primary text-primary-foreground rounded text-xs font-medium hover:bg-primary/90 transition-colors"
                            >
                              Set
                            </button>
                            <button
                              type="button"
                              onClick={() => { setAddingPrice(null); setNewCustomPrice(""); }}
                              className="h-8 px-2 text-slate-400 hover:text-slate-600"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Existing custom prices list */}
                      {fetchingPrices ? (
                        <div className="text-xs text-slate-400 py-4 text-center">Loading custom prices...</div>
                      ) : customPrices.length === 0 ? (
                        <p className="text-xs text-slate-400 py-2">No custom prices set for this client.</p>
                      ) : (
                        <div className="space-y-2 max-h-[200px] overflow-y-auto">
                          {customPrices.map((cp) => (
                            <div key={cp.id} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium text-slate-700 truncate">{cp.product_name}</p>
                                <p className="text-[11px] text-slate-400">{cp.product_sku} · Base: R{cp.base_price.toFixed(2)}</p>
                              </div>
                              <div className="flex items-center gap-2 ml-2">
                                <span className="text-sm font-semibold text-slate-900">R{cp.custom_price.toFixed(2)}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    startTransition(async () => {
                                      const result = await removeClientCustomPriceAction(client!.id, cp.product_id);
                                      if (result && "success" in result) {
                                        setCustomPrices((prev) => prev.filter((p) => p.id !== cp.id));
                                      }
                                    });
                                  }}
                                  className="text-slate-300 hover:text-red-500 transition-colors"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
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

                {/* Active toggle */}
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

                {/* Info notice */}
                <div className="flex gap-4 p-4 bg-blue-50/50 border border-blue-100/50 rounded-lg">
                  <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-blue-900">Login credentials</p>
                    <p className="text-[11px] text-blue-700 mt-1 leading-relaxed">
                      Buyers log in with their email address and password via the self-service portal.
                    </p>
                  </div>
                </div>
              </>
            )}
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
                className="flex-1 h-10 px-4 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-all shadow-sm disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-2"
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving…
                  </>
                ) : isEdit ? (
                  "Save Changes"
                ) : (
                  "Send Invite"
                )}
              </button>
            </div>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
