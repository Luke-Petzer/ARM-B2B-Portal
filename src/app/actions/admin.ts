"use server";

import { redirect } from "next/navigation";
import { revalidatePath, revalidateTag } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { adminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { Resend } from "resend";
import ClientStatement from "@/emails/ClientStatement";
import type { Route } from "next";
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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const superEmail = process.env.ADMIN_SUPER_EMAIL;
  if (!superEmail || user?.email !== superEmail) {
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
  const approvalType = (formData.get("approvalType") as string | null) ?? "paid";
  if (!orderId) return { error: "Missing order ID." };
  if (approvalType !== "paid" && approvalType !== "credit_approved") {
    return { error: "Invalid approval type." };
  }

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

  // Dispatch email only fires on first approval — Phase 5 will implement sendDispatchEmail
  // if (isFirstApproval) { sendDispatchEmail(orderId).catch(console.error); }
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
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
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

  // Sanitise filename and make it unique
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const filePath = `products/${uniqueName}`;

  // Convert File to ArrayBuffer for the server-side upload
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { error: uploadError } = await adminClient.storage
    .from("product-images")
    .upload(filePath, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    console.error("[admin] uploadProductImage:", uploadError.message);
    return { error: `Storage upload failed: ${uploadError.message}` };
  }

  const { data } = adminClient.storage
    .from("product-images")
    .getPublicUrl(filePath);

  return { url: data.publicUrl };
}

// ---------------------------------------------------------------------------
// createProductAction
// ---------------------------------------------------------------------------

export async function createProductAction(
  formData: FormData
): Promise<{ error: string } | { id: string }> {
  await requireAdmin();

  const sku = (formData.get("sku") as string).trim();
  const name = (formData.get("name") as string).trim();
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
  const costPrice = parseFloat(formData.get("cost_price") as string) || null;
  const packSize = parseInt(formData.get("pack_size") as string, 10) || 1;

  if (discountType && (!discountThreshold || discountValue === null)) {
    return { error: "Bulk discount requires a minimum quantity and discount value." };
  }
  if (!discountType && (discountThreshold || discountValue !== null)) {
    return { error: "Select a discount type or clear the discount fields." };
  }

  if (!sku || !name || isNaN(priceRaw) || priceRaw < 0) {
    return { error: "SKU, name, and a valid price are required." };
  }

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

  const id = formData.get("id") as string | null;
  if (!id) return { error: "Missing product ID." };

  const sku = (formData.get("sku") as string).trim();
  const name = (formData.get("name") as string).trim();
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
  const costPrice = parseFloat(formData.get("cost_price") as string) || null;
  const packSize = parseInt(formData.get("pack_size") as string, 10) || 1;

  if (discountType && (!discountThreshold || discountValue === null)) {
    return { error: "Bulk discount requires a minimum quantity and discount value." };
  }
  if (!discountType && (discountThreshold || discountValue !== null)) {
    return { error: "Select a discount type or clear the discount fields." };
  }

  if (!sku || !name || isNaN(priceRaw) || priceRaw < 0) {
    return { error: "SKU, name, and a valid price are required." };
  }

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
// createClientAction
// ---------------------------------------------------------------------------

export async function createClientAction(
  formData: FormData
): Promise<{ error: string } | { id: string }> {
  await requireAdmin();

  const accountNumber = (formData.get("account_number") as string).trim();
  const businessName = (formData.get("business_name") as string).trim();
  const contactName = (formData.get("contact_name") as string).trim();
  const email = (formData.get("email") as string | null)?.trim() || null;
  const phone = (formData.get("phone") as string | null)?.trim() || null;
  const role = formData.get("role") as "buyer_default" | "buyer_30_day";
  const vatNumber = (formData.get("vat_number") as string | null)?.trim() || null;
  const creditLimit = parseFloat(formData.get("credit_limit") as string) || null;
  const rawAvailableCredit = formData.get("available_credit") as string | null;
  const availableCredit =
    rawAvailableCredit === "" || rawAvailableCredit === null
      ? null
      : parseFloat(rawAvailableCredit);
  const termsDays = parseInt(formData.get("payment_terms_days") as string, 10) || null;
  const notes = (formData.get("notes") as string | null)?.trim() || null;

  if (!accountNumber || !businessName || !contactName) {
    return { error: "Account number, business name, and contact name are required." };
  }
  if (!["buyer_default", "buyer_30_day"].includes(role)) {
    return { error: "Invalid billing role." };
  }

  const { data, error } = await adminClient
    .from("profiles")
    .insert({
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
      is_active: true,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[admin] createClient:", error.message);
    if (error.code === "23505") return { error: "A client with this account number already exists." };
    return { error: "Failed to create client. Please try again." };
  }

  revalidatePath("/admin/clients");
  return { id: data.id };
}

// ---------------------------------------------------------------------------
// updateClientAction
// ---------------------------------------------------------------------------

export async function updateClientAction(
  formData: FormData
): Promise<{ error: string } | void> {
  await requireAdmin();

  const id = formData.get("id") as string | null;
  if (!id) return { error: "Missing client ID." };

  const accountNumber = (formData.get("account_number") as string).trim();
  const businessName = (formData.get("business_name") as string).trim();
  const contactName = (formData.get("contact_name") as string).trim();
  const email = (formData.get("email") as string | null)?.trim() || null;
  const phone = (formData.get("phone") as string | null)?.trim() || null;
  const role = formData.get("role") as "buyer_default" | "buyer_30_day";
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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const superEmail = process.env.ADMIN_SUPER_EMAIL;
  if (!superEmail || user?.email !== superEmail) {
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

