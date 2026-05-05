import { timingSafeEqual } from "node:crypto";
import { Resend } from "resend";
import { adminClient } from "@/lib/supabase/admin";
import { generateDailyReportCsv } from "@/lib/reports/daily-report";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  // [M15] Validate CRON_SECRET bearer token with timing-safe comparison
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!authHeader || !cronSecret) {
    return Response.json({ error: "Unauthorised" }, { status: 401 });
  }

  const expected = `Bearer ${cronSecret}`;
  const a = Buffer.from(authHeader);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return Response.json({ error: "Unauthorised" }, { status: 401 });
  }

  try {
    const today = new Date();
    const yyyy = today.getUTCFullYear();
    const mm = String(today.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(today.getUTCDate()).padStart(2, "0");
    const fileDateStr = `${yyyy}-${mm}-${dd}`;

    // Generate CSV and fetch tenant config in parallel — they are independent.
    const [csv, { data: config }] = await Promise.all([
      generateDailyReportCsv(today),
      adminClient
        .from("tenant_config")
        .select("report_emails, email_from_name, business_name")
        .eq("id", 1)
        .single(),
    ]);

    // --- Storage upload (non-fatal) ---
    const { error: uploadError } = await adminClient.storage
      .from("daily-reports")
      .upload(`${fileDateStr}.csv`, csv, {
        contentType: "text/csv",
        upsert: true,
      });

    if (uploadError) {
      console.error("[cron/daily-report] Storage upload failed (non-fatal):", uploadError.message);
    }

    // --- Email distribution (non-fatal) ---
    // report_emails is stored as a comma-separated TEXT column in tenant_config.
    // Recipients are only emailed when the column is populated and Resend is configured.
    const resendKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.RESEND_FROM_EMAIL;
    const rawEmails = config?.report_emails ?? null;

    if (!resendKey || !fromEmail) {
      console.warn("[cron/daily-report] RESEND_API_KEY or RESEND_FROM_EMAIL not set — skipping email");
    } else if (rawEmails) {
      const recipients = rawEmails
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean);

      if (recipients.length > 0) {
        const fromAddress = config?.email_from_name
          ? `${config.email_from_name} <${fromEmail}>`
          : fromEmail;
        const supplierName = config?.business_name ?? "Supplier";

        const resend = new Resend(resendKey);
        const { error: emailError } = await resend.emails.send({
          from: fromAddress,
          to: recipients,
          subject: `Daily Orders Report — ${fileDateStr}`,
          html: `<p>Hi,</p><p>Please find the daily orders report for <strong>${fileDateStr}</strong> attached.</p><p>— ${supplierName}</p>`,
          attachments: [
            {
              filename: `daily-report-${fileDateStr}.csv`,
              content: Buffer.from(csv, "utf-8"),
            },
          ],
        });

        if (emailError) {
          console.error("[cron/daily-report] Email send failed (non-fatal):", emailError.message);
        } else {
          console.log(`[cron/daily-report] Report emailed to ${recipients.length} recipient(s).`);
        }
      }
    }

    return Response.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cron/daily-report] Unhandled error:", message);
    return Response.json({ error: message }, { status: 500 });
  }
}
