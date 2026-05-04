"use server";

import { z } from "zod";
import { Resend } from "resend";
import { getSession } from "@/lib/auth/session";
import {
  BuyerRefundConfirmationEmail,
  BusinessRefundNotificationEmail,
} from "@/emails/RefundRequest";

const resend = new Resend(process.env.RESEND_API_KEY);

const REASON_LABELS: Record<string, string> = {
  defective_damaged: "Defective or damaged goods",
  incorrect_items: "Incorrect items received",
  not_as_described: "Goods not as described",
  other: "Other",
};

const RefundSchema = z.object({
  orderId: z.string().uuid(),
  reason: z.enum([
    "defective_damaged",
    "incorrect_items",
    "not_as_described",
    "other",
  ]),
  dateReceived: z.string().min(1, "Please enter the date you received the goods."),
  details: z.string().max(1000, "Details must be 1000 characters or fewer.").optional(),
});

export async function submitRefundRequestAction(
  formData: FormData
): Promise<{ error: string } | { success: true }> {
  // 1. Auth check — must come before any DB call
  const session = await getSession();
  if (!session || !session.isBuyer) return { error: "Not authenticated." };

  // 2. Validate input
  const parsed = RefundSchema.safeParse({
    orderId: formData.get("orderId"),
    reason: formData.get("reason"),
    dateReceived: formData.get("dateReceived"),
    details: (formData.get("details") as string)?.trim() || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { orderId, reason, dateReceived, details } = parsed.data;

  // Lazy-load adminClient so it only appears in the function body after auth
  const { adminClient } = await import("@/lib/supabase/admin");

  // 3. Verify order belongs to this buyer (ownership check)
  const { data: order, error: orderError } = await adminClient
    .from("orders")
    .select("id, reference_number")
    .eq("id", orderId)
    .eq("profile_id", session.profileId)
    .single();

  if (orderError || !order) {
    return { error: "Order not found." };
  }

  // 4. Fetch buyer email and supplier config from DB
  const [profileResult, configResult] = await Promise.all([
    adminClient
      .from("profiles")
      .select("email, contact_name")
      .eq("id", session.profileId)
      .single(),
    adminClient.from("tenant_config").select("business_name").eq("id", 1).single(),
  ]);

  const buyerEmail = profileResult.data?.email ?? null;
  const contactName = profileResult.data?.contact_name ?? "Customer";
  const supplierName = configResult.data?.business_name ?? "AR Steel Manufacturing";
  const supplierEmail = process.env.SUPPLIER_EMAIL;
  const fromEmail = process.env.RESEND_FROM_EMAIL;

  if (!fromEmail || !supplierEmail) {
    console.error("[refund] Missing email env vars: RESEND_FROM_EMAIL or SUPPLIER_EMAIL");
    return { error: "Could not send refund request. Please contact us directly." };
  }

  const reasonLabel = REASON_LABELS[reason] ?? reason;
  const emailProps = {
    contactName,
    orderReference: order.reference_number,
    reasonLabel,
    dateReceived,
    details: details ?? null,
    supplierName,
    buyerEmail: buyerEmail ?? "unknown",
  };

  // 5. Send emails — fire-and-forget so a Resend failure never blocks the user
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sends: Promise<any>[] = [];

  if (buyerEmail) {
    sends.push(
      resend.emails.send({
        from: fromEmail,
        to: buyerEmail,
        subject: `Return Request Received — ${order.reference_number}`,
        react: BuyerRefundConfirmationEmail(emailProps),
      }).catch((err: unknown) => {
        console.error("[refund] buyer confirmation email failed:", err);
      })
    );
  }

  sends.push(
    resend.emails.send({
      from: fromEmail,
      to: supplierEmail,
      subject: `New Return Request — ${order.reference_number}`,
      react: BusinessRefundNotificationEmail(emailProps),
    }).catch((err: unknown) => {
      console.error("[refund] business notification email failed:", err);
    })
  );

  // Fire-and-forget: we return success before emails complete
  Promise.all(sends).catch((err: unknown) => {
    console.error("[refund] email send batch error:", err);
  });

  return { success: true };
}
