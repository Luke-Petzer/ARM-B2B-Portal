import { adminClient } from "@/lib/supabase/admin";
import ProductsTable from "./ProductsTable";

export default async function AdminProductsPage() {
  // Fetch products ordered alphabetically by SKU
  const [{ data: products }, { data: categories }] = await Promise.all([
    adminClient
      .from("products")
      .select(
        `id, sku, name, description, details, price,
         category_id, track_stock, stock_qty, is_active,
         discount_type, discount_threshold, discount_value,
         product_images ( url, is_primary, display_order )`
      )
      .order("sku", { ascending: true }),
    adminClient
      .from("categories")
      .select("id, name")
      .order("name", { ascending: true }),
  ]);

  type RawImage = { url: string; is_primary: boolean; display_order: number };

  const rows = (products ?? []).map((p) => {
    const images = (p.product_images as RawImage[]) ?? [];
    const primary =
      images.find((i) => i.is_primary) ??
      images.sort((a, b) => a.display_order - b.display_order)[0] ??
      null;
    return {
      id: p.id,
      sku: p.sku,
      name: p.name,
      description: p.description,
      details: p.details,
      price: Number(p.price),
      category_id: p.category_id,
      track_stock: p.track_stock,
      stock_qty: p.stock_qty,
      is_active: p.is_active,
      primaryImageUrl: primary?.url ?? null,
      discount_type: p.discount_type as "percentage" | "fixed" | null,
      discount_threshold: p.discount_threshold !== null ? Number(p.discount_threshold) : null,
      discount_value: p.discount_value !== null ? Number(p.discount_value) : null,
      categoryName:
        (categories ?? []).find((c) => c.id === p.category_id)?.name ?? null,
    };
  });

  const categoryOptions = (categories ?? []).map((c) => ({
    id: c.id,
    name: c.name,
  }));

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
          Products
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage your inventory, pricing, and product catalogue.
        </p>
      </div>

      <ProductsTable products={rows} categories={categoryOptions} />
    </div>
  );
}
