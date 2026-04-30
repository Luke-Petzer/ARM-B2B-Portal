"use client";

import { useState } from "react";
import Image from "next/image";
import { Package, Tag } from "lucide-react";
import { useCartStore } from "@/lib/cart/store";
import QuantityStepper from "./QuantityStepper";

const ZAR = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
  minimumFractionDigits: 2,
});

interface ProductRowProps {
  productId: string;
  sku: string;
  name: string;
  description: string | null;
  details: string | null;
  price: number;
  primaryImageUrl: string | null;
  // Discount metadata
  discountType: "percentage" | "fixed" | null;
  discountThreshold: number | null;
  discountValue: number | null;
}

export default function ProductRow({
  productId,
  sku,
  name,
  description,
  details,
  price,
  primaryImageUrl,
  discountType,
  discountThreshold,
  discountValue,
}: ProductRowProps) {
  const [qty, setQty] = useState(1);
  const [isExpanded, setIsExpanded] = useState(false);
  const [hovered, setHovered] = useState(false);
  const addItem = useCartStore((s) => s.addItem);

  const handleAdd = () => {
    addItem({
      productId,
      sku,
      name,
      unitPrice: price,
      quantity: qty,
      primaryImageUrl,
      discountType,
      discountThreshold,
      discountValue,
    });
  };

  return (
    /*
     * Layout strategy: `md:contents` on wrapper divs lets their children
     * participate directly in the parent 6-column grid on desktop, while on
     * mobile the wrappers act as normal flex rows that stack vertically.
     */
    <div
      className="product-row flex flex-col gap-4 p-4 md:grid md:items-center md:px-4 md:py-4 md:gap-0"
      style={{ gridTemplateColumns: "60px 140px 1fr 120px 140px 100px" }}
    >
      {/* ── Row 1 on mobile: thumbnail + name/sku/price ── */}
      <div className="flex items-center gap-4 md:contents">
        {/* Thumbnail — grid col 1 */}
        <div
          className="relative flex-shrink-0 w-fit"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          <div className="w-[44px] h-[44px] bg-gray-50 border border-gray-100 rounded flex items-center justify-center overflow-hidden">
            {primaryImageUrl ? (
              <Image
                src={primaryImageUrl}
                alt={name}
                width={44}
                height={44}
                sizes="44px"
                className="object-cover w-full h-full"
              />
            ) : (
              <Package className="w-5 h-5 text-gray-300" />
            )}
          </div>
          {hovered && primaryImageUrl && (
            <div className="absolute bottom-full left-0 mb-2 z-50 w-72 h-72 rounded-lg overflow-hidden shadow-xl border border-slate-200 pointer-events-none bg-white backdrop-blur-sm">
              <Image
                src={primaryImageUrl}
                alt={name}
                fill
                sizes="288px"
                className="object-contain"
              />
            </div>
          )}
        </div>

        {/* Info block — becomes `contents` on desktop so children occupy cols 2–4 */}
        <div className="flex flex-col gap-0.5 flex-1 min-w-0 md:contents">
          {/* SKU — grid col 2 */}
          <span className="text-sm font-medium text-slate-900">{sku}</span>
          {/* Description — grid col 3 */}
          <div className="flex flex-col gap-1 min-w-0 md:pr-4">
            <span className="text-sm text-gray-500 truncate">
              {description ?? name}
            </span>
            <button
              type="button"
              onClick={() => setIsExpanded((v) => !v)}
              aria-expanded={isExpanded}
              aria-controls={`desc-panel-${productId}`}
              className="w-fit text-xs font-medium px-3 py-1 border border-gray-300 rounded text-gray-600 hover:bg-gray-50 hover:border-gray-400 transition-colors"
            >
              {isExpanded ? "Hide Details" : "More Information"}
            </button>
          </div>
          {/* Price — grid col 4 (wrapper keeps price + badge as one grid child) */}
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-slate-900">
              {ZAR.format(price)}
            </span>
            {discountType && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5 w-fit">
                <Tag className="w-2.5 h-2.5 flex-shrink-0" />
                Bulk Discount
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Row 2 on mobile: quantity + add button ── */}
      <div className="flex items-center justify-between gap-4 md:contents">
        {/* Quantity — grid col 5 */}
        <div className="flex items-center">
          <QuantityStepper value={qty} onChange={setQty} />
        </div>
        {/* Add — grid col 6 */}
        <div className="flex md:justify-end">
          <button
            type="button"
            onClick={handleAdd}
            className="h-10 px-5 text-sm font-semibold bg-primary text-primary-foreground rounded hover:bg-primary/90 active:scale-[0.98] transition-all"
          >
            Add
          </button>
        </div>
      </div>

      {/* ── Expanded accordion panel — direct child of grid so col-span-full works ── */}
      {isExpanded && (
        <div id={`desc-panel-${productId}`} className="col-span-full bg-slate-50 border-t border-gray-100 px-4 py-4 md:px-6 rounded-b-lg">
          {/* Section 1 — Full Description */}
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
            Description
          </p>
          <p className="text-sm text-slate-700 leading-relaxed">
            {description ?? name}
          </p>

          {/* Section 2 — Specifications (only if details present) */}
          {details && (
            <div className="mt-4">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                Specifications
              </p>
              <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                {details}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
