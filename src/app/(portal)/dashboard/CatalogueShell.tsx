"use client";

import { useState, useMemo } from "react";
import { Search } from "lucide-react";
import ProductGroupCard from "@/components/portal/ProductGroupCard";
import CartSidebar from "@/components/portal/CartSidebar";
import { groupProductsByName } from "@/lib/catalogue/grouping";
import type { ProductRowData } from "@/lib/catalogue/grouping";

interface CategoryNav {
  id: string;
  name: string;
  slug: string;
}

interface CatalogueShellProps {
  products: ProductRowData[];
  categories: CategoryNav[];
}

/** Desktop-only table column headers */
function TableHeader() {
  return (
    <div className="hidden md:grid items-center px-4 py-4 border-b border-gray-100 bg-gray-50/50"
      style={{ gridTemplateColumns: "60px 140px 1fr 120px 140px 100px" }}
    >
      <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
        Thumb
      </span>
      <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
        SKU
      </span>
      <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
        Description
      </span>
      <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
        Unit Price
      </span>
      <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
        Quantity
      </span>
      <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider text-right">
        Action
      </span>
    </div>
  );
}

export default function CatalogueShell({ products, categories }: CatalogueShellProps) {
  const [query, setQuery] = useState("");
  const isSearching = query.trim().length > 0;

  /**
   * Step 1: filter the flat product array.
   * Grouping always runs AFTER this, so search results are naturally
   * limited to matching products — the first variation in each group
   * is already the one that matched the query.
   */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.sku.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        (p.description ?? "").toLowerCase().includes(q)
    );
  }, [query, products]);

  /**
   * Step 2a: group filtered results (used when searching).
   * Because the flat filter runs first, a SKU search like "POLE03"
   * produces a group with only that one variation — auto-selected.
   */
  const searchGroups = useMemo(
    () => groupProductsByName(filtered),
    [filtered]
  );

  /**
   * Step 2b: group by category, then by base name within each category.
   * Order follows the `categories` array (admin-defined display_order).
   */
  const grouped = useMemo(() => {
    const buckets = new Map<
      string,
      { name: string; slug: string; items: ProductRowData[] }
    >();
    for (const cat of categories) {
      buckets.set(cat.id, { name: cat.name, slug: cat.slug, items: [] });
    }
    const uncategorised: ProductRowData[] = [];

    for (const product of products) {
      if (product.categoryId && buckets.has(product.categoryId)) {
        buckets.get(product.categoryId)!.items.push(product);
      } else {
        uncategorised.push(product);
      }
    }

    const result = Array.from(buckets.values())
      .filter((g) => g.items.length > 0)
      .map((g) => ({ ...g, groups: groupProductsByName(g.items) }));

    if (uncategorised.length > 0) {
      result.push({
        name: "Other",
        slug: "uncategorised",
        items: uncategorised,
        groups: groupProductsByName(uncategorised),
      });
    }
    return result;
  }, [products, categories]);

  const scrollToCategory = (slug: string) => {
    document
      .getElementById(`cat-${slug}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      {/* Search Bar */}
      <div className="bg-white border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center px-6 md:px-8 h-[40px]">
          <Search className="w-4 h-4 text-gray-400 mr-3 flex-shrink-0" />
          <input
            type="text"
            placeholder="Search by SKU or product name..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full h-full text-sm outline-none text-slate-900 bg-transparent placeholder:text-gray-400"
          />
        </div>
      </div>

      {/* Main: product list + cart sidebar */}
      <main className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Product list */}
        <section className="flex-1 overflow-y-auto custom-scrollbar">
          {/* Sticky category nav (hidden while searching) */}
          {!isSearching && grouped.length > 1 && (
            <div className="sticky top-0 z-20 bg-white border-b border-gray-100 shadow-sm">
              <div
                className="flex gap-2 px-6 md:px-8 py-2.5 overflow-x-auto"
                style={{ scrollbarWidth: "none" }}
              >
                {grouped.map((group) => (
                  <button
                    key={group.slug}
                    onClick={() => scrollToCategory(group.slug)}
                    className="flex-shrink-0 px-4 py-1.5 text-sm font-medium rounded-full border border-slate-200 text-slate-600 hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-colors"
                  >
                    {group.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="p-4 md:p-8">
            {/* Search results — grouped by base name */}
            {isSearching ? (
              <>
                <h1 className="text-[22px] md:text-[28px] font-semibold text-slate-900 mb-6">
                  Results for &ldquo;{query.trim()}&rdquo;
                </h1>
                <div className="border border-gray-100 rounded-xl overflow-hidden">
                  <TableHeader />
                  <div className="divide-y divide-gray-50">
                    {searchGroups.map((group) => (
                      <ProductGroupCard
                        key={group.baseName}
                        group={group}
                      />
                    ))}
                  </div>
                  {searchGroups.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-16">
                      No products match &ldquo;{query}&rdquo;.
                    </p>
                  )}
                </div>
              </>
            ) : (
              /* Grouped category sections */
              <>
                <h1 className="text-[22px] md:text-[28px] font-semibold text-slate-900 mb-6">
                  Product Catalogue
                </h1>

                {grouped.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-16">
                    No products available yet. Add products from the admin dashboard.
                  </p>
                )}

                <div className="space-y-10">
                  {grouped.map((group) => (
                    <div
                      key={group.slug}
                      id={`cat-${group.slug}`}
                      className="scroll-mt-16"
                    >
                      <h2 className="text-base font-semibold text-slate-500 uppercase tracking-wider mb-3">
                        {group.name}
                      </h2>
                      <div className="border border-gray-100 rounded-xl">
                        <TableHeader />
                        <div className="divide-y divide-gray-50">
                          {group.groups.map((productGroup) => (
                            <ProductGroupCard
                              key={productGroup.baseName}
                              group={productGroup}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </section>

        {/* Cart sidebar */}
        <CartSidebar />
      </main>
    </>
  );
}
