export const dynamic = "force-dynamic";

import { getSession } from "@/lib/auth/session";
import { redirect, notFound } from "next/navigation";
import { adminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { CheckCircle2, ArrowLeft, Download, Info } from "lucide-react";
import CartClearer from "./CartClearer";

const ZAR = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
  minimumFractionDigits: 2,
});

interface PageProps {
  searchParams: Promise<{ orderId?: string }>;
}

export default async function ConfirmedPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { orderId } = await searchParams;
  if (!orderId) notFound();

  // Fetch order, scoped to this buyer
  const { data: order } = await adminClient
    .from("orders")
    .select("id, reference_number, total_amount, payment_method, status, order_notes")
    .eq("id", orderId)
    .eq("profile_id", session.profileId)
    .single();

  if (!order) notFound();

  const isEft = order.payment_method === "eft";

  // Fetch bank details if needed (EFT buyers need to see them again)
  const { data: config } = await adminClient
    .from("tenant_config")
    .select(
      "business_name, bank_name, bank_account_holder, bank_account_number, bank_branch_code, bank_account_type, bank_swift_code, bank_reference_prefix, email_from_address"
    )
    .eq("id", 1)
    .single();

  const bankRef = `${config?.bank_reference_prefix ?? "INV"}-${order.reference_number}`;

  return (
    <div className="flex-1 overflow-y-auto flex flex-col bg-[#fafafa]">
      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-center w-full px-4 md:px-8 py-12">
        {/* Cart clear on mount — client component */}
        <CartClearer />

        {/* Success card */}
        <div className="w-full max-w-[560px] bg-white border border-gray-100 rounded-3xl p-10 flex flex-col items-center text-center shadow-sm">
          {/* Icon + heading */}
          <div className="mb-8">
            <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mb-6 mx-auto">
              <CheckCircle2 className="w-9 h-9 text-green-600" />
            </div>
            <h1 className="text-[24px] font-semibold text-slate-900">
              Order Confirmed
            </h1>
            <p className="text-sm text-gray-400 mt-2">
              {isEft
                ? "Thank you. Please complete your EFT transfer to finalise the order."
                : "Your order is confirmed and will be invoiced to your 30-day account."}
            </p>
          </div>

          {/* Reference + total box */}
          <div className="w-full bg-slate-50 rounded-2xl p-6 text-left mb-8">
            <div className="flex justify-between items-start mb-6 pb-4 border-b border-slate-200">
              <div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                  Order Reference
                </p>
                <p className="text-sm font-medium text-slate-900">
                  #{order.reference_number}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                  Total Amount
                </p>
                <p className="text-sm font-medium text-slate-900">
                  {ZAR.format(Number(order.total_amount))}
                </p>
              </div>
            </div>

            {/* EFT bank details — only for eft payment method */}
            {isEft && (
              <div className="space-y-4">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                  Payment Details (EFT)
                </p>
                <div className="grid grid-cols-2 gap-y-4 gap-x-8">
                  <div>
                    <p className="text-[12px] text-gray-500 mb-0.5">Bank</p>
                    <p className="text-[14px] font-medium text-slate-900">
                      {config?.bank_name ?? "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[12px] text-gray-500 mb-0.5">
                      Account Name
                    </p>
                    <p className="text-[14px] font-medium text-slate-900">
                      {config?.bank_account_holder ?? config?.business_name ?? "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[12px] text-gray-500 mb-0.5">
                      Account Number
                    </p>
                    <p className="text-[14px] font-medium text-slate-900">
                      {config?.bank_account_number ?? "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[12px] text-gray-500 mb-0.5">
                      Branch Code
                    </p>
                    <p className="text-[14px] font-medium text-slate-900">
                      {config?.bank_branch_code ?? "—"}
                    </p>
                  </div>
                  {config?.bank_swift_code && (
                    <div>
                      <p className="text-[12px] text-gray-500 mb-0.5">
                        SWIFT / BIC
                      </p>
                      <p className="text-[14px] font-medium text-slate-900">
                        {config.bank_swift_code}
                      </p>
                    </div>
                  )}
                  <div className="col-span-2">
                    <p className="text-[12px] text-gray-500 mb-0.5">
                      Payment Reference
                    </p>
                    <p className="text-[14px] font-bold text-slate-900">
                      {bankRef}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 30-day account message */}
            {!isEft && (
              <div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Account Terms
                </p>
                <p className="text-[14px] text-gray-600">
                  This order will be raised against your 30-day credit account.
                  An invoice will be sent to your registered email address.
                </p>
              </div>
            )}
          </div>

          {/* Order Notes — shown only if buyer provided notes */}
          {order.order_notes && (
            <div className="w-full flex items-start gap-4 bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6 text-left">
              <Info className="w-4 h-4 mt-0.5 text-blue-400 flex-shrink-0" />
              <div>
                <p className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider mb-1">
                  Your Order Notes
                </p>
                <p className="text-sm text-slate-700">{order.order_notes}</p>
              </div>
            </div>
          )}

          {/* Download invoice PDF */}
          <a
            href={`/api/invoice/${order.id}`}
            download={`Proforma-${order.reference_number}.pdf`}
            className="w-full h-12 flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:bg-primary/90 active:scale-[0.98] transition-all mb-6"
          >
            <Download className="w-5 h-5" />
            Download Proforma Invoice PDF
          </a>

          <p className="text-[13px] text-gray-400">
            A confirmation has been sent to your registered business email.
          </p>

          <div className="mt-10 pt-8 border-t border-gray-100 w-full">
            <Link
              href="/dashboard"
              className="text-sm font-medium text-slate-900 hover:text-slate-700 inline-flex items-center gap-1 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Return to Catalogue
            </Link>
          </div>
        </div>
      </main>

    </div>
  );
}
