"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, MoreHorizontal, Package } from "lucide-react";
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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<ProductRow | null>(null);
  const [togglingId, startToggle] = useTransition();
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

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
    setOpenMenuId(null);
  };

  const handleToggleActive = (product: ProductRow) => {
    setOpenMenuId(null);
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

  const _ = togglingId; // suppress unused warning

  return (
    <>
      {/* Table header */}
      <div className="flex flex-wrap items-center justify-between mb-6 gap-4">
        <p className="text-sm text-slate-500">
          {products.length} product{products.length !== 1 ? "s" : ""}
        </p>
        <button
          type="button"
          onClick={handleOpenCreate}
          className="h-10 px-5 bg-slate-900 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors shadow-sm w-full md:w-auto"
        >
          <Plus className="w-4 h-4" />
          Add Product
        </button>
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
            {products.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-6 py-16 text-center text-sm text-slate-400"
                >
                  No products yet. Click &ldquo;Add Product&rdquo; to get started.
                </td>
              </tr>
            ) : (
              products.map((product) => (
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

                  {/* Actions menu */}
                  <td className="px-6 py-4 text-right relative">
                    <button
                      type="button"
                      onClick={() =>
                        setOpenMenuId(
                          openMenuId === product.id ? null : product.id
                        )
                      }
                      className="text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      <MoreHorizontal className="w-5 h-5" />
                    </button>
                    {openMenuId === product.id && (
                      <div className="absolute right-6 top-full mt-1 w-36 bg-white rounded-lg border border-slate-200 shadow-lg z-10 py-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(product)}
                          className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleActive(product)}
                          className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                          {product.is_active ? "Deactivate" : "Activate"}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ProductDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSaved={handleSaved}
        product={editProduct}
        categories={categories}
      />
    </>
  );
}
