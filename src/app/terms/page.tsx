import { getSession } from "@/lib/auth/session";
import NavBar from "@/components/portal/NavBar";
import PublicNavBar from "@/components/PublicNavBar";
import type { AppRole } from "@/lib/supabase/types";

export const metadata = {
  title: "Terms & Policies | AR Steel Manufacturing",
  description:
    "Terms and Conditions, Privacy Policy, Returns, and Delivery Terms for the AR Steel Manufacturing B2B Ordering Portal.",
};

export default async function TermsPage() {
  const session = await getSession();

  const businessName = session?.businessName ?? null;

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {session ? (
        <NavBar
          role={session.role as AppRole | undefined}
          businessName={businessName}
        />
      ) : (
        <PublicNavBar />
      )}

      <div className={`px-6 py-16 ${!session ? "pt-[88px]" : ""}`}>
      <div className="max-w-3xl mx-auto space-y-10 text-slate-700">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">
            Terms &amp; Policies
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Effective date: 1 April 2025 &nbsp;&middot;&nbsp; Jurisdiction:
            Republic of South Africa
          </p>
        </div>

        <p className="text-sm leading-relaxed">
          These Terms and Conditions (&ldquo;Terms&rdquo;) govern your access to
          and use of the AR Steel Manufacturing B2B Ordering Portal
          (&ldquo;Portal&rdquo;), operated by AR Steel Manufacturing (Pty) Ltd
          (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;). By
          registering for or using the Portal, you agree to be bound by these
          Terms, our Privacy Policy, our Returns, Refunds &amp; Cancellations
          Policy, and our Delivery &amp; Shipping Terms, all set out below. If
          you do not agree, do not use the Portal.
        </p>

        {/* ── TERMS AND CONDITIONS ──────────────────────────────────── */}

        <section id="terms" className="space-y-4 scroll-mt-24">
          <h2 className="text-xl font-semibold text-slate-900">Terms and Conditions</h2>

          <div className="space-y-3 text-sm leading-relaxed">
            <h3 className="font-semibold text-slate-800">1. Eligibility</h3>
            <p>
              The Portal is available exclusively to registered South African
              businesses. By registering, you confirm that you are authorised to act
              on behalf of the business entity you represent and that all information
              provided is accurate and up to date.
            </p>

            <h3 className="font-semibold text-slate-800">2. Account Registration</h3>
            <p>
              You must provide a valid contact name, business name, and business
              email address to register. You are responsible for maintaining the
              confidentiality of your login credentials and for all activity
              conducted under your account. You must notify us immediately of any
              unauthorised use at{" "}
              <a
                href="mailto:orders@armanufacturing.co.za"
                className="underline hover:text-slate-900"
              >
                orders@armanufacturing.co.za
              </a>
              .
            </p>

            <h3 className="font-semibold text-slate-800">3. Orders and Credit</h3>
            <p>
              All orders placed through the Portal constitute a binding purchase
              order subject to our confirmation. Credit limits, payment terms, and
              account status are managed at our sole discretion and may be reviewed
              or amended at any time. Overdue accounts may result in suspension of
              Portal access. Returns, refunds, and cancellations are governed by our{" "}
              <a href="#returns" className="underline hover:text-slate-900">
                Returns, Refunds &amp; Cancellations Policy
              </a>{" "}
              below.
            </p>

            <h3 className="font-semibold text-slate-800">4. Pricing and VAT</h3>
            <p>
              All prices displayed are exclusive of Value-Added Tax (VAT) unless
              otherwise stated. VAT will be calculated and applied at the applicable
              statutory rate at the time of order confirmation. We reserve the right
              to update pricing without prior notice.
            </p>

            <h3 className="font-semibold text-slate-800">5. Intellectual Property</h3>
            <p>
              All content on the Portal, including product data, images, and the
              portal software itself, is the property of AR Steel Manufacturing (Pty)
              Ltd or its licensors. You may not reproduce, distribute, or modify any
              Portal content without our prior written consent.
            </p>

            <h3 className="font-semibold text-slate-800">6. Limitation of Liability</h3>
            <p>
              To the maximum extent permitted by applicable law, we shall not be
              liable for any indirect, incidental, or consequential loss arising from
              your use of or inability to use the Portal. Our total aggregate
              liability shall not exceed the value of the specific order giving rise
              to the claim. Nothing in this clause limits or excludes any liability
              that cannot be limited or excluded under applicable South African law,
              including the Consumer Protection Act and the Electronic Communications
              and Transactions Act.
            </p>

            <h3 className="font-semibold text-slate-800">7. Amendments</h3>
            <p>
              We reserve the right to amend these Terms at any time. Continued use of
              the Portal following notification of changes constitutes acceptance of
              the revised Terms.
            </p>

            <h3 className="font-semibold text-slate-800">8. Governing Law</h3>
            <p>
              These Terms are governed by the laws of the Republic of South Africa.
              Any disputes shall be subject to the exclusive jurisdiction of the
              South African courts.
            </p>
          </div>
        </section>

        <hr className="border-slate-200" />

        {/* ── PRIVACY POLICY (POPIA) ────────────────────────────────── */}

        <section id="privacy" className="space-y-4 scroll-mt-24">
          <h2 className="text-xl font-semibold text-slate-900">Privacy Policy</h2>
          <p className="text-sm leading-relaxed">
            This Privacy Policy is issued in accordance with the{" "}
            <strong>Protection of Personal Information Act 4 of 2013 (POPIA)</strong>{" "}
            and applies to all personal information collected through the Portal.
          </p>

          <div className="space-y-3 text-sm leading-relaxed">
            <h3 className="font-semibold text-slate-800">1. Information Officer</h3>
            <p>
              Our Information Officer, as required by POPIA, is [INFORMATION OFFICER
              FULL NAME], who may be contacted at{" "}
              <a
                href="mailto:orders@armanufacturing.co.za"
                className="underline hover:text-slate-900"
              >
                orders@armanufacturing.co.za
              </a>
              .
            </p>

            <h3 className="font-semibold text-slate-800">2. Personal Information We Collect</h3>
            <p>We collect only the information necessary to operate the Portal:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Contact name</li>
              <li>Business name</li>
              <li>Business email address</li>
              <li>Account number (assigned upon approval)</li>
              <li>Credit limit and payment terms (set administratively)</li>
            </ul>

            <h3 className="font-semibold text-slate-800">3. Purpose of Processing</h3>
            <p>
              Your personal information is collected and processed solely for the
              following purposes:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Processing and fulfilling B2B purchase orders</li>
              <li>Managing your account, credit limit, and payment terms</li>
              <li>Sending transactional emails (order confirmations, invoices, statements)</li>
              <li>Complying with our legal and financial record-keeping obligations</li>
            </ul>
            <p>
              We do not use your personal information for marketing, profiling, or
              any purpose unrelated to your account and orders.
            </p>

            <h3 className="font-semibold text-slate-800">4. Legal Basis for Processing</h3>
            <p>
              Processing is carried out on the basis of (a) your consent given at
              registration, (b) the necessity of processing to perform the contract
              between us, and (c) compliance with legal obligations applicable to our
              business.
            </p>

            <h3 className="font-semibold text-slate-800">5. Third-Party Service Providers</h3>
            <p>
              We engage the following sub-processors to operate the Portal. Each
              provider processes data solely on our instructions and under
              appropriate data processing agreements:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>Vercel Inc.</strong> &mdash; Cloud hosting and content
                delivery. Data may be processed in the United States.
              </li>
              <li>
                <strong>Supabase Inc.</strong> &mdash; Database storage and
                authentication services. Data may be processed in the United States.
              </li>
              <li>
                <strong>Resend Inc.</strong> &mdash; Transactional email delivery
                (order confirmations and invoices). Data may be processed in the
                United States.
              </li>
            </ul>
            <p>
              Where personal information is transferred outside South Africa, we take
              reasonable steps to ensure that the recipient is subject to a law,
              binding corporate rules, or a binding agreement that provides a
              comparable level of protection to POPIA.
            </p>

            <h3 className="font-semibold text-slate-800">6. Data Retention</h3>
            <p>
              We retain your personal information for as long as your account remains
              active and for a period of five (5) years thereafter, as required by
              South African financial record-keeping legislation. You may request
              deletion of non-mandatory data at any time (see Section 8).
            </p>

            <h3 className="font-semibold text-slate-800">7. Security</h3>
            <p>
              We implement industry-standard technical and organisational measures to
              protect your personal information against unauthorised access, loss, or
              destruction. These measures include encrypted data transmission (TLS),
              access controls, and role-based permissions within the Portal.
            </p>

            <h3 className="font-semibold text-slate-800">8. Your Rights Under POPIA</h3>
            <p>You have the right to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Request access to the personal information we hold about you</li>
              <li>Request correction of inaccurate information</li>
              <li>Request deletion of your information (subject to legal retention requirements)</li>
              <li>Object to the processing of your information</li>
              <li>
                Lodge a complaint with the{" "}
                <strong>Information Regulator of South Africa</strong> at{" "}
                <a
                  href="https://inforegulator.org.za"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-slate-900"
                >
                  inforegulator.org.za
                </a>
              </li>
            </ul>
            <p>
              To exercise any of the above rights, contact our Information Officer at{" "}
              <a
                href="mailto:orders@armanufacturing.co.za"
                className="underline hover:text-slate-900"
              >
                orders@armanufacturing.co.za
              </a>
              .
            </p>

            <h3 className="font-semibold text-slate-800">9. Cookies</h3>
            <p>
              The Portal uses strictly necessary session cookies to authenticate your
              account. For full details on cookies used and to manage your preferences,
              see our{" "}
              <a href="/cookie-policy" className="text-slate-700 underline hover:text-slate-900 transition-colors">
                Cookie Policy
              </a>
              .
            </p>

            <h3 className="font-semibold text-slate-800">10. Changes to this Policy</h3>
            <p>
              We may update this Privacy Policy from time to time. Material changes
              will be communicated via the Portal or by email. Continued use of the
              Portal after such notification constitutes acceptance of the updated
              policy.
            </p>
          </div>
        </section>

        <hr className="border-slate-200" />

        {/* ── RETURNS, REFUNDS & CANCELLATIONS ──────────────────────── */}

        <section id="returns" className="space-y-4 scroll-mt-24">
          <h2 className="text-xl font-semibold text-slate-900">
            Returns, Refunds &amp; Cancellations Policy
          </h2>
          <p className="text-sm leading-relaxed">
            This policy governs returns, refunds, and cancellations of orders
            placed through the Portal. It is issued in accordance with the{" "}
            <strong>Consumer Protection Act 68 of 2008 (&ldquo;CPA&rdquo;)</strong>{" "}
            and the{" "}
            <strong>
              Electronic Communications and Transactions Act 25 of 2002
              (&ldquo;ECT Act&rdquo;)
            </strong>
            , as applicable.
          </p>

          <div className="space-y-3 text-sm leading-relaxed">
            <h3 className="font-semibold text-slate-800">
              1. Cooling-Off Period for Online Consumer Purchases
            </h3>
            <p>
              In terms of Section 44 of the ECT Act, consumers purchasing goods
              through the Portal have the right to cancel an order within{" "}
              <strong>five (5) business days</strong> of receiving the goods, without
              reason or penalty, subject to the exclusions below.
            </p>
            <p>The cooling-off right does not apply to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                Goods that are made to the customer&rsquo;s specifications, cut to
                size, or otherwise custom-manufactured
              </li>
              <li>
                Goods that, by reason of their nature, cannot be returned (including
                but not limited to steel goods that have been altered, welded, cut,
                painted, or otherwise processed after delivery)
              </li>
              <li>
                Goods supplied to business customers acting in the course of their
                trade (Section 44 applies to consumers, not B2B transactions)
              </li>
            </ul>
            <p>
              Where the cooling-off right applies, the customer must return the
              goods at their own cost, in the original condition and packaging,
              within five (5) business days of notifying us of the cancellation. A
              refund will be issued within thirty (30) days of receiving the
              returned goods.
            </p>

            <h3 className="font-semibold text-slate-800">2. Defective or Damaged Goods</h3>
            <p>
              In terms of Section 56 of the CPA, customers have the right to return
              goods that are defective, unsafe, or do not comply with the description
              or purpose for which they were sold, within six (6) months of delivery.
              The customer may choose between:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>A full refund</li>
              <li>Replacement of the goods</li>
              <li>Repair of the goods (where applicable)</li>
            </ul>
            <p>
              To exercise this right, the customer must notify us at{" "}
              <a
                href="mailto:orders@armanufacturing.co.za"
                className="underline hover:text-slate-900"
              >
                orders@armanufacturing.co.za
              </a>
              , providing the order number, a description of the defect, and
              photographic evidence where possible. We may arrange for inspection of
              the goods before confirming the remedy.
            </p>

            <h3 className="font-semibold text-slate-800">3. Incorrect or Short Delivery</h3>
            <p>
              If the goods delivered do not match the order (wrong item, wrong
              quantity, or short delivery), the customer must notify us within{" "}
              <strong>three (3) business days</strong> of delivery. We will arrange
              for correction of the order at no cost to the customer.
            </p>

            <h3 className="font-semibold text-slate-800">4. Order Cancellation Before Dispatch</h3>
            <p>
              Orders may be cancelled without penalty at any point{" "}
              <strong>before dispatch</strong>. To cancel, contact us at{" "}
              <a
                href="mailto:orders@armanufacturing.co.za"
                className="underline hover:text-slate-900"
              >
                orders@armanufacturing.co.za
              </a>{" "}
              with the order number.
            </p>
            <p>
              Custom-manufactured orders may be cancelled without penalty only before
              manufacturing begins. Once production has started, cancellation may
              incur a fee to cover materials and labour already expended, up to the
              full value of the order.
            </p>

            <h3 className="font-semibold text-slate-800">5. Refund Method</h3>
            <p>
              Refunds will be processed by EFT to the bank account from which payment
              was received, within thirty (30) days of the refund being approved.
              Refunds will not be paid in cash or to a third-party account.
            </p>

            <h3 className="font-semibold text-slate-800">6. Contact</h3>
            <p>
              For returns, refunds, or cancellations, contact AR Steel Manufacturing
              (Pty) Ltd at{" "}
              <a
                href="mailto:orders@armanufacturing.co.za"
                className="underline hover:text-slate-900"
              >
                orders@armanufacturing.co.za
              </a>{" "}
              or <a href="tel:+27212710526" className="underline hover:text-slate-900">021 271 0526</a>.
            </p>
          </div>
        </section>

        <hr className="border-slate-200" />

        {/* ── DELIVERY & SHIPPING ───────────────────────────────────── */}

        <section id="delivery" className="space-y-4 scroll-mt-24">
          <h2 className="text-xl font-semibold text-slate-900">
            Delivery &amp; Shipping
          </h2>

          <div className="space-y-3 text-sm leading-relaxed">
            <h3 className="font-semibold text-slate-800">1. Delivery Areas</h3>
            <p>
              AR Steel Manufacturing delivers to customers located within [DELIVERY
              AREA &mdash; e.g., &ldquo;the Western Cape,&rdquo; &ldquo;the Cape Town
              metropolitan area,&rdquo; or &ldquo;nationally within the Republic of
              South Africa&rdquo;]. Delivery to areas outside this region may be
              arranged on request and at the customer&rsquo;s cost.
            </p>

            <h3 className="font-semibold text-slate-800">2. Delivery Times</h3>
            <p>Estimated delivery times are as follows:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>In-stock items:</strong> dispatched within [X] business days
                of order confirmation and payment receipt.
              </li>
              <li>
                <strong>Custom-manufactured items:</strong> dispatched within [X&ndash;Y]
                business days of order confirmation and payment receipt.
              </li>
              <li>
                <strong>Delivery transit times</strong> vary by location and are
                estimated as [X&ndash;Y] business days after dispatch.
              </li>
            </ul>
            <p>
              Delivery times are estimates only and are not guaranteed. We are not
              liable for delays caused by courier services, adverse weather, load
              shedding, or other circumstances beyond our reasonable control.
            </p>

            <h3 className="font-semibold text-slate-800">3. Delivery Costs</h3>
            <p>
              Delivery costs are calculated based on order size, weight, and
              delivery location, and are quoted at the time of order confirmation.
              Delivery costs are non-refundable once goods have been dispatched,
              except in the case of defective or incorrectly supplied goods.
            </p>

            <h3 className="font-semibold text-slate-800">4. Risk and Ownership</h3>
            <p>
              Risk in the goods passes to the customer upon delivery at the
              customer&rsquo;s nominated delivery address. Ownership of the goods
              passes to the customer upon receipt of full payment by AR Steel
              Manufacturing.
            </p>

            <h3 className="font-semibold text-slate-800">5. Failed Delivery</h3>
            <p>
              If delivery cannot be completed due to the customer&rsquo;s
              unavailability, incorrect address, or refusal to accept the goods, the
              goods will be returned to our premises. A second delivery attempt may
              be arranged at the customer&rsquo;s cost. If the customer does not
              arrange collection or redelivery within fourteen (14) days, the order
              may be cancelled and a refund issued, less reasonable costs incurred.
            </p>

            <h3 className="font-semibold text-slate-800">6. Inspection on Delivery</h3>
            <p>
              Customers are encouraged to inspect all goods on delivery and note any
              visible damage or discrepancies on the delivery document at the time
              of receipt. Claims for visible damage or short delivery must be made
              within three (3) business days of delivery (see Section 3 of the{" "}
              <a href="#returns" className="underline hover:text-slate-900">
                Returns, Refunds &amp; Cancellations Policy
              </a>{" "}
              above).
            </p>

            <h3 className="font-semibold text-slate-800">7. Contact</h3>
            <p>
              For delivery queries, contact AR Steel Manufacturing (Pty) Ltd at{" "}
              <a
                href="mailto:orders@armanufacturing.co.za"
                className="underline hover:text-slate-900"
              >
                orders@armanufacturing.co.za
              </a>{" "}
              or <a href="tel:+27212710526" className="underline hover:text-slate-900">021 271 0526</a>.
            </p>
          </div>
        </section>

        <p className="text-xs text-slate-400 pt-4 border-t border-slate-100">
          &copy; {new Date().getFullYear()} AR Steel Manufacturing (Pty) Ltd. All rights reserved.
        </p>
      </div>
      </div>
    </div>
  );
}
