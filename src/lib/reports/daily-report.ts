import "server-only";

import { adminClient } from "@/lib/supabase/admin";

// ---------------------------------------------------------------------------
// CSV escape helper — wraps values containing commas, quotes or newlines
// ---------------------------------------------------------------------------
function csvEsc(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// ---------------------------------------------------------------------------
// generateDailyReportCsv
// ---------------------------------------------------------------------------

/**
 * Generates a CSV string of all paid/credit_approved orders confirmed on
 * the given date. One row per line item.
 *
 * Columns:
 *   Date, Invoice Number, Account No., Business Name, SKU, Product Name,
 *   Qty, Pack Size, Total Units, Selling Price, Cost Price,
 *   Ext Selling, Ext Cost
 */
export async function generateDailyReportCsv(date: Date): Promise<string> {
  // Build the day boundary in UTC ISO strings
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const startOfDay = `${year}-${month}-${day}T00:00:00.000Z`;

  const nextDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1));
  const endOfDay = nextDay.toISOString().replace(/T.*/, "T00:00:00.000Z");

  const { data: orders, error } = await adminClient
    .from("orders")
    .select(
      `id, reference_number, confirmed_at, payment_status,
       buyer:profiles!profile_id ( account_number, business_name ),
       order_items ( sku, product_name, quantity, unit_price, pack_size, cost_price )`
    )
    .in("payment_status", ["paid", "credit_approved"])
    .gte("confirmed_at", startOfDay)
    .lt("confirmed_at", endOfDay)
    .order("confirmed_at", { ascending: true });

  if (error) {
    throw new Error(`[daily-report] Failed to fetch orders: ${error.message}`);
  }

  const header = [
    "Date",
    "Invoice Number",
    "Account No.",
    "Business Name",
    "SKU",
    "Product Name",
    "Qty",
    "Pack Size",
    "Total Units",
    "Selling Price",
    "Cost Price",
    "Ext Selling",
    "Ext Cost",
  ].join(",");

  type RawBuyer = { account_number: string | null; business_name: string } | null;
  type RawItem = {
    sku: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    pack_size: number | null;
    cost_price: number | null;
  };

  const rows: string[] = [header];

  for (const order of orders ?? []) {
    if (!order.confirmed_at) continue;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buyer = (order as any).buyer as RawBuyer;
    const items = ((order as any).order_items as RawItem[]) ?? [];

    const accNo = buyer?.account_number ?? "";
    const bizName = buyer?.business_name ?? "";

    // Format confirmed_at as DD/MM/YYYY
    const confirmedDate = new Date(order.confirmed_at as string);
    const dd = String(confirmedDate.getUTCDate()).padStart(2, "0");
    const mm = String(confirmedDate.getUTCMonth() + 1).padStart(2, "0");
    const yyyy = confirmedDate.getUTCFullYear();
    const dateStr = `${dd}/${mm}/${yyyy}`;

    for (const item of items) {
      const qty = item.quantity;
      const packSize = item.pack_size ?? 1;
      const sellingPrice = item.unit_price;
      const costPrice = item.cost_price;

      const totalUnits = qty * packSize;
      const extSelling = qty * sellingPrice;
      const extCost = costPrice != null ? qty * costPrice : "";

      rows.push(
        [
          dateStr,
          csvEsc(order.reference_number ?? ""),
          csvEsc(accNo),
          csvEsc(bizName),
          csvEsc(item.sku),
          csvEsc(item.product_name),
          qty,
          packSize,
          totalUnits,
          sellingPrice,
          costPrice != null ? costPrice : "",
          extSelling,
          extCost,
        ].join(",")
      );
    }
  }

  return rows.join("\n");
}
