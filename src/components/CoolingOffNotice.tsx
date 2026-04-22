import Link from "next/link";

export default function CoolingOffNotice() {
  return (
    <div className="flex items-start gap-4 p-4 bg-slate-50 border border-slate-200 rounded-lg text-[12px] text-slate-700">
      <p>
        <span className="font-medium text-slate-900">Cooling-off notice</span>
        <br className="mb-1" />
        Consumer customers have the right to cancel this order within{" "}
        <strong>five (5) business days</strong> of receiving the goods, in
        terms of Section 44 of the Electronic Communications and Transactions
        Act, 2002. This right does not apply to custom-manufactured goods,
        goods cut or altered to your specifications, or to business-to-business
        purchases. For full details, see our{" "}
        <Link
          href="/terms#returns"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-slate-900"
        >
          Returns, Refunds &amp; Cancellations Policy
        </Link>
        .
      </p>
    </div>
  );
}
