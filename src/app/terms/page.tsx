export const metadata = {
  title: "Terms and Conditions & Privacy Policy",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white px-6 py-16">
      <div className="max-w-3xl mx-auto space-y-10 text-slate-700">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">
            Terms and Conditions &amp; Privacy Policy
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Effective date: 1 April 2025 &nbsp;&middot;&nbsp; Jurisdiction: Republic of South Africa
          </p>
        </div>

        <p className="text-sm leading-relaxed">
          These Terms and Conditions (&ldquo;Terms&rdquo;) govern your access to and use of the
          AR Steel Manufacturing B2B Ordering Portal (&ldquo;Portal&rdquo;), operated by AR Steel
          Manufacturing (Pty) Ltd (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;). By
          registering for or using the Portal, you agree to be bound by these Terms and our Privacy
          Policy set out below. If you do not agree, do not use the Portal.
        </p>

        {/* ── TERMS AND CONDITIONS ──────────────────────────────────── */}

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-slate-900">Terms and Conditions</h2>

          <div className="space-y-3 text-sm leading-relaxed">
            <h3 className="font-semibold text-slate-800">1. Eligibility</h3>
            <p>
              The Portal is available exclusively to registered South African businesses. By
              registering, you confirm that you are authorised to act on behalf of the business
              entity you represent and that all information provided is accurate and up to date.
            </p>

            <h3 className="font-semibold text-slate-800">2. Account Registration</h3>
            <p>
              You must provide a valid contact name, business name, and business email address to
              register. You are responsible for maintaining the confidentiality of your login
              credentials and for all activity conducted under your account. You must notify us
              immediately of any unauthorised use at{" "}
              <a
                href="mailto:orders@arsteelmanufacturing.co.za"
                className="underline hover:text-slate-900"
              >
                orders@arsteelmanufacturing.co.za
              </a>
              .
            </p>

            <h3 className="font-semibold text-slate-800">3. Orders and Credit</h3>
            <p>
              All orders placed through the Portal constitute a binding purchase order subject to
              our confirmation. Credit limits, payment terms, and account status are managed at our
              sole discretion and may be reviewed or amended at any time. Overdue accounts may
              result in suspension of Portal access.
            </p>

            <h3 className="font-semibold text-slate-800">4. Pricing and VAT</h3>
            <p>
              All prices displayed are exclusive of Value-Added Tax (VAT) unless otherwise stated.
              VAT will be calculated and applied at the applicable statutory rate at the time of
              order confirmation. We reserve the right to update pricing without prior notice.
            </p>

            <h3 className="font-semibold text-slate-800">5. Intellectual Property</h3>
            <p>
              All content on the Portal, including product data, images, and the portal software
              itself, is the property of AR Steel Manufacturing (Pty) Ltd or its licensors. You may
              not reproduce, distribute, or modify any Portal content without our prior written
              consent.
            </p>

            <h3 className="font-semibold text-slate-800">6. Limitation of Liability</h3>
            <p>
              To the maximum extent permitted by applicable law, we shall not be liable for any
              indirect, incidental, or consequential loss arising from your use of or inability to
              use the Portal. Our total aggregate liability shall not exceed the value of the
              specific order giving rise to the claim.
            </p>

            <h3 className="font-semibold text-slate-800">7. Amendments</h3>
            <p>
              We reserve the right to amend these Terms at any time. Continued use of the Portal
              following notification of changes constitutes acceptance of the revised Terms.
            </p>

            <h3 className="font-semibold text-slate-800">8. Governing Law</h3>
            <p>
              These Terms are governed by the laws of the Republic of South Africa. Any disputes
              shall be subject to the exclusive jurisdiction of the South African courts.
            </p>
          </div>
        </section>

        <hr className="border-slate-200" />

        {/* ── PRIVACY POLICY (POPIA) ────────────────────────────────── */}

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-slate-900">Privacy Policy</h2>
          <p className="text-sm leading-relaxed">
            This Privacy Policy is issued in accordance with the{" "}
            <strong>Protection of Personal Information Act 4 of 2013 (POPIA)</strong> and applies
            to all personal information collected through the Portal.
          </p>

          <div className="space-y-3 text-sm leading-relaxed">
            <h3 className="font-semibold text-slate-800">1. Information Officer</h3>
            <p>
              Our Information Officer, as required by POPIA, can be contacted at:{" "}
              <a
                href="mailto:orders@arsteelmanufacturing.co.za"
                className="underline hover:text-slate-900"
              >
                orders@arsteelmanufacturing.co.za
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
              Your personal information is collected and processed solely for the following
              purposes:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Processing and fulfilling B2B purchase orders</li>
              <li>Managing your account, credit limit, and payment terms</li>
              <li>Sending transactional emails (order confirmations, invoices, statements)</li>
              <li>Complying with our legal and financial record-keeping obligations</li>
            </ul>
            <p>
              We do not use your personal information for marketing, profiling, or any purpose
              unrelated to your account and orders.
            </p>

            <h3 className="font-semibold text-slate-800">4. Legal Basis for Processing</h3>
            <p>
              Processing is carried out on the basis of (a) your consent given at registration,
              (b) the necessity of processing to perform the contract between us, and (c) compliance
              with legal obligations applicable to our business.
            </p>

            <h3 className="font-semibold text-slate-800">5. Third-Party Service Providers</h3>
            <p>
              We engage the following sub-processors to operate the Portal. Each provider processes
              data solely on our instructions and under appropriate data processing agreements:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>Vercel Inc.</strong> — Cloud hosting and content delivery. Data may be
                processed in the United States.
              </li>
              <li>
                <strong>Supabase Inc.</strong> — Database storage and authentication services.
                Data may be processed in the United States.
              </li>
              <li>
                <strong>Resend Inc.</strong> — Transactional email delivery (order confirmations
                and invoices). Data may be processed in the United States.
              </li>
            </ul>
            <p>
              Where personal information is transferred outside South Africa, we take reasonable
              steps to ensure that the recipient is subject to a law, binding corporate rules, or
              a binding agreement that provides a comparable level of protection to POPIA.
            </p>

            <h3 className="font-semibold text-slate-800">6. Data Retention</h3>
            <p>
              We retain your personal information for as long as your account remains active and
              for a period of five (5) years thereafter, as required by South African financial
              record-keeping legislation. You may request deletion of non-mandatory data at any
              time (see Section 8).
            </p>

            <h3 className="font-semibold text-slate-800">7. Security</h3>
            <p>
              We implement industry-standard technical and organisational measures to protect your
              personal information against unauthorised access, loss, or destruction. These
              measures include encrypted data transmission (TLS), access controls, and
              role-based permissions within the Portal.
            </p>

            <h3 className="font-semibold text-slate-800">8. Your Rights Under POPIA</h3>
            <p>You have the right to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Request access to the personal information we hold about you</li>
              <li>Request correction of inaccurate information</li>
              <li>Request deletion of your information (subject to legal retention requirements)</li>
              <li>Object to the processing of your information</li>
              <li>Lodge a complaint with the{" "}
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
                href="mailto:orders@arsteelmanufacturing.co.za"
                className="underline hover:text-slate-900"
              >
                orders@arsteelmanufacturing.co.za
              </a>
              .
            </p>

            <h3 className="font-semibold text-slate-800">9. Cookies</h3>
            <p>
              The Portal uses strictly necessary session cookies to authenticate your account. No
              tracking, advertising, or analytics cookies are used.
            </p>

            <h3 className="font-semibold text-slate-800">10. Changes to this Policy</h3>
            <p>
              We may update this Privacy Policy from time to time. Material changes will be
              communicated via the Portal or by email. Continued use of the Portal after such
              notification constitutes acceptance of the updated policy.
            </p>
          </div>
        </section>

        <p className="text-xs text-slate-400 pt-4 border-t border-slate-100">
          &copy; {new Date().getFullYear()} AR Steel Manufacturing (Pty) Ltd. All rights reserved.
        </p>
      </div>
    </div>
  );
}
