"use server";

import { redirect } from "next/navigation";
import { revalidatePath, revalidateTag } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { adminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { Resend } from "resend";
import ClientStatement from "@/emails/ClientStatement";
import DispatchNotification from "@/emails/DispatchNotification";
import OrderApprovedNotification from "@/emails/OrderApprovedNotification";
import { renderDispatchSheetToBuffer } from "@/lib/pdf/invoice";
import type { Route } from "next";
import { z } from "zod";
import type { Database } from "@/lib/supabase/types";

type OrderStatus = Database["public"]["Tables"]["orders"]["Row"]["status"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function requireAdmin() {
  const session = await getSession();
  if (!session?.isAdmin) redirect("/admin/login" as Route);
  return session;
}

/**
 * Resolves a category ID for use on a product.
 *
 * - If `categoryIdRaw` is "none" or empty → returns null (no category)
 * - If `categoryIdRaw` is "create_new" and `newCategoryName` is provided →
 *   inserts a new category row, returns the new UUID
 * - Otherwise treats `categoryIdRaw` as an existing category UUID
 *
 * Returns `{ id: string | null }` on success, `{ error: string }` on failure.
 */
async function resolveOrCreateCategoryId(
  categoryIdRaw: string | null | undefined,
  newCategoryName: string | null | undefined
): Promise<{ id: string | null } | { error: string }> {
  if (!categoryIdRaw || categoryIdRaw === "none") return { id: null };

  if (categoryIdRaw === "create_new") {
    const trimmedName = newCategoryName?.trim();
    if (!trimmedName) return { error: "A name is required when creating a new category." };

    // Generate a URL-safe slug: lowercase, collapse non-alphanumeric runs to hyphens, trim hyphens
    const slug = trimmedName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    // Get current max display_order to append new category at the end
    const { data: maxRow } = await adminClient
      .from("categories")
      .select("display_order")
      .order("display_order", { ascending: false })
      .limit(1)
      .single();
    const nextOrder = ((maxRow?.display_order as number | null) ?? 0) + 1;

    const { data, error } = await adminClient
      .from("categories")
      .insert({ name: trimmedName, slug, display_order: nextOrder, is_active: true })
      .select("id")
      .single();

    if (error) {
      console.error("[admin] createCategory:", error.message);
      if (error.code === "23505") return { error: `A category with the name "${trimmedName}" or its slug already exists.` };
      return { error: "Failed to create category. Please try again." };
    }

    return { id: data.id };
  }

  // Existing category UUID
  return { id: categoryIdRaw };
}

// ---------------------------------------------------------------------------
// assignOrderAction
// ---------------------------------------------------------------------------

/**
 * Assigns the current admin as the handler for an order.
 * Only succeeds if the order is currently unassigned — immutable once set.
 */
export async function assignOrderAction(
  formData: FormData
): Promise<{ error: string } | void> {
  const session = await requireAdmin();

  const orderId = formData.get("orderId") as string | null;
  if (!orderId) return { error: "Missing order ID." };

  const { data, error } = await adminClient
    .from("orders")
    .update({ assigned_to: session.profileId })
    .eq("id", orderId)
    .is("assigned_to", null) // only assign if currently unassigned
    .select("id");

  if (error) {
    console.error("[admin] assignOrder:", error.message);
    return { error: "Failed to assign order. Please try again." };
  }

  if (!data || data.length === 0) {
    return { error: "Order is already assigned to another employee." };
  }
}

// ---------------------------------------------------------------------------
// updateAdminRoleAction
// ---------------------------------------------------------------------------

/**
 * Updates an admin user's sub-role (manager / employee).
 * Restricted to the super admin via ADMIN_SUPER_EMAIL env var.
 */
export async function updateAdminRoleAction(
  adminProfileId: string,
  role: "manager" | "employee"
): Promise<{ error: string } | void> {
  await requireAdmin();

  // Only the super admin may change roles
  const session = await getSession();
  if (!session?.isSuperAdmin) {
    return { error: "Unauthorised: only the super admin can update admin roles." };
  }

  const { error } = await adminClient
    .from("profiles")
    .update({ admin_role: role })
    .eq("id", adminProfileId)
    .eq("role", "admin");

  if (error) {
    console.error("[admin] updateAdminRole:", error.message);
    return { error: "Failed to update admin role. Please try again." };
  }

  revalidatePath("/admin/settings");
}

// ---------------------------------------------------------------------------
// sendDispatchEmail (internal — non-fatal, fire-and-forget)
// ---------------------------------------------------------------------------

async function sendDispatchEmail(orderId: string): Promise<void> {
  try {
    // 1. Fetch order
    const { data: order } = await adminClient
      .from("orders")
      .select("id, reference_number, created_at, order_notes, delivery_instructions, profile_id")
      .eq("id", orderId)
      .single();

    if (!order) {
      console.warn("[dispatch] order not found:", orderId);
      return;
    }

    // 2. Fetch order items
    const { data: items } = await adminClient
      .from("order_items")
      .select("sku, product_name, quantity")
      .eq("order_id", orderId);

    // 3. Fetch buyer profile
    const { data: profile } = await adminClient
      .from("profiles")
      .select("business_name, contact_name")
      .eq("id", order.profile_id)
      .single();

    if (!profile) {
      console.warn("[dispatch] profile not found for order:", orderId);
      return;
    }

    // 4. Fetch tenant config
    const { data: config } = await adminClient
      .from("tenant_config")
      .select("dispatch_email, business_name, email_from_name")
      .eq("id", 1)
      .single();

    const dispatchEmail = config?.dispatch_email?.trim() || null;
    if (!dispatchEmail) {
      console.warn("[dispatch] dispatch_email not configured — skipping dispatch notification");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dispatchEmail)) {
      console.warn("[dispatch] dispatch_email is not a valid email address:", dispatchEmail);
      return;
    }

    const resendKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.RESEND_FROM_EMAIL;
    if (!resendKey || !fromEmail) {
      console.warn("[dispatch] RESEND_API_KEY or RESEND_FROM_EMAIL not set — skipping dispatch email");
      return;
    }

    // 5. Render dispatch sheet PDF
    const dispatchItems = (items ?? []).map((i) => ({
      sku: i.sku,
      product_name: i.product_name,
      quantity: i.quantity,
    }));

    const pdfBuffer = await renderDispatchSheetToBuffer({
      order: {
        reference_number: order.reference_number,
        created_at: order.created_at,
        order_notes: order.order_notes ?? null,
      },
      items: dispatchItems,
      profile: {
        business_name: profile.business_name,
        contact_name: profile.contact_name ?? "",
      },
      deliveryAddress: order.delivery_instructions ?? null,
    });

    // 6. Send email
    const supplierName = config?.business_name ?? "Your Supplier";
    const fromAddress = config?.email_from_name
      ? `${config.email_from_name} <${fromEmail}>`
      : fromEmail;

    const resend = new Resend(resendKey);
    const { error } = await resend.emails.send({
      from: fromAddress,
      to: [dispatchEmail],
      subject: `Dispatch: ${order.reference_number}`,
      react: DispatchNotification({
        orderReference: order.reference_number,
        clientBusinessName: profile.business_name,
        orderDate: order.created_at,
        itemCount: dispatchItems.length,
        orderNotes: order.order_notes ?? null,
        supplierName,
      }),
      attachments: [
        {
          filename: `Dispatch-${order.reference_number}.pdf`,
          content: pdfBuffer,
        },
      ],
    });

    if (error) {
      console.error("[dispatch] email send failed:", error.message);
    }
  } catch (err) {
    console.error("[dispatch] sendDispatchEmail error:", err);
  }
}

// ---------------------------------------------------------------------------
// sendOrderApprovedEmail (internal — non-fatal, fire-and-forget)
// ---------------------------------------------------------------------------

async function sendOrderApprovedEmail(orderId: string): Promise<void> {
  try {
    // 1. Fetch order
    const { data: order } = await adminClient
      .from("orders")
      .select("id, reference_number, confirmed_at, created_at, profile_id")
      .eq("id", orderId)
      .single();

    if (!order) {
      console.warn("[approved] order not found:", orderId);
      return;
    }

    // 2. Fetch buyer profile (email + name)
    const { data: profile } = await adminClient
      .from("profiles")
      .select("email, contact_name")
      .eq("id", order.profile_id)
      .single();

    if (!profile?.email) {
      console.warn("[approved] buyer email not found for order:", orderId);
      return;
    }

    // 3. Fetch tenant config for branding + from address
    const { data: config } = await adminClient
      .from("tenant_config")
      .select("business_name, support_email, email_from_name")
      .eq("id", 1)
      .single();

    const resendKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.RESEND_FROM_EMAIL;
    if (!resendKey || !fromEmail) {
      console.warn("[approved] RESEND_API_KEY or RESEND_FROM_EMAIL not set — skipping approval email");
      return;
    }

    const supplierName = config?.business_name ?? "Your Supplier";
    const fromAddress = config?.email_from_name
      ? `${config.email_from_name} <${fromEmail}>`
      : fromEmail;
    const approvedAt = order.confirmed_at ?? order.created_at;

    // 4. Send email
    const resend = new Resend(resendKey);
    const { error } = await resend.emails.send({
      from: fromAddress,
      to: [profile.email],
      subject: `Order ${order.reference_number} Approved — Now with Dispatch`,
      react: OrderApprovedNotification({
        contactName: profile.contact_name ?? "Valued Customer",
        orderReference: order.reference_number,
        approvedAt,
        supplierName,
        supportEmail: config?.support_email ?? null,
      }),
    });

    if (error) {
      console.error("[approved] email send failed:", error.message);
    }
  } catch (err) {
    console.error("[approved] sendOrderApprovedEmail error:", err);
  }
}

// ---------------------------------------------------------------------------
// approveOrderAction
// ---------------------------------------------------------------------------

/**
 * Approves an order. Handles two transitions:
 *
 * 1. pending → confirmed  (first approval — fires dispatch email)
 *    approvalType = 'paid'            → EFT verified / 30-day settling immediately
 *    approvalType = 'credit_approved' → 30-day order approved on credit
 *
 * 2. confirmed + credit_approved → confirmed + paid  (credit client later settles)
 *    approvalType = 'paid' (implied — no dispatch email, already sent)
 *
 * confirmed_at is always set on first approval so daily revenue reports
 * attribute revenue to the approval date.
 */
export async function approveOrderAction(
  formData: FormData
): Promise<{ error: string } | void> {
  await requireAdmin();

  const orderId = formData.get("orderId") as string | null;
  const approvalTypeRaw = (formData.get("approvalType") as string | null) ?? "paid";
  if (!orderId) return { error: "Missing order ID." };
  if (approvalTypeRaw !== "paid" && approvalTypeRaw !== "credit_approved") {
    return { error: "Invalid approval type." };
  }
  // Narrowed to the literal union after the guard above — safe to assert.
  const approvalType = approvalTypeRaw as "paid" | "credit_approved";

  // Fetch current state to determine which transition applies
  const { data: currentOrder, error: fetchError } = await adminClient
    .from("orders")
    .select("id, status, payment_status")
    .eq("id", orderId)
    .single();

  if (fetchError || !currentOrder) {
    return { error: "Order not found." };
  }

  const isFirstApproval = currentOrder.status === "pending";
  const isCreditSettlement =
    currentOrder.status === "confirmed" &&
    currentOrder.payment_status === "credit_approved";

  if (!isFirstApproval && !isCreditSettlement) {
    return { error: "Order cannot be approved in its current state." };
  }

  const updatePayload = isFirstApproval
    ? {
        status: "confirmed" as const,
        payment_status: approvalType,
        confirmed_at: new Date().toISOString(),
      }
    : {
        payment_status: "paid" as const,
      };

  const { error } = await adminClient
    .from("orders")
    .update(updatePayload)
    .eq("id", orderId);

  if (error) {
    console.error("[admin] approveOrder:", error.message);
    return { error: "Failed to approve order. Please try again." };
  }

  revalidatePath("/admin");

  if (isFirstApproval) {
    sendDispatchEmail(orderId).catch((err: unknown) =>
      console.error("[dispatch] unhandled error:", err)
    );
  }

  // Notify the buyer on every approval (first approval or credit settlement)
  sendOrderApprovedEmail(orderId).catch((err: unknown) =>
    console.error("[approved] unhandled error:", err)
  );
}

// ---------------------------------------------------------------------------
// cancelOrderAction
// ---------------------------------------------------------------------------

/**
 * Cancels a pending order.
 * Only allowed when the order is still in "pending" status — once confirmed
 * (i.e. payment has been recognised), cancellation must be handled manually.
 */
export async function cancelOrderAction(
  formData: FormData
): Promise<{ error: string } | void> {
  await requireAdmin();

  const orderId = formData.get("orderId") as string | null;
  if (!orderId) return { error: "Missing order ID." };

  const { data: currentOrder, error: fetchError } = await adminClient
    .from("orders")
    .select("id, status")
    .eq("id", orderId)
    .single();

  if (fetchError || !currentOrder) return { error: "Order not found." };

  if (currentOrder.status !== "pending") {
    return { error: "Only pending orders can be cancelled." };
  }

  const { error } = await adminClient
    .from("orders")
    .update({
      status: "cancelled" as const,
      cancelled_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  if (error) {
    console.error("[admin] cancelOrder:", error.message);
    return { error: "Failed to cancel order. Please try again." };
  }

  revalidatePath("/admin");
}

// ---------------------------------------------------------------------------
// exportOrdersCsvAction
// ---------------------------------------------------------------------------

/**
 * Streams a CSV of all orders matching the provided filters.
 * Returns the CSV string to the client for download.
 *
 * Filters (all optional, passed as FormData):
 *   status   — OrderStatus value
 *   dateFrom — ISO date string
 *   dateTo   — ISO date string
 *   search   — reference_number or business_name substring
 */
export async function exportOrdersCsvAction(
  formData: FormData
): Promise<{ csv: string } | { error: string }> {
  await requireAdmin();

  const status = (formData.get("status") as string | null) || null;
  const dateFrom = (formData.get("dateFrom") as string | null) || null;
  const dateTo = (formData.get("dateTo") as string | null) || null;
  const search = (formData.get("search") as string | null) || null;

  // Build query — disambiguate profiles join since orders now has two FKs to profiles
  let query = adminClient
    .from("orders")
    .select(
      `id, reference_number, created_at, status, payment_method,
       subtotal, vat_amount, total_amount,
       buyer:profiles!profile_id ( business_name, account_number, email ),
       order_items ( sku, product_name, quantity, unit_price, line_total )`
    )
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status as OrderStatus);
  if (dateFrom) query = query.gte("created_at", dateFrom);
  if (dateTo) query = query.lte("created_at", dateTo);

  const { data: orders, error } = await query;

  if (error) {
    console.error("[admin] exportCsv:", error.message);
    return { error: "Failed to fetch orders for export." };
  }

  // Build CSV rows
  const header = [
    "Order Date",
    "Reference",
    "Account No.",
    "Business Name",
    "Email",
    "SKU",
    "Product",
    "Qty",
    "Unit Price",
    "Line Total",
    "Subtotal",
    "VAT",
    "Total",
    "Payment Method",
    "Status",
  ].join(",");

  type RawProfile = { business_name: string; account_number: string | null; email: string | null };
  type RawItem = { sku: string; product_name: string; quantity: number; unit_price: number; line_total: number };

  const rows: string[] = [header];

  for (const order of orders ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const profile = (order as any).buyer as RawProfile | null;
    const items = (order.order_items as RawItem[]) ?? [];
    const bizName = profile?.business_name ?? "";
    const accNo = profile?.account_number ?? "";
    const email = profile?.email ?? "";
    const date = new Date(order.created_at).toLocaleDateString("en-ZA");

    if (items.length === 0) {
      rows.push(
        [
          date, order.reference_number, accNo, csvEsc(bizName), email,
          "", "", "", "", "",
          order.subtotal, order.vat_amount, order.total_amount,
          order.payment_method, order.status,
        ].join(",")
      );
    } else {
      items.forEach((item, idx) => {
        rows.push(
          [
            idx === 0 ? date : "",
            idx === 0 ? order.reference_number : "",
            idx === 0 ? accNo : "",
            idx === 0 ? csvEsc(bizName) : "",
            idx === 0 ? email : "",
            item.sku,
            csvEsc(item.product_name),
            item.quantity,
            item.unit_price,
            item.line_total,
            idx === 0 ? order.subtotal : "",
            idx === 0 ? order.vat_amount : "",
            idx === 0 ? order.total_amount : "",
            idx === 0 ? order.payment_method : "",
            idx === 0 ? order.status : "",
          ].join(",")
        );
      });
    }
  }

  return { csv: rows.join("\n") };
}

function csvEsc(value: string): string {
  // [M10] Neutralise CSV formula injection (CWE-1236): prefix dangerous
  // leading characters with a single quote so spreadsheet apps treat the
  // cell as a literal string instead of a formula.
  let v = value;
  if (/^[=+\-@\t\r]/.test(v)) {
    v = `'${v}`;
  }
  if (v.includes(",") || v.includes('"') || v.includes("\n") || v.includes("'")) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

// ---------------------------------------------------------------------------
// uploadProductImageAction
// ---------------------------------------------------------------------------

/**
 * Accepts a raw File (as FormData) from the ProductDrawer,
 * uploads it to the 'product-images' Supabase Storage bucket using the
 * service-role client (bypasses RLS), and returns the permanent public URL.
 *
 * Bucket must be set to Public in Supabase Dashboard, or add a policy:
 *   CREATE POLICY "Public read" ON storage.objects FOR SELECT USING (bucket_id = 'product-images');
 */
export async function uploadProductImageAction(
  formData: FormData
): Promise<{ url: string } | { error: string }> {
  await requireAdmin();

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { error: "No file provided." };

  // [H3] Server-side size limit — 2 MB max
  const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB
  if (file.size > MAX_FILE_SIZE) {
    return { error: "File exceeds 2 MB limit." };
  }

  // [H3] Magic-byte validation — never trust client MIME type or filename
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const header = buffer.subarray(0, 12);

  type MagicEntry = { magic: number[]; offset: number; ext: string; mime: string };
  const MAGIC_TABLE: MagicEntry[] = [
    { magic: [0xFF, 0xD8, 0xFF],             offset: 0, ext: "jpg",  mime: "image/jpeg" },
    { magic: [0x89, 0x50, 0x4E, 0x47],       offset: 0, ext: "png",  mime: "image/png"  },
    { magic: [0x52, 0x49, 0x46, 0x46],       offset: 0, ext: "webp", mime: "image/webp" }, // RIFF....WEBP
  ];

  const matched = MAGIC_TABLE.find((entry) =>
    entry.magic.every((byte, i) => header[entry.offset + i] === byte)
  );

  // For WebP, also verify the WEBP signature at bytes 8-11
  if (matched?.ext === "webp") {
    const webpSig = [0x57, 0x45, 0x42, 0x50]; // "WEBP"
    const isWebp = webpSig.every((byte, i) => header[8 + i] === byte);
    if (!isWebp) return { error: "Only JPEG, PNG, and WebP images are allowed." };
  }

  if (!matched) {
    return { error: "Only JPEG, PNG, and WebP images are allowed." };
  }

  // [H3] Server-generated extension from magic bytes — ignore client filename
  const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${matched.ext}`;
  const filePath = `products/${uniqueName}`;

  const { error: uploadError } = await adminClient.storage
    .from("product-images")
    .upload(filePath, buffer, {
      contentType: matched.mime, // [H3] Use verified MIME from magic bytes
      upsert: true,
    });

  if (uploadError) {
    console.error("[admin] uploadProductImage:", uploadError.message);
    return { error: `Storage upload failed: ${uploadError.message}` };
  }

  const { data } = adminClient.storage
    .from("product-images")
    .getPublicUrl(filePath);

  revalidatePath("/admin/products");

  return { url: data.publicUrl };
}

// ---------------------------------------------------------------------------
// createProductAction
// ---------------------------------------------------------------------------

export async function createProductAction(
  formData: FormData
): Promise<{ error: string } | { id: string }> {
  await requireAdmin();

  const sku = ((formData.get("sku") as string) ?? "").trim();
  const name = ((formData.get("name") as string) ?? "").trim();
  const description = (formData.get("description") as string | null)?.trim() ?? null;
  const details = (formData.get("details") as string | null)?.trim() ?? null;
  const priceRaw = parseFloat(formData.get("price") as string);
  const categoryIdRaw = (formData.get("category_id") as string | null)?.trim();
  const newCategoryName = (formData.get("new_category_name") as string | null)?.trim() || null;
  const trackStock = formData.get("track_stock") === "true";
  const stockQty = parseInt(formData.get("stock_qty") as string, 10) || 0;
  const imageUrl = (formData.get("image_url") as string | null)?.trim() || null;
  const discountTypeRaw = (formData.get("discount_type") as string | null)?.trim();
  const discountType =
    !discountTypeRaw || discountTypeRaw === "none"
      ? null
      : (discountTypeRaw as "percentage" | "fixed");
  const discountThreshold = formData.get("discount_threshold")
    ? parseInt(formData.get("discount_threshold") as string, 10) || null
    : null;
  const discountValue = formData.get("discount_value")
    ? parseFloat(formData.get("discount_value") as string)
    : null;
  const costPriceRaw = formData.get("cost_price") as string | null;
  const costPrice =
    costPriceRaw && costPriceRaw.trim() !== ""
      ? parseFloat(costPriceRaw)
      : null;
  const packSize = parseInt(formData.get("pack_size") as string, 10);
  if (!packSize || packSize < 1) {
    return { error: "Pack size must be a whole number of 1 or greater." };
  }

  if (discountType && (!discountThreshold || discountValue === null)) {
    return { error: "Bulk discount requires a minimum quantity and discount value." };
  }
  if (!discountType && (discountThreshold || discountValue !== null)) {
    return { error: "Select a discount type or clear the discount fields." };
  }

  if (!sku || !name || isNaN(priceRaw) || priceRaw < 0) {
    return { error: "SKU, name, and a valid price are required." };
  }

  // [M11] Server-side bounds validation
  if (name.length > 200) return { error: "Product name too long (max 200 characters)." };
  if (details && details.length > 5000) return { error: "Details too long (max 5000 characters)." };
  if (description && description.length > 2000) return { error: "Description too long (max 2000 characters)." };
  if (!Number.isFinite(priceRaw) || priceRaw > 1e7) return { error: "Invalid price (max R10,000,000)." };
  if (packSize > 10_000) return { error: "Pack size too large (max 10,000)." };
  if (stockQty < 0 || stockQty > 10_000) return { error: "Stock quantity out of range (0–10,000)." };
  if (costPrice !== null && (!Number.isFinite(costPrice) || costPrice < 0 || costPrice > 1e7))
    return { error: "Invalid cost price." };
  if (discountType === "percentage" && discountValue !== null && discountValue > 100)
    return { error: "Percentage discount cannot exceed 100%." };
  if (discountValue !== null && (!Number.isFinite(discountValue) || discountValue < 0))
    return { error: "Discount value must be a non-negative number." };

  const categoryResult = await resolveOrCreateCategoryId(categoryIdRaw, newCategoryName);
  if ("error" in categoryResult) return categoryResult;
  const categoryId = categoryResult.id;

  const { data, error } = await adminClient
    .from("products")
    .insert({
      sku,
      name,
      description,
      details,
      price: priceRaw,
      category_id: categoryId,
      track_stock: trackStock,
      stock_qty: stockQty,
      is_active: true,
      discount_type: discountType,
      discount_threshold: discountThreshold,
      discount_value: discountValue,
      cost_price: costPrice,
      pack_size: packSize,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[admin] createProduct:", error.message);
    if (error.code === "23505") return { error: "A product with this SKU already exists." };
    return { error: "Failed to create product. Please try again." };
  }

  // Persist the uploaded image as the primary image in the product_images table
  if (imageUrl) {
    const { error: imgError } = await adminClient
      .from("product_images")
      .insert({ product_id: data.id, url: imageUrl, is_primary: true, display_order: 0 });
    if (imgError) {
      console.error("[admin] insertProductImage:", imgError.message);
      // Non-fatal: product is saved, just log the image insert failure
    }
  }

  revalidatePath("/admin/products");
  revalidateTag("catalogue", {});
  return { id: data.id };
}

// ---------------------------------------------------------------------------
// updateProductAction
// ---------------------------------------------------------------------------

export async function updateProductAction(
  formData: FormData
): Promise<{ error: string } | void> {
  const session = await requireAdmin();

  const rawId = formData.get("id") as string | null;
  const idResult = z.string().uuid("Invalid product ID.").safeParse(rawId);
  if (!idResult.success) return { error: idResult.error.issues[0].message };
  const id = idResult.data;

  const sku = ((formData.get("sku") as string) ?? "").trim();
  const name = ((formData.get("name") as string) ?? "").trim();
  const description = (formData.get("description") as string | null)?.trim() ?? null;
  const details = (formData.get("details") as string | null)?.trim() ?? null;
  const priceRaw = parseFloat(formData.get("price") as string);
  const categoryIdRaw = (formData.get("category_id") as string | null)?.trim();
  const newCategoryName = (formData.get("new_category_name") as string | null)?.trim() || null;
  const trackStock = formData.get("track_stock") === "true";
  const stockQty = parseInt(formData.get("stock_qty") as string, 10) || 0;
  const isActive = formData.get("is_active") !== "false";
  const imageUrl = (formData.get("image_url") as string | null)?.trim() || undefined;
  const discountTypeRaw = (formData.get("discount_type") as string | null)?.trim();
  const discountType =
    !discountTypeRaw || discountTypeRaw === "none"
      ? null
      : (discountTypeRaw as "percentage" | "fixed");
  const discountThreshold = formData.get("discount_threshold")
    ? parseInt(formData.get("discount_threshold") as string, 10) || null
    : null;
  const discountValue = formData.get("discount_value")
    ? parseFloat(formData.get("discount_value") as string)
    : null;
  const costPriceRaw = formData.get("cost_price") as string | null;
  const costPrice =
    costPriceRaw && costPriceRaw.trim() !== ""
      ? parseFloat(costPriceRaw)
      : null;
  const packSize = parseInt(formData.get("pack_size") as string, 10);
  if (!packSize || packSize < 1) {
    return { error: "Pack size must be a whole number of 1 or greater." };
  }

  if (discountType && (!discountThreshold || discountValue === null)) {
    return { error: "Bulk discount requires a minimum quantity and discount value." };
  }
  if (!discountType && (discountThreshold || discountValue !== null)) {
    return { error: "Select a discount type or clear the discount fields." };
  }

  if (!sku || !name || isNaN(priceRaw) || priceRaw < 0) {
    return { error: "SKU, name, and a valid price are required." };
  }

  // [M11] Server-side bounds validation
  if (name.length > 200) return { error: "Product name too long (max 200 characters)." };
  if (details && details.length > 5000) return { error: "Details too long (max 5000 characters)." };
  if (description && description.length > 2000) return { error: "Description too long (max 2000 characters)." };
  if (!Number.isFinite(priceRaw) || priceRaw > 1e7) return { error: "Invalid price (max R10,000,000)." };
  if (packSize > 10_000) return { error: "Pack size too large (max 10,000)." };
  if (stockQty < 0 || stockQty > 10_000) return { error: "Stock quantity out of range (0–10,000)." };
  if (costPrice !== null && (!Number.isFinite(costPrice) || costPrice < 0 || costPrice > 1e7))
    return { error: "Invalid cost price." };
  if (discountType === "percentage" && discountValue !== null && discountValue > 100)
    return { error: "Percentage discount cannot exceed 100%." };
  if (discountValue !== null && (!Number.isFinite(discountValue) || discountValue < 0))
    return { error: "Discount value must be a non-negative number." };

  const categoryResult = await resolveOrCreateCategoryId(categoryIdRaw, newCategoryName);
  if ("error" in categoryResult) return categoryResult;
  const categoryId = categoryResult.id;

  // Fetch current state so we can detect price / details changes for the audit log
  const { data: oldProduct } = await adminClient
    .from("products")
    .select("price, details")
    .eq("id", id)
    .single();

  // Build update payload — does NOT include image (handled via product_images table)
  const updatePayload: Record<string, unknown> = {
    sku,
    name,
    description,
    details,
    price: priceRaw,
    category_id: categoryId,
    track_stock: trackStock,
    stock_qty: stockQty,
    is_active: isActive,
    updated_at: new Date().toISOString(),
    discount_type: discountType,
    discount_threshold: discountThreshold,
    discount_value: discountValue,
    cost_price: costPrice,
    pack_size: packSize,
  };

  const { error } = await adminClient
    .from("products")
    .update(updatePayload)
    .eq("id", id);

  if (error) {
    console.error("[admin] updateProduct:", error.message);
    if (error.code === "23505") return { error: "A product with this SKU already exists." };
    return { error: "Failed to update product. Please try again." };
  }

  // Audit log: record if price or details changed.
  // audit_log.Insert is typed `never` (app-level convention — inserts are normally
  // handled by DB triggers). The service-role client bypasses RLS so we can write
  // directly; we suppress the type error here intentionally.
  const priceChanged = oldProduct && Number(oldProduct.price) !== priceRaw;
  const detailsChanged = oldProduct && (oldProduct.details ?? null) !== (details ?? null);
  if (priceChanged || detailsChanged) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: auditError } = await (adminClient as any).from("audit_log").insert({
      actor_id: session!.profileId,
      action: "UPDATE",
      table_name: "products",
      record_id: id,
      old_data: {
        price: oldProduct?.price,
        details: oldProduct?.details ?? null,
      },
      new_data: {
        price: priceRaw,
        details: details ?? null,
        _changed_fields: [
          ...(priceChanged ? ["price"] : []),
          ...(detailsChanged ? ["details"] : []),
        ],
      },
    });
    if (auditError) {
      console.error("[admin] updateProduct audit log:", auditError.message);
      // Non-fatal: product is already saved, just log the failure
    }
  }

  // If a new image was uploaded, replace the current primary image
  if (imageUrl) {
    // Remove existing primary flag
    await adminClient
      .from("product_images")
      .update({ is_primary: false })
      .eq("product_id", id)
      .eq("is_primary", true);
    // Insert new primary image
    const { error: imgError } = await adminClient
      .from("product_images")
      .insert({ product_id: id, url: imageUrl, is_primary: true, display_order: 0 });
    if (imgError) {
      console.error("[admin] updateProductImage:", imgError.message);
    }
  }

  revalidatePath("/admin/products");
  revalidateTag("catalogue", {});
}

// ---------------------------------------------------------------------------
// toggleProductActiveAction
// ---------------------------------------------------------------------------

export async function toggleProductActiveAction(
  formData: FormData
): Promise<{ error: string } | void> {
  await requireAdmin();

  const id = formData.get("id") as string | null;
  const isActive = formData.get("is_active") === "true";
  if (!id) return { error: "Missing product ID." };

  const { error } = await adminClient
    .from("products")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    console.error("[admin] toggleProduct:", error.message);
    return { error: "Failed to update product status." };
  }

  revalidateTag("catalogue", {});
}

// ---------------------------------------------------------------------------
// inviteClientAction
// ---------------------------------------------------------------------------
// Sends a Supabase Auth invite email to a new buyer.
// The handle_new_buyer_user trigger creates their profile automatically
// when they accept the invite and set their password.

export async function inviteClientAction(
  formData: FormData
): Promise<{ error: string } | { success: true }> {
  await requireAdmin();

  const email = (formData.get("email") as string)?.trim();
  const contactName = (formData.get("contact_name") as string)?.trim();
  const businessName = (formData.get("business_name") as string)?.trim() || undefined;

  if (!email || !contactName) {
    return { error: "Email and contact name are required." };
  }

  // [M12] Input bounds validation
  if (email.length > 254) return { error: "Email too long (max 254 characters)." };
  if (contactName.length > 120) return { error: "Contact name too long (max 120 characters)." };
  if (businessName && businessName.length > 120) return { error: "Business name too long (max 120 characters)." };

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { error: "Please enter a valid email address." };
  }

  const { error } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: {
      role: "buyer_default",
      contact_name: contactName,
      business_name: businessName ?? "",
    },
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/clients");
  return { success: true };
}

// ---------------------------------------------------------------------------
// updateClientAction
// ---------------------------------------------------------------------------

export async function updateClientAction(
  formData: FormData
): Promise<{ error: string } | void> {
  await requireAdmin();

  const rawId = formData.get("id") as string | null;
  const idResult = z.string().uuid("Invalid client ID.").safeParse(rawId);
  if (!idResult.success) return { error: idResult.error.issues[0].message };
  const id = idResult.data;

  const accountNumber = ((formData.get("account_number") as string) ?? "").trim();
  const businessName = ((formData.get("business_name") as string) ?? "").trim();
  const contactName = ((formData.get("contact_name") as string) ?? "").trim();
  const email = (formData.get("email") as string | null)?.trim() || null;
  const phone = (formData.get("phone") as string | null)?.trim() || null;
  const rawRole = formData.get("role") as string | null;
  const role: "buyer_default" | "buyer_30_day" =
    rawRole === "buyer_default" || rawRole === "buyer_30_day"
      ? rawRole
      : "buyer_default";
  const vatNumber = (formData.get("vat_number") as string | null)?.trim() || null;
  const creditLimit = parseFloat(formData.get("credit_limit") as string) || null;
  const rawAvailableCredit = formData.get("available_credit") as string | null;
  const availableCredit =
    rawAvailableCredit === "" || rawAvailableCredit === null
      ? null
      : parseFloat(rawAvailableCredit);
  const termsDays = parseInt(formData.get("payment_terms_days") as string, 10) || null;
  const notes = (formData.get("notes") as string | null)?.trim() || null;
  const isActive = formData.get("is_active") !== "false";

  if (!accountNumber || !businessName || !contactName) {
    return { error: "Account number, business name, and contact name are required." };
  }

  // [M12] Input bounds validation
  if (contactName.length > 120) return { error: "Contact name too long (max 120 characters)." };
  if (businessName.length > 120) return { error: "Business name too long (max 120 characters)." };
  if (email && email.length > 254) return { error: "Email too long (max 254 characters)." };
  if (phone && phone.length > 30) return { error: "Phone too long (max 30 characters)." };
  if (vatNumber && vatNumber.length > 30) return { error: "VAT number too long (max 30 characters)." };
  if (creditLimit !== null && (!Number.isFinite(creditLimit) || creditLimit < 0 || creditLimit > 1e9))
    return { error: "Credit limit out of range (0–R1,000,000,000)." };
  if (availableCredit !== null && (!Number.isFinite(availableCredit) || availableCredit < 0 || availableCredit > 1e9))
    return { error: "Available credit out of range." };
  if (termsDays !== null && (termsDays < 0 || termsDays > 365))
    return { error: "Payment terms must be 0–365 days." };

  const { error } = await adminClient
    .from("profiles")
    .update({
      account_number: accountNumber,
      business_name: businessName,
      contact_name: contactName,
      email,
      phone,
      role,
      vat_number: vatNumber,
      credit_limit: creditLimit,
      available_credit: availableCredit,
      payment_terms_days: termsDays,
      notes,
      is_active: isActive,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    console.error("[admin] updateClient:", error.message);
    if (error.code === "23505") return { error: "A client with this account number already exists." };
    return { error: "Failed to update client. Please try again." };
  }

  revalidatePath("/admin/clients");
}

// ---------------------------------------------------------------------------
// updateTenantConfigAction
// ---------------------------------------------------------------------------

/**
 * Updates the singleton tenant_config row (id = 1).
 * Guarded by an email lock — only the super admin may update settings.
 */
export async function updateTenantConfigAction(
  formData: FormData
): Promise<{ error: string } | void> {
  await requireAdmin();

  // Email lock: only the super admin (ADMIN_SUPER_EMAIL) can save settings
  const sessionCheck = await getSession();
  if (!sessionCheck?.isSuperAdmin) {
    return { error: "Unauthorised: only the super admin can update settings." };
  }

  const businessName = (formData.get("business_name") as string).trim();
  if (!businessName) return { error: "Business name is required." };

  // vat_rate stored as decimal (0.15), form sends as percentage (15)
  const vatRateRaw = parseFloat(formData.get("vat_rate") as string);
  const vatRate = isNaN(vatRateRaw) ? 0.15 : vatRateRaw / 100;

  const bankRefPrefix =
    (formData.get("bank_reference_prefix") as string | null)?.trim() || "ORD";

  const { error } = await adminClient
    .from("tenant_config")
    .update({
      business_name: businessName,
      trading_name:
        (formData.get("trading_name") as string | null)?.trim() || null,
      vat_number:
        (formData.get("vat_number") as string | null)?.trim() || null,
      vat_rate: vatRate,
      support_email:
        (formData.get("support_email") as string | null)?.trim() || null,
      support_phone:
        (formData.get("support_phone") as string | null)?.trim() || null,
      bank_name:
        (formData.get("bank_name") as string | null)?.trim() || null,
      bank_account_holder:
        (formData.get("bank_account_holder") as string | null)?.trim() || null,
      bank_account_number:
        (formData.get("bank_account_number") as string | null)?.trim() || null,
      bank_branch_code:
        (formData.get("bank_branch_code") as string | null)?.trim() || null,
      bank_account_type:
        (formData.get("bank_account_type") as string | null)?.trim() || null,
      bank_swift_code:
        (formData.get("bank_swift_code") as string | null)?.trim() || null,
      bank_reference_prefix: bankRefPrefix,
      dispatch_email: (formData.get("dispatch_email") as string | null)?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);

  if (error) {
    console.error("[admin] updateTenantConfig:", error.message);
    return { error: "Failed to save settings. Please try again." };
  }
}

// ---------------------------------------------------------------------------
// saveGlobalBannerAction
// ---------------------------------------------------------------------------

/**
 * Upserts the global notification banner settings in the global_settings singleton.
 * Accessible to all admin roles (no super-admin lock required).
 */
export async function saveGlobalBannerAction(
  formData: FormData
): Promise<{ error: string } | { success: true }> {
  await requireAdmin();

  const banner_message =
    (formData.get("banner_message") as string)?.trim() || null;
  const is_banner_active = formData.get("is_banner_active") === "true";

  if (banner_message && banner_message.length > 280) {
    return { error: "Banner message must be 280 characters or fewer." };
  }

  const { data: updated, error } = await adminClient
    .from("global_settings")
    .update({
      banner_message,
      is_banner_active,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1)
    .select("id");

  if (error) {
    console.error("[admin] saveGlobalBanner:", error.message);
    return { error: "Failed to save banner settings. Please try again." };
  }

  if (!updated || updated.length === 0) {
    return { error: "Banner settings row not found. Please run the database migration." };
  }

  revalidatePath("/admin/notifications");
  // Revalidate the portal layout so the banner updates across all buyer pages
  revalidatePath("/", "layout");

  return { success: true };
}

// ---------------------------------------------------------------------------
// markOrderSettledAction — mark a single order as paid (credit settlement)
// ---------------------------------------------------------------------------

export async function markOrderSettledAction(
  orderId: string
): Promise<{ error?: string; success?: boolean }> {
  await requireAdmin();

  const { error } = await adminClient
    .from("orders")
    .update({ payment_status: "paid" })
    .eq("id", orderId);

  if (error) return { error: error.message };

  revalidatePath("/admin/clients");
  return { success: true };
}

// ---------------------------------------------------------------------------
// bulkMarkOrdersSettledAction — mark multiple orders as paid in one query
// ---------------------------------------------------------------------------

export async function bulkMarkOrdersSettledAction(
  orderIds: string[]
): Promise<{ error?: string; success?: boolean }> {
  await requireAdmin();

  if (!orderIds.length) return { error: "No orders selected." };

  const { error } = await adminClient
    .from("orders")
    .update({ payment_status: "paid" })
    .in("id", orderIds);

  if (error) return { error: error.message };

  revalidatePath("/admin/clients");
  return { success: true };
}

// ---------------------------------------------------------------------------
// sendClientStatementAction — email outstanding orders to a 30-day client
// ---------------------------------------------------------------------------

/**
 * Fetches all unpaid + credit_approved confirmed orders for the given profile
 * and sends a statement email via Resend.
 */
export async function sendClientStatementAction(
  profileId: string
): Promise<{ error?: string; success?: boolean }> {
  await requireAdmin();

  // 1. Fetch profile
  const { data: profile } = await adminClient
    .from("profiles")
    .select("id, business_name, contact_name, email, account_number")
    .eq("id", profileId)
    .single();

  if (!profile) return { error: "Client not found." };
  if (!profile.email) return { error: "Client has no email address on file." };

  // 2. Fetch outstanding orders with their items
  const { data: orders } = await adminClient
    .from("orders")
    .select(
      `id, reference_number, created_at, confirmed_at, total_amount,
       order_items ( product_name, quantity, unit_price, line_total )`
    )
    .eq("profile_id", profileId)
    .in("payment_status", ["unpaid", "credit_approved"])
    .not("confirmed_at", "is", null)
    .order("confirmed_at", { ascending: true });

  // 3. Fetch tenant config for branding + from address
  const { data: config } = await adminClient
    .from("tenant_config")
    .select("business_name, support_email, email_from_name")
    .eq("id", 1)
    .single();

  const resendKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;

  if (!resendKey || !fromEmail) {
    return { error: "Email service not configured." };
  }

  const resend = new Resend(resendKey);
  const supplierName = config?.business_name ?? "Your Supplier";
  const fromAddress = config?.email_from_name
    ? `${config.email_from_name} <${fromEmail}>`
    : fromEmail;

  const totalOutstanding = (orders ?? []).reduce(
    (sum, o) => sum + Number(o.total_amount),
    0
  );
  const ZAR = new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    minimumFractionDigits: 2,
  });

  const { error } = await resend.emails.send({
    from: fromAddress,
    to: [profile.email],
    subject: `Account Statement — ${profile.business_name}`,
    react: ClientStatement({
      businessName: profile.business_name,
      contactName: profile.contact_name,
      accountNumber: profile.account_number,
      orders: (orders ?? []).map((o) => ({
        referenceNumber: o.reference_number,
        confirmedAt: o.confirmed_at!,
        totalAmount: Number(o.total_amount),
        totalFormatted: ZAR.format(Number(o.total_amount)),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        items: (o.order_items as any[]).map((i) => ({
          productName: i.product_name,
          quantity: i.quantity,
          unitPrice: Number(i.unit_price),
          lineTotal: Number(i.line_total),
        })),
      })),
      totalOutstanding: ZAR.format(totalOutstanding),
      supplierName,
      supportEmail: config?.support_email ?? null,
    }),
  });

  if (error) {
    console.error("[admin] sendClientStatement:", error.message);
    return { error: "Failed to send statement email." };
  }

  return { success: true };
}

