import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { generateDailyReportCsv } from "@/lib/reports/daily-report";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  // Validate admin session
  const session = await getSession();
  if (!session?.isAdmin) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  // Parse optional `date` query param (YYYY-MM-DD); default to today
  const url = new URL(req.url);
  const dateParam = url.searchParams.get("date");

  let date: Date;
  if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    date = new Date(`${dateParam}T00:00:00.000Z`);
  } else {
    date = new Date();
  }

  // Format filename date as YYYY-MM-DD
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const fileDateStr = `${yyyy}-${mm}-${dd}`;

  try {
    const csv = await generateDailyReportCsv(date);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename=daily-report-${fileDateStr}.csv`,
      },
    });
  } catch (err) {
    console.error("[api/reports/daily]", err);
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}
