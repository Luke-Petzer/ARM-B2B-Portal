"use client";

import { useState, useTransition } from "react";
import { Loader2, CheckCircle } from "lucide-react";
import { updateTenantConfigAction } from "@/app/actions/admin";
import type { Database } from "@/lib/supabase/types";

type TenantConfig = Database["public"]["Tables"]["tenant_config"]["Row"];

interface SettingsFormProps {
  config: TenantConfig;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function FieldLabel({
  children,
  required,
}: {
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
      {children}
      {required && <span className="text-red-400 ml-0.5">*</span>}
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
      <FieldLabel required={required}>{label}</FieldLabel>
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

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm mb-6">
      <div className="px-6 py-5 border-b border-slate-100">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        <p className="text-sm text-slate-500 mt-0.5">{description}</p>
      </div>
      <div className="p-6 space-y-5">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SettingsForm({ config }: SettingsFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await updateTenantConfigAction(formData);
      if (result && "error" in result) {
        setError(result.error);
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 4000);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="pb-28">
      {/* ------------------------------------------------------------------ */}
      {/* Card 1 — Company Profile                                            */}
      {/* ------------------------------------------------------------------ */}
      <SectionCard
        title="Company Profile"
        description="Core identity and contact details shown on invoices and emails."
      >
        <div className="grid grid-cols-2 gap-5">
          <InputField
            name="business_name"
            label="Business Name"
            defaultValue={config.business_name}
            placeholder="Acme Corp (Pty) Ltd"
            required
          />
          <InputField
            name="trading_name"
            label="Trading Name (optional)"
            defaultValue={config.trading_name}
            placeholder="t/a Trading Name"
          />
        </div>

        <div className="grid grid-cols-2 gap-5">
          <InputField
            name="vat_number"
            label="VAT Registration Number"
            defaultValue={config.vat_number}
            placeholder="e.g. 4123456789"
          />
          <div>
            <FieldLabel>VAT Rate (%)</FieldLabel>
            <input
              type="number"
              name="vat_rate"
              step="0.01"
              min="0"
              max="100"
              defaultValue={
                config.vat_rate != null ? config.vat_rate * 100 : 15
              }
              placeholder="15"
              className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Enter as a percentage, e.g. 15 for 15%.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-5">
          <InputField
            name="support_email"
            label="Support Email"
            type="email"
            defaultValue={config.support_email}
            placeholder="support@yourdomain.com"
          />
          <InputField
            name="support_phone"
            label="Support Phone"
            type="tel"
            defaultValue={config.support_phone}
            placeholder="+27 11 000 0000"
          />
        </div>
      </SectionCard>

      {/* ------------------------------------------------------------------ */}
      {/* Card 2 — Banking Details                                            */}
      {/* ------------------------------------------------------------------ */}
      <SectionCard
        title="Banking Details"
        description="EFT payment instructions printed on every invoice."
      >
        <div className="grid grid-cols-2 gap-5">
          <InputField
            name="bank_name"
            label="Bank Name"
            defaultValue={config.bank_name}
            placeholder="FNB / ABSA / Standard Bank…"
          />
          <InputField
            name="bank_account_holder"
            label="Account Holder"
            defaultValue={config.bank_account_holder}
            placeholder="Acme Corp (Pty) Ltd"
          />
        </div>

        <div className="grid grid-cols-2 gap-5">
          <InputField
            name="bank_account_number"
            label="Account Number"
            defaultValue={config.bank_account_number}
            placeholder="62000000000"
          />
          <InputField
            name="bank_branch_code"
            label="Branch Code"
            defaultValue={config.bank_branch_code}
            placeholder="250655"
          />
        </div>

        <div className="grid grid-cols-2 gap-5">
          <InputField
            name="bank_account_type"
            label="Account Type"
            defaultValue={config.bank_account_type ?? ""}
            placeholder="e.g. Current, Savings, Cheque"
          />
          <InputField
            name="bank_swift_code"
            label="SWIFT / BIC Code"
            defaultValue={config.bank_swift_code ?? ""}
            placeholder="e.g. CABLZAJJ"
          />
          <InputField
            name="bank_reference_prefix"
            label="Reference Prefix"
            defaultValue={config.bank_reference_prefix}
            placeholder="ORD"
          />
        </div>

        <p className="text-[11px] text-slate-400">
          Buyers will be instructed to use their order reference (prefixed with
          the Reference Prefix) when making EFT payments.
        </p>
      </SectionCard>

      {/* ------------------------------------------------------------------ */}
      {/* Sticky footer                                                        */}
      {/* ------------------------------------------------------------------ */}
      <div className="fixed bottom-0 left-[250px] right-0 h-20 bg-white/95 backdrop-blur-sm border-t border-slate-200 flex items-center justify-between px-8 z-20">
        <div className="min-w-0">
          {error && <p className="text-sm text-red-600 truncate">{error}</p>}
          {saved && !error && (
            <p className="text-sm text-emerald-600 flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              Settings saved successfully.
            </p>
          )}
        </div>
        <div className="flex items-center gap-4 flex-shrink-0">
          <button
            type="reset"
            onClick={() => {
              setError(null);
              setSaved(false);
            }}
            className="h-10 px-5 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            Discard
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="h-10 px-5 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors shadow-sm disabled:opacity-40 disabled:pointer-events-none flex items-center gap-2"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Save Changes"
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
