export const dynamic = "force-dynamic";

import { getSession } from "@/lib/auth/session";
import { redirect, notFound } from "next/navigation";
import { adminClient } from "@/lib/supabase/admin";
import NavBar from "@/components/portal/NavBar";
import { AlertCircle } from "lucide-react";
import PaymentForm from "./PaymentForm";

const ZAR = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
  minimumFractionDigits: 2,
});

interface PageProps {
  searchParams: Promise<{ orderId?: string }>;
}

export default async function PaymentPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session) redirect("/login");
  // 30-day accounts never land here — guard in case of direct navigation
  if (session.role === "buyer_30_day") redirect("/dashboard");

  const { orderId } = await searchParams;
  if (!orderId) notFound();

  // Fetch order + its items, scoped to this buyer
  const { data: order } = await adminClient
    .from("orders")
    .select(
      `id, reference_number, total_amount, subtotal, vat_amount, status,
       order_items ( sku, product_name, unit_price, quantity, line_total )`
    )
    .eq("id", orderId)
    .eq("profile_id", session.profileId)
    .single();

  if (!order) notFound();

  // Fetch bank details from tenant config
  const { data: config } = await adminClient
    .from("tenant_config")
    .select(
      "business_name, bank_name, bank_account_holder, bank_account_number, bank_branch_code, bank_account_type, bank_swift_code, bank_reference_prefix"
    )
    .eq("id", 1)
    .single();

  const bankRef = `${config?.bank_reference_prefix ?? "INV"}-${order.reference_number}`;

  type RawItem = {
    sku: string;
    product_name: string;
    unit_price: number;
    quantity: number;
    line_total: number;
  };
  const items = (order.order_items as RawItem[]) ?? [];

  return (
    <div className="flex-1 overflow-y-auto bg-[#fafafa] flex flex-col">
      <NavBar />

      <main className="flex-1 max-w-[1200px] w-full mx-auto px-4 md:px-8 pt-12 pb-24">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-slate-900">
            Review & Submit Order
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Review your order and banking details below. Once submitted, your Proforma Invoice will be generated and emailed to you.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8">
          {/* Left — order summary */}
          <div className="md:col-span-7">
            <div className="bg-white border border-gray-100 rounded-lg shadow-sm mb-6">
              <div className="px-6 py-4 bg-gray-50/50 border-b border-gray-100 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-900">
                  Order Summary
                </span>
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                  {order.reference_number}
                </span>
              </div>

              <div className="w-full overflow-x-auto">
                <table className="min-w-[500px] w-full text-left border-collapse">
                  <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-6 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                      SKU
                    </th>
                    <th className="px-6 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-6 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider text-right">
                      Qty
                    </th>
                    <th className="px-6 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider text-right">
                      Subtotal
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {items.map((item, i) => (
                    <tr key={i}>
                      <td className="px-6 py-4 text-[13px] font-medium text-slate-900">
                        {item.sku}
                      </td>
                      <td className="px-6 py-4 text-[13px] text-gray-500">
                        {item.product_name}
                      </td>
                      <td className="px-6 py-4 text-[13px] text-gray-900 text-right">
                        {item.quantity}
                      </td>
                      <td className="px-6 py-4 text-[13px] font-medium text-slate-900 text-right">
                        {ZAR.format(Number(item.line_total))}
                      </td>
                    </tr>
                  ))}
                </tbody>
                </table>
              </div>

              <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/30 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Subtotal</span>
                  <span className="font-medium text-slate-900">
                    {ZAR.format(Number(order.subtotal))}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">VAT</span>
                  <span className="font-medium text-slate-900">
                    {ZAR.format(Number(order.vat_amount))}
                  </span>
                </div>
                <div className="flex justify-between text-base pt-2 border-t border-gray-100">
                  <span className="font-semibold text-slate-900">Total Due</span>
                  <span className="font-bold text-slate-900">
                    {ZAR.format(Number(order.total_amount))}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right — bank details + CTA */}
          <div className="md:col-span-5">
            <div className="bg-white border border-gray-100 rounded-lg p-6 shadow-sm mb-4">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-4">
                EFT Bank Details
              </p>

              <div className="grid grid-cols-2 gap-y-6 gap-x-6">
                <div>
                  <p className="text-[11px] text-gray-400 mb-0.5">Bank</p>
                  <p className="text-[14px] font-medium text-slate-900">
                    {config?.bank_name ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-400 mb-0.5">
                    Account Holder
                  </p>
                  <p className="text-[14px] font-medium text-slate-900">
                    {config?.bank_account_holder ?? config?.business_name ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-400 mb-0.5">
                    Account Number
                  </p>
                  <p className="text-[14px] font-medium text-slate-900">
                    {config?.bank_account_number ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-400 mb-0.5">
                    Branch Code
                  </p>
                  <p className="text-[14px] font-medium text-slate-900">
                    {config?.bank_branch_code ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-400 mb-0.5">
                    Account Type
                  </p>
                  <p className="text-[14px] font-medium text-slate-900">
                    {config?.bank_account_type ?? "—"}
                  </p>
                </div>
                {config?.bank_swift_code && (
                  <div>
                    <p className="text-[11px] text-gray-400 mb-0.5">
                      SWIFT / BIC
                    </p>
                    <p className="text-[14px] font-medium text-slate-900">
                      {config.bank_swift_code}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-[11px] text-gray-400 mb-0.5">
                    Payment Reference
                  </p>
                  <p className="text-[14px] font-bold text-slate-900">
                    {bankRef}
                  </p>
                </div>
              </div>
            </div>

            {/* Payment reference notice */}
            <div className="flex items-start gap-4 p-4 bg-amber-50 border border-amber-100 rounded-lg mb-6 text-[12px] text-amber-800">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-500" />
              <p>
                When making your EFT, use <strong>{bankRef}</strong> as your payment reference so we can match your transfer.
              </p>
            </div>

            {/* Submit form */}
            <PaymentForm orderId={order.id} bankRef={bankRef} />
          </div>
        </div>
      </main>
    </div>
  );
}
