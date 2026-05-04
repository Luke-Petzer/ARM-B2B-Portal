import type { Metadata } from "next";
import { getSession } from "@/lib/auth/session";
import NavBar from "@/components/portal/NavBar";
import PublicNavBar from "@/components/PublicNavBar";
import type { AppRole } from "@/lib/supabase/types";

export const metadata: Metadata = {
  title: "Cookie Policy | AR Steel Manufacturing",
  description:
    "How AR Steel Manufacturing uses cookies on the B2B Ordering Portal.",
};

export default async function CookiePolicyPage() {
  const session = await getSession();

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {session ? (
        <NavBar
          role={session.role as AppRole | undefined}
          businessName={session.businessName}
        />
      ) : (
        <>
          <PublicNavBar />
          <div className="h-[72px] flex-shrink-0" aria-hidden="true" />
        </>
      )}

      <div className="px-6 py-16 flex-1">
        <div className="max-w-3xl mx-auto space-y-10 text-slate-700">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">
              Cookie Policy
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Effective date: 1 April 2025 &nbsp;&middot;&nbsp; Jurisdiction:
              Republic of South Africa
            </p>
          </div>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-slate-900">What are cookies?</h2>
            <p className="text-sm leading-relaxed">
              Cookies are small text files placed on your device when you visit a website.
              They help the site remember information about your visit so it can function
              correctly and provide a better experience.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-slate-900">Cookies we use</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 pr-6 font-semibold text-slate-900">
                      Cookie / Key
                    </th>
                    <th className="text-left py-3 pr-6 font-semibold text-slate-900">
                      Category
                    </th>
                    <th className="text-left py-3 pr-6 font-semibold text-slate-900">
                      Purpose
                    </th>
                    <th className="text-left py-3 font-semibold text-slate-900">
                      Duration
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="py-3 pr-6 font-mono text-xs text-slate-600">
                      sb-buyer-session
                    </td>
                    <td className="py-3 pr-6">Strictly Necessary</td>
                    <td className="py-3 pr-6">
                      Authenticates your buyer account session
                    </td>
                    <td className="py-3">Session</td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-6 font-mono text-xs text-slate-600">
                      sb-* (Supabase Auth)
                    </td>
                    <td className="py-3 pr-6">Strictly Necessary</td>
                    <td className="py-3 pr-6">
                      Authenticates administrator accounts
                    </td>
                    <td className="py-3">Session</td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-6 font-mono text-xs text-slate-600">
                      cookie-consent-v1
                    </td>
                    <td className="py-3 pr-6">Strictly Necessary</td>
                    <td className="py-3 pr-6">
                      Stores your cookie consent preferences (localStorage — not a cookie)
                    </td>
                    <td className="py-3">Persistent</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-sm text-slate-500">
              We do not currently use analytics, advertising, or third-party tracking cookies.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-slate-900">Your choices</h2>
            <p className="text-sm leading-relaxed">
              You can update your cookie preferences at any time using the{" "}
              <strong>Cookie Settings</strong> link in the footer of any page.
              Strictly necessary cookies cannot be disabled as they are required for the
              portal to function.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-slate-900">Contact</h2>
            <p className="text-sm leading-relaxed">
              For questions about this Cookie Policy, contact our Information Officer at{" "}
              <a
                href="mailto:info@armanufacturing.co.za"
                className="text-slate-900 underline hover:text-slate-700"
              >
                info@armanufacturing.co.za
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
