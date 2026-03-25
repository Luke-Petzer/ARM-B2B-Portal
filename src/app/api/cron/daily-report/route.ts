import { adminClient } from "@/lib/supabase/admin";
import { generateDailyReportCsv } from "@/lib/reports/daily-report";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  // Validate CRON_SECRET bearer token
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!authHeader || !cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorised" }, { status: 401 });
  }

  try {
    const today = new Date();
    const yyyy = today.getUTCFullYear();
    const mm = String(today.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(today.getUTCDate()).padStart(2, "0");
    const fileDateStr = `${yyyy}-${mm}-${dd}`;

    const csv = await generateDailyReportCsv(today);

    const { error: uploadError } = await adminClient.storage
      .from("daily-reports")
      .upload(`${fileDateStr}.csv`, csv, {
        contentType: "text/csv",
        upsert: true,
      });

    if (uploadError) {
      console.error("[cron/daily-report] Storage upload failed (non-fatal):", uploadError.message);
    }

    return Response.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cron/daily-report] Unhandled error:", message);
    return Response.json({ error: message }, { status: 500 });
  }
}
