import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { adminClient } from "@/lib/supabase/admin";
import { renderInvoiceToBuffer } from "@/lib/pdf/invoice";
import { checkActionRateLimit } from "@/lib/rate-limit";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // [M7] Per-session rate limit on invoice generation
  const rl = await checkActionRateLimit(session.profileId, "invoice");
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Too many requests. Try again in ${rl.retryAfter}s.` },
      { status: 429 }
    );
  }

  const { orderId } = await params;

  // [L5] Validate orderId is a valid UUID before querying
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(orderId)) {
    return NextResponse.json({ error: "Invalid order ID" }, { status: 400 });
  }

  // Fetch order scoped to this buyer
  const { data: order } = await adminClient
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .eq("profile_id", session.profileId)
    .single();

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const { data: items } = await adminClient
    .from("order_items")
    .select("*")
    .eq("order_id", orderId);

  const { data: profile } = await adminClient
    .from("profiles")
    .select("*")
    .eq("id", session.profileId)
    .single();

  const { data: config } = await adminClient
    .from("tenant_config")
    .select("*")
    .eq("id", 1)
    .single();

  if (!items || !profile || !config) {
    return NextResponse.json({ error: "Missing data" }, { status: 500 });
  }

  const pdfBuffer = await renderInvoiceToBuffer({ order, items, profile, config });

return new NextResponse(pdfBuffer as any, {
  status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Proforma-${order.reference_number}.pdf"`,
    },
  });
}
