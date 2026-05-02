import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";

export async function GET() {
  const session = await getSession();

  const response = NextResponse.json({
    isAuthenticated: session !== null,
    role: session?.role ?? null,
    businessName: session?.businessName ?? null,
  });

  response.headers.set(
    "Cache-Control",
    "private, max-age=60, stale-while-revalidate=300"
  );

  return response;
}
