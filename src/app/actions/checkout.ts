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
import type { Database, Json } from "@/lib/supabase/types";
import { r2, computeLineItem, computeOrderTotals } from "@/lib/checkout/pricing";
import { resolveProductPrices, type CustomPriceEntry } from "@/lib/pricing/resolveClientPricing";
import { checkCreditStatus } from "@/lib/credit/checkCreditStatus";
import { checkActionRateLimit } from "@/lib/rate-limit";

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
  quantity: z.coerce.number().int().positive().max(10_000, "Quantity too large (max 10,000)"), // [L1]
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

  // 3. Buyer receipt — with proforma PDF attached
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
      attachments: [
        {
          filename: `Proforma-${order.reference_number}.pdf`,
          content: pdfBuffer,
        },
      ],
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
  orderNotes: string = "",
  clientSubmissionId?: string,
  addressId?: string | null
): Promise<{ error: string } | void> {
  // 1. Authenticate
  const session = await getSession();
  if (!session) redirect("/login" as Route);

  // [M7] Per-session rate limit on checkout
  const rl = await checkActionRateLimit(session.profileId, "checkout");
  if (!rl.allowed) {
    return { error: `Too many requests. Please try again in ${rl.retryAfter} seconds.` };
  }

  // [M6] Idempotency: validate and check for duplicate submissions
  let validSubmissionId: string | null = null;
  if (clientSubmissionId) {
    const subIdResult = z.string().uuid().safeParse(clientSubmissionId);
    if (subIdResult.success) {
      validSubmissionId = subIdResult.data;
      // Check if this submission ID already exists
      const { data: existing } = await adminClient
        .from("orders")
        .select("id")
        .eq("client_submission_id", validSubmissionId)
        .maybeSingle();

      if (existing) {
        // Already processed — redirect to the existing order's confirmation
        redirect(`/checkout/confirmed?orderId=${existing.id}` as Route);
      }
    }
  }

  // Fetch and validate the selected shipping address
  let shippingAddressSnapshot: Json | null = null;

  if (session.isBuyer) {
    if (!addressId) {
      // No address selected — check if any exist
      const { data: anyAddress } = await adminClient
        .from("addresses")
        .select("id, label, line1, line2, suburb, city, province, postal_code, country")
        .eq("profile_id", session.profileId)
        .eq("type", "shipping")
        .eq("is_default", true)
        .limit(1);

      if (!anyAddress || anyAddress.length === 0) {
        return { error: "address_required" };
      }
      // Use default address
      const defaultAddr = anyAddress[0];
      shippingAddressSnapshot = {
        label: defaultAddr.label,
        line1: defaultAddr.line1,
        line2: defaultAddr.line2,
        suburb: defaultAddr.suburb,
        city: defaultAddr.city,
        province: defaultAddr.province,
        postal_code: defaultAddr.postal_code,
        country: defaultAddr.country,
      };
    } else {
      // Validate ownership and fetch the selected address
      const { data: selectedAddress } = await adminClient
        .from("addresses")
        .select("id, label, line1, line2, suburb, city, province, postal_code, country")
        .eq("id", addressId)
        .eq("profile_id", session.profileId)
        .eq("type", "shipping")
        .single();

      if (!selectedAddress) {
        return { error: "Selected delivery address not found. Please choose another." };
      }

      shippingAddressSnapshot = {
        label: selectedAddress.label,
        line1: selectedAddress.line1,
        line2: selectedAddress.line2,
        suburb: selectedAddress.suburb,
        city: selectedAddress.city,
        province: selectedAddress.province,
        postal_code: selectedAddress.postal_code,
        country: selectedAddress.country,
      };
    }
  }

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

  // 4. Re-fetch ALL authoritative product fields from DB.
  //    SECURITY (C-1): price is fetched here and used server-side exclusively.
  //    The client-supplied unitPrice is intentionally discarded after validation.
  const productIds = items.map((i) => i.productId);
  const { data: productRows, error: productFetchError } = await adminClient
    .from("products")
    .select("id, price, cost_price, pack_size, discount_type, discount_threshold, discount_value, is_active")
    .in("id", productIds);

  if (productFetchError || !productRows) {
    return { error: "Failed to fetch product data." };
  }

  // Build a lookup map (price + cost_price + pack_size + discount rules)
  const productMap = new Map(productRows.map((p) => [p.id, p]));

  // 4b. Resolve custom pricing for this buyer
  const [{ data: rawCustomPrices }, { data: profilePricing }] = await Promise.all([
    adminClient
      .from("client_custom_prices")
      .select("product_id, custom_price")
      .eq("profile_id", session.profileId),
    adminClient
      .from("profiles")
      .select("client_discount_pct")
      .eq("id", session.profileId)
      .single(),
  ]);

  const customPrices: CustomPriceEntry[] = (rawCustomPrices ?? []).map((cp) => ({
    product_id: cp.product_id as string,
    custom_price: Number(cp.custom_price),
  }));
  const clientDiscountPct = Number(profilePricing?.client_discount_pct ?? 0);

  // Apply custom pricing to product rows
  const productsForResolver = productRows.map((p) => ({
    id: p.id,
    price: Number(p.price),
  }));
  const resolvedPrices = resolveProductPrices(productsForResolver, customPrices, clientDiscountPct);
  const resolvedPriceMap = new Map(resolvedPrices.map((r) => [r.id, r.price]));

  // Guard: every cart item must resolve to a live DB product.
  // A missing entry means the product was deleted between page load and submit.
  for (const item of items) {
    if (!productMap.has(item.productId)) {
      return { error: `Product "${item.name}" is no longer available. Please refresh your cart.` };
    }
  }

  // Guard: reject inactive products — may have been deactivated after cart load.
  for (const item of items) {
    const dbProduct = productMap.get(item.productId)!;
    if (dbProduct.is_active === false) {
      return { error: `"${item.name}" is no longer available. Please remove it from your cart.` };
    }
  }

  // 5. Compute per-item financials entirely from DB-verified values (C-1 FIX).
  //    item.unitPrice (client-supplied) is intentionally discarded — pricing.ts
  //    accepts only DB-sourced product fields.
  const lineItems = items.map((item) => {
    const dbProduct = productMap.get(item.productId)!;
    const resolvedPrice = resolvedPriceMap.get(item.productId) ?? Number(dbProduct.price);
    return computeLineItem({ ...dbProduct, price: resolvedPrice }, item.quantity);
  });

  const lineTotals = lineItems.map((li) => li.lineTotal);
  const discountSavings = items.map((item, idx) => {
    const resolvedPrice = resolvedPriceMap.get(item.productId) ?? Number(productMap.get(item.productId)!.price);
    return r2((resolvedPrice - lineItems[idx].effectiveUnitPrice) * item.quantity);
  });

  const { subtotal, totalDiscountAmount, vatAmount, totalAmount } =
    computeOrderTotals(lineTotals, discountSavings, vatRate);

  // 6. Determine role-dependent fields
  const is30Day = session.role === "buyer_30_day";
  const paymentMethod = is30Day ? ("30_day_account" as const) : ("eft" as const);
  const initialStatus = "pending" as const;

  // [M4] Credit limit enforcement for 30-day buyers.
  // Check that outstanding + this order doesn't exceed credit limit.
  if (is30Day) {
    const creditStatus = await checkCreditStatus(session.profileId);
    if (creditStatus.blocked) {
      if (creditStatus.reason === "overdue") {
        return { error: "You have overdue invoices. Please settle them before placing a new order." };
      }
      return { error: "This order would exceed your credit limit. Please contact your account manager." };
    }
    // Also check that adding this order's total wouldn't exceed the limit
    if (creditStatus.creditLimit !== null) {
      const projectedOutstanding = creditStatus.outstanding + totalAmount;
      if (projectedOutstanding > creditStatus.creditLimit) {
        return {
          error: `This order (R${totalAmount.toFixed(2)}) would bring your outstanding balance to R${projectedOutstanding.toFixed(2)}, exceeding your credit limit of R${creditStatus.creditLimit.toFixed(2)}.`,
        };
      }
    }
  }

  // 7. Validate order notes
  if (orderNotes.length > 1000) {
    return { error: "Order notes must be 1000 characters or fewer." };
  }
  const trimmedNotes = orderNotes.trim() || null;

  // 8. Build line-item payloads — unit_price is the DB-verified base price (C-1 fix).
  //    cost_price and pack_size are snapshotted from DB for daily report integrity.
  const orderItemPayloads = items.map((item, idx) => {
    const dbProduct = productMap.get(item.productId)!;
    return {
      product_id: item.productId,
      sku: item.sku,
      product_name: item.name,
      unit_price: resolvedPriceMap.get(item.productId) ?? Number(dbProduct.price),  // resolved custom/discounted price
      cost_price: dbProduct.cost_price ?? null, // snapshot for margin reporting
      pack_size: dbProduct.pack_size,           // snapshot for display integrity
      quantity: item.quantity,
      discount_pct: lineItems[idx].discountPct,
      line_total: lineItems[idx].lineTotal,
      variant_info: item.variantInfo ?? null,
    };
  });

  // 9. C-2 FIX: Atomic order creation via Postgres function.
  //    Both the orders row and all order_items rows are written in a single
  //    transaction. If either INSERT fails, Postgres rolls back automatically —
  //    no orphaned order rows, no compensating deletes.
  const { data: newOrderId, error: rpcError } = await adminClient.rpc(
    "create_order_atomic",
    {
      p_order: {
        profile_id: session.profileId,
        status: initialStatus,
        payment_method: paymentMethod,
        subtotal,
        discount_amount: totalDiscountAmount,
        vat_amount: vatAmount,
        total_amount: totalAmount,
        order_notes: trimmedNotes,
        shipping_address: shippingAddressSnapshot,
      },
      p_items: orderItemPayloads,
    }
  );

  if (rpcError || !newOrderId) {
    console.error("[checkout] create_order_atomic:", rpcError?.message);
    return { error: "Failed to create order. Please try again." };
  }

  // [M6] Stamp idempotency token onto the order (post-insert, non-blocking)
  if (validSubmissionId) {
    await adminClient
      .from("orders")
      .update({ client_submission_id: validSubmissionId } as Record<string, unknown>)
      .eq("id", newOrderId);
  }

  // 10. Fetch the full order row and items for PDF / email dispatch
  const [{ data: order }, { data: insertedItems }, { data: profile }] =
    await Promise.all([
      adminClient.from("orders").select("*").eq("id", newOrderId).single(),
      adminClient.from("order_items").select("*").eq("order_id", newOrderId),
      adminClient.from("profiles").select("*").eq("id", session.profileId).single(),
    ]);

  // 11. Broadcast to admin Realtime channel so the Order Ledger updates live.
  try {
    await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
      },
      body: JSON.stringify({
        messages: [{ topic: "admin-orders", event: "new_order", payload: { orderId: newOrderId } }],
      }),
    });
  } catch (err) {
    console.error("[broadcast] fetch failed:", err);
  }

  // 12. Dispatch fulfillment emails (non-blocking — failure must not abort checkout)
  if (order && insertedItems && profile) {
    dispatchFulfillmentEmails(order, insertedItems, profile, config).catch(
      (err: unknown) =>
        console.error("[fulfillment] unhandled error:", err)
    );
  }

  // 13. Divergent redirect
  if (is30Day) {
    redirect(`/checkout/confirmed?orderId=${newOrderId}` as Route);
  } else {
    redirect(`/checkout/payment?orderId=${newOrderId}` as Route);
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

  // [M5] Validate orderId as UUID and buyer_reference length
  const rawOrderId = formData.get("orderId") as string | null;
  const orderIdResult = z.string().uuid("Invalid order ID.").safeParse(rawOrderId);
  if (!orderIdResult.success) return { error: orderIdResult.error.issues[0].message };
  const orderId = orderIdResult.data;

  const rawRef = (formData.get("buyer_reference") as string | null)?.trim() || null;
  if (rawRef && rawRef.length > 100) return { error: "Reference too long (max 100 characters)." };
  const buyerReference = rawRef;

  // Verify this order belongs to the authenticated buyer
  const { data: order, error: fetchError } = await adminClient
    .from("orders")
    .select("id, total_amount, payment_method, profile_id, status")
    .eq("id", orderId)
    .eq("profile_id", session.profileId)
    .single();

  if (fetchError || !order) {
    return { error: "Order not found." };
  }

  // [M5] Only allow payment submission on pending orders
  if (order.status !== "pending") {
    return { error: "Payment can only be submitted for pending orders." };
  }

  // [M5] Reject if there's already a pending payment for this order
  const { data: existingPayment } = await adminClient
    .from("payments")
    .select("id")
    .eq("order_id", orderId)
    .eq("status", "pending")
    .limit(1)
    .maybeSingle();

  if (existingPayment) {
    return { error: "A payment submission is already pending for this order." };
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
