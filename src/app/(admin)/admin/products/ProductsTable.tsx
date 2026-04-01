"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Package, Search } from "lucide-react";
import ProductDrawer, {
  type ProductForDrawer,
  type CategoryOption,
} from "@/components/admin/ProductDrawer";
import { toggleProductActiveAction } from "@/app/actions/admin";

interface ProductRow extends ProductForDrawer {
  categoryName: string | null;
}

interface ProductsTableProps {
  products: ProductRow[];
  categories: CategoryOption[];
}

const ZAR = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
  minimumFractionDigits: 2,
});

export default function ProductsTable({
  products: initialProducts,
  categories,
}: ProductsTableProps) {
  const router = useRouter();
  const [products, setProducts] = useState<ProductRow[]>(initialProducts);
  // Sync local state when server delivers fresh data after router.refresh()
  useEffect(() => { setProducts(initialProducts); }, [initialProducts]);
  const [searchTerm, setSearchTerm] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);

  const filteredProducts = searchTerm.trim()
    ? products.filter((p) => {
        const q = searchTerm.toLowerCase();
        return p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
      })
    : products;
  const [editProduct, setEditProduct] = useState<ProductRow | null>(null);
  const [, startToggle] = useTransition();

  const handleSaved = () => {
    router.refresh();
  };

  const handleOpenCreate = () => {
    setEditProduct(null);
    setDrawerOpen(true);
  };

  const handleOpenEdit = (product: ProductRow) => {
    setEditProduct(product);
    setDrawerOpen(true);
  };

  const handleToggleActive = (product: ProductRow) => {
    startToggle(async () => {
      const fd = new FormData();
      fd.set("id", product.id);
      fd.set("is_active", String(!product.is_active));
      await toggleProductActiveAction(fd);
      setProducts((prev) =>
        prev.map((p) =>
          p.id === product.id ? { ...p, is_active: !p.is_active } : p
        )
      );
    });
  };

  return (
    <>
      {/* Table header */}
      <div className="flex flex-wrap items-center justify-between mb-6 gap-4">
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name or SKU…"
            className="h-9 w-full pl-9 pr-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all"
          />
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <p className="text-sm text-slate-400 hidden md:block">
            {filteredProducts.length}{searchTerm.trim() ? ` of ${products.length}` : ""} product{filteredProducts.length !== 1 ? "s" : ""}
          </p>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="h-10 px-5 bg-primary text-primary-foreground rounded-lg text-sm font-medium flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors shadow-sm w-full md:w-auto"
          >
            <Plus className="w-4 h-4" />
            Add Product
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm w-full max-w-full overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50">
              <th className="text-left text-[11px] font-medium text-slate-400 uppercase tracking-wider px-6 py-4">
                Image
              </th>
              <th className="text-left text-[11px] font-medium text-slate-400 uppercase tracking-wider px-6 py-4">
                SKU
              </th>
              <th className="text-left text-[11px] font-medium text-slate-400 uppercase tracking-wider px-6 py-4">
                Product Name
              </th>
              <th className="text-left text-[11px] font-medium text-slate-400 uppercase tracking-wider px-6 py-4">
                Category
              </th>
              <th className="text-right text-[11px] font-medium text-slate-400 uppercase tracking-wider px-6 py-4">
                Price
              </th>
              <th className="text-center text-[11px] font-medium text-slate-400 uppercase tracking-wider px-6 py-4">
                Status
              </th>
              <th className="px-6 py-4" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredProducts.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-6 py-16 text-center text-sm text-slate-400"
                >
                  {searchTerm.trim()
                    ? `No products found for "${searchTerm}".`
                    : "No products yet. Click \u201cAdd Product\u201d to get started."}
                </td>
              </tr>
            ) : (
              filteredProducts.map((product) => (
                <tr
                  key={product.id}
                  className="hover:bg-slate-50/50 transition-colors group"
                >
                  {/* Thumbnail */}
                  <td className="px-6 py-4">
                    <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center">
                      {product.primaryImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={product.primaryImageUrl}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Package className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </td>

                  {/* SKU */}
                  <td className="px-6 py-4 text-sm font-mono text-slate-400">
                    {product.sku}
                  </td>

                  {/* Name */}
                  <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                    {product.name}
                  </td>

                  {/* Category */}
                  <td className="px-6 py-4">
                    {product.categoryName ? (
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-[11px] font-medium text-slate-600">
                        {product.categoryName}
                      </span>
                    ) : (
                      <span className="text-sm text-slate-300">—</span>
                    )}
                  </td>

                  {/* Price */}
                  <td className="px-6 py-4 text-sm text-slate-900 font-medium text-right">
                    {ZAR.format(product.price)}
                  </td>

                  {/* Active toggle */}
                  <td className="px-6 py-4 text-center">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={product.is_active}
                        onChange={() => handleToggleActive(product)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 rounded-full peer-checked:bg-slate-900 transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
                    </label>
                  </td>

                  {/* Actions */}
                  <td className="px-6 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(product)}
                      className="h-8 px-3 text-xs font-medium border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ProductDrawer
        key={editProduct?.id ?? "new"}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSaved={handleSaved}
        product={editProduct}
        categories={categories}
      />
    </>
  );
}
