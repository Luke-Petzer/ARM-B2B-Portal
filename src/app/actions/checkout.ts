"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { Resend } from "resend";
import { getSession } from "@/lib/auth/session";
import { adminClient } from "@/lib/supabase/admin";
import { renderInvoiceToBuffer } from "@/lib/pdf/invoice";
import SupplierInvoice from "@/emails/SupplierInvoice";
import BuyerReceipt from "@/emails/BuyerReceipt";
import type { Route } from "next";
import type { Database } from "@/lib/supabase/types";

// ---------------------------------------------------------------------------
// Validation schema
// ---------------------------------------------------------------------------

const CartItemSchema = z.object({
  productId: z.string().min(1),
  sku: z.string().min(1),
  name: z.string().min(1),
  // coerce handles the edge case where React's Server Action serialization
  // delivers a numeric string instead of a JS number
  unitPrice: z.coerce.number().nonnegative(),
  quantity: z.coerce.number().int().positive(),
  primaryImageUrl: z.string().nullable().optional(),
  variantInfo: z
    .object({ label: z.string(), value: z.string() })
    .nullable()
    .optional(),
  // Discount metadata (UI display only — server re-fetches from DB for price computation)
  discountType: z.enum(["percentage", "fixed"]).nullable().optional(),
  discountThreshold: z.coerce.number().int().positive().nullable().optional(),
  discountValue: z.coerce.number().nonnegative().nullable().optional(),
});

const CheckoutSchema = z.array(CartItemSchema).min(1, "Cart is empty");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Round to 2 decimal places — matches PostgreSQL ROUND(x, 2) for normal values. */
function r2(n: number): number {
  return parseFloat(n.toFixed(2));
}

const ZAR = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
  minimumFractionDigits: 2,
});

type TenantConfig = Database["public"]["Tables"]["tenant_config"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Order = Database["public"]["Tables"]["orders"]["Row"];
type OrderItem = Database["public"]["Tables"]["order_items"]["Row"];

// ---------------------------------------------------------------------------
// Fulfillment — PDF generation + email dispatch
// ---------------------------------------------------------------------------

/**
 * Generates the invoice PDF and dispatches both emails.
 * Runs after DB writes are committed. Any failure is logged but must NOT
 * abort the checkout — the order is already safely persisted.
 */
async function dispatchFulfillmentEmails(
  order: Order,
  items: OrderItem[],
  profile: Profile,
  config: TenantConfig
): Promise<void> {
  const resendKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  const supplierEmail =
    process.env.SUPPLIER_EMAIL ?? config.email_from_address;

  if (!resendKey || !fromEmail) {
    console.warn(
      "[fulfillment] RESEND_API_KEY or RESEND_FROM_EMAIL not set — skipping emails"
    );
    return;
  }

  // 1. Generate PDF buffer
  const pdfBuffer = await renderInvoiceToBuffer({ order, items, profile, config });

  const resend = new Resend(resendKey);
  const fromAddress = config.email_from_name
    ? `${config.email_from_name} <${fromEmail}>`
    : fromEmail;

  const paymentLabel =
    order.payment_method === "eft" ? "EFT" : "30-Day Account";
  const totalFormatted = ZAR.format(Number(order.total_amount));

  // 2. Supplier email — with PDF attached
  if (supplierEmail) {
    const { error } = await resend.emails.send({
      from: fromAddress,
      to: [supplierEmail],
      subject: `New Order #${order.reference_number} — ${profile.business_name} (${totalFormatted})`,
      react: SupplierInvoice({
        buyerBusinessName: profile.business_name,
        buyerAccountNumber: profile.account_number,
        buyerEmail: profile.email,
        orderReference: order.reference_number,
        totalFormatted,
        orderDate: order.created_at,
        paymentMethod: paymentLabel as "EFT" | "30-Day Account",
        supplierName: config.business_name,
        orderNotes: order.order_notes ?? null,
      }),
      attachments: [
        {
          filename: `Proforma-${order.reference_number}.pdf`,
          content: pdfBuffer,
        },
      ],
    });
    if (error) {
      console.error("[fulfillment] supplier email:", error.message);
    }
  }

  // 3. Buyer receipt — no attachment
  if (profile.email) {
    const { error } = await resend.emails.send({
      from: fromAddress,
      to: [profile.email],
      subject: `Order Confirmed — #${order.reference_number}`,
      react: BuyerReceipt({
        contactName: profile.contact_name,
        orderReference: order.reference_number,
        totalFormatted,
        orderDate: order.created_at,
        paymentMethod: paymentLabel as "EFT" | "30-Day Account",
        supplierName: config.business_name,
        supportEmail: config.support_email,
        orderNotes: order.order_notes ?? null,
      }),
    });
    if (error) {
      console.error("[fulfillment] buyer receipt:", error.message);
    }
  }
}

// ---------------------------------------------------------------------------
// checkoutAction
// ---------------------------------------------------------------------------

/**
 * Validates the cart, writes order + order_items atomically, dispatches
 * fulfillment emails, then diverges:
 *   buyer_default  → /checkout/payment?orderId=...  (EFT flow)
 *   buyer_30_day   → /checkout/confirmed?orderId=... (pending admin approval)
 *
 * Returns { error } on validation / DB failure (caller shows the message).
 * On success redirect() is called — function never returns to the client.
 */
export async function checkoutAction(
  rawItems: unknown,
  orderNotes: string = ""
): Promise<{ error: string } | void> {
  // 1. Authenticate
  const session = await getSession();
  if (!session) redirect("/login" as Route);

  // 2. Validate cart payload (passed from client Zustand store)
  const parsed = CheckoutSchema.safeParse(rawItems);
  if (!parsed.success) {
    console.error("[checkout] Zod validation failed:", JSON.stringify(parsed.error.issues, null, 2));
    return { error: "Invalid cart data. Please refresh and try again." };
  }
  const items = parsed.data;

  // 3. Fetch full tenant config (vat_rate + email/bank fields for fulfillment)
  const { data: config } = await adminClient
    .from("tenant_config")
    .select("*")
    .eq("id", 1)
    .single();

  if (!config) {
    return { error: "System configuration error. Please contact support." };
  }

  const vatRate = Number(config.vat_rate ?? 0.15);

  // 4. Re-fetch discount rules from DB for all product IDs (security: never trust client discount values)
  const productIds = items.map((i) => i.productId);
  const { data: productRows, error: productFetchError } = await adminClient
    .from("products")
    .select("id, cost_price, pack_size, discount_type, discount_threshold, discount_value")
    .in("id", productIds);

  if (productFetchError || !productRows) {
    return { error: "Failed to fetch product discount data." };
  }

  // Build a lookup map (includes cost_price for order_items snapshot)
  const discountMap = new Map(productRows.map((p) => [p.id, p]));

  function computeEffectiveUnitPrice(
    item: z.infer<typeof CartItemSchema>,
    dbProduct: { discount_type: string | null; discount_threshold: number | null; discount_value: number | null } | undefined
  ): number {
    if (
      !dbProduct ||
      !dbProduct.discount_type ||
      dbProduct.discount_value == null ||
      dbProduct.discount_threshold == null ||
      item.quantity < dbProduct.discount_threshold
    )
      return item.unitPrice;
    const val = Number(dbProduct.discount_value);
    if (!isFinite(val)) return item.unitPrice;
    if (dbProduct.discount_type === "percentage") {
      return Math.max(0, parseFloat((item.unitPrice * (1 - val / 100)).toFixed(2)));
    }
    // fixed
    return Math.max(0, parseFloat((item.unitPrice - val).toFixed(2)));
  }

  // 5. Compute per-item effective prices and financials using DB-verified discount rules
  const effectivePrices = items.map((item) =>
    computeEffectiveUnitPrice(item, discountMap.get(item.productId))
  );
  const lineTotals = items.map((item, idx) =>
    r2(effectivePrices[idx] * item.quantity)
  );
  const subtotal = r2(lineTotals.reduce((s, lt) => s + lt, 0));
  const totalDiscountAmount = r2(
    items.reduce(
      (acc, item, idx) =>
        acc + r2((item.unitPrice - effectivePrices[idx]) * item.quantity),
      0
    )
  );
  const vatAmount = r2(subtotal * vatRate);
  const totalAmount = r2(subtotal + vatAmount);

  // 6. Determine role-dependent fields
  const is30Day = session.role === "buyer_30_day";
  const paymentMethod = is30Day ? ("30_day_account" as const) : ("eft" as const);
  const initialStatus = "pending" as const;

  // 7. Insert order row
  if (orderNotes.length > 1000) {
    return { error: "Delivery instructions must be 1000 characters or fewer." };
  }
  const trimmedNotes = orderNotes.trim() || null;
  const { data: order, error: orderError } = await adminClient
    .from("orders")
    .insert({
      profile_id: session.profileId,
      status: initialStatus,
      payment_method: paymentMethod,
      subtotal,
      discount_amount: totalDiscountAmount,
      vat_amount: vatAmount,
      total_amount: totalAmount,
      order_notes: trimmedNotes,
    })
    .select("*")
    .single();

  if (orderError || !order) {
    console.error("[checkout] order insert:", orderError?.message);
    return { error: "Failed to create order. Please try again." };
  }

  // 8. Insert order_items
  const orderItemRows = items.map((item, idx) => {
    const discountSaving = item.unitPrice - effectivePrices[idx];
    const discountPct = item.unitPrice > 0
      ? parseFloat(((discountSaving / item.unitPrice) * 100).toFixed(4))
      : 0;
    const dbProduct = discountMap.get(item.productId);
    return {
      order_id: order.id,
      product_id: item.productId,
      sku: item.sku,
      product_name: item.name,
      unit_price: item.unitPrice,
      cost_price: dbProduct?.cost_price ?? null, // snapshot at order time for daily report
      pack_size: dbProduct?.pack_size ?? 1,
      quantity: item.quantity,
      discount_pct: discountPct,
      line_total: lineTotals[idx],
      variant_info: item.variantInfo ?? null,
    };
  });

  const { data: insertedItems, error: itemsError } = await adminClient
    .from("order_items")
    .insert(orderItemRows)
    .select("*");

  if (itemsError || !insertedItems) {
    // Compensating delete — order_items failed, order is unusable
    await adminClient.from("orders").delete().eq("id", order.id);
    console.error("[checkout] order_items insert:", itemsError?.message);
    return { error: "Failed to save order items. Please try again." };
  }

  // 8. Fetch buyer profile for PDF / emails
  const { data: profile } = await adminClient
    .from("profiles")
    .select("*")
    .eq("id", session.profileId)
    .single();

  // 9. Broadcast to admin Realtime channel so the Order Ledger updates live.
  try {
    await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
      },
      body: JSON.stringify({
        messages: [{ topic: "admin-orders", event: "new_order", payload: { orderId: order.id } }],
      }),
    });
  } catch (err) {
    console.error("[broadcast] fetch failed:", err);
  }

  // 10. Dispatch fulfillment emails (non-blocking — failure must not abort checkout)
  if (profile) {
    dispatchFulfillmentEmails(order, insertedItems, profile, config).catch(
      (err: unknown) =>
        console.error("[fulfillment] unhandled error:", err)
    );
  }

  // 10. Divergent redirect
  if (is30Day) {
    redirect(`/checkout/confirmed?orderId=${order.id}` as Route);
  } else {
    redirect(`/checkout/payment?orderId=${order.id}` as Route);
  }
}

// ---------------------------------------------------------------------------
// markPaymentSubmittedAction
// ---------------------------------------------------------------------------

/**
 * Called from the EFT payment page when the buyer clicks "I have made payment".
 * Records a pending payment submission and redirects to the confirmation page.
 * The order remains in 'pending' status until an admin verifies via the admin
 * dashboard (Phase 5).
 */
export async function markPaymentSubmittedAction(
  formData: FormData
): Promise<{ error: string } | void> {
  const session = await getSession();
  if (!session) redirect("/login" as Route);

  const orderId = formData.get("orderId") as string | null;
  if (!orderId) return { error: "Missing order ID." };

  const buyerReference = (formData.get("buyer_reference") as string | null)?.trim() || null;

  // Verify this order belongs to the authenticated buyer
  const { data: order, error: fetchError } = await adminClient
    .from("orders")
    .select("id, total_amount, payment_method, profile_id")
    .eq("id", orderId)
    .eq("profile_id", session.profileId)
    .single();

  if (fetchError || !order) {
    return { error: "Order not found." };
  }

  // Save PO number to buyer_reference if supplied
  if (buyerReference) {
    await adminClient
      .from("orders")
      .update({ buyer_reference: buyerReference })
      .eq("id", orderId);
  }

  // Insert a pending payment submission record
  const { error: paymentError } = await adminClient.from("payments").insert({
    order_id: order.id,
    payment_method: order.payment_method as "eft" | "30_day_account",
    amount: Number(order.total_amount),
    status: "pending",
  });

  if (paymentError) {
    console.error("[payment] insert:", paymentError.message);
    return { error: "Failed to submit order. Please try again." };
  }

  redirect(`/checkout/confirmed?orderId=${orderId}` as Route);
}
