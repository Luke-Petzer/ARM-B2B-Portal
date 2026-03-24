"use client";

import { useState } from "react";
import Image from "next/image";
import { Package, Tag, ChevronDown } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCartStore } from "@/lib/cart/store";
import QuantityStepper from "./QuantityStepper";
import type { ProductGroup, ProductVariant } from "@/lib/catalogue/grouping";

const ZAR = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
  minimumFractionDigits: 2,
});

interface ProductGroupCardProps {
  group: ProductGroup;
}

export default function ProductGroupCard({ group }: ProductGroupCardProps) {
  const { baseName, variations } = group;

  // Default to first variation (which, after a search filter, is already the
  // matched SKU thanks to filter-before-group ordering).
  const [selectedId, setSelectedId] = useState<string>(
    variations[0].productId
  );
  const [qty, setQty] = useState(1);
  const [isExpanded, setIsExpanded] = useState(false);

  const addItem = useCartStore((s) => s.addItem);

  const selected: ProductVariant =
    variations.find((v) => v.productId === selectedId) ?? variations[0];

  const handleAdd = () => {
    addItem({
      productId: selected.productId,
      sku: selected.sku,
      name: selected.name,
      unitPrice: selected.price,
      quantity: qty,
      primaryImageUrl: selected.primaryImageUrl,
      discountType: selected.discountType,
      discountThreshold: selected.discountThreshold,
      discountValue: selected.discountValue,
    });
  };

  const hasMultipleVariations = variations.length > 1;

  return (
    <div
      className="product-row flex flex-col gap-4 p-4 md:grid md:items-center md:px-4 md:py-4 md:gap-0"
      style={{ gridTemplateColumns: "60px 140px 1fr 120px 140px 100px" }}
    >
      {/* ── Row 1 on mobile: thumbnail + name/sku/price ── */}
      <div className="flex items-center gap-4 md:contents">
        {/* Thumbnail — grid col 1 */}
        <div className="relative group flex-shrink-0 w-fit">
          <div className="w-[44px] h-[44px] bg-gray-50 border border-gray-100 rounded flex items-center justify-center overflow-hidden">
            {selected.primaryImageUrl ? (
              <Image
                src={selected.primaryImageUrl}
                alt={baseName}
                width={44}
                height={44}
                className="object-cover w-full h-full"
              />
            ) : (
              <Package className="w-5 h-5 text-gray-300" />
            )}
          </div>
          {selected.primaryImageUrl && (
            <div className="absolute bottom-full left-0 mb-2 z-50 w-48 h-48 rounded-lg overflow-hidden shadow-xl border border-slate-200 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200">
              <Image
                src={selected.primaryImageUrl}
                alt={baseName}
                fill
                className="object-cover"
              />
            </div>
          )}
        </div>

        {/* Info block */}
        <div className="flex flex-col gap-0.5 flex-1 min-w-0 md:contents">
          {/* SKU — grid col 2, updates with selected variation */}
          <span className="text-sm font-medium text-slate-900">
            {selected.sku}
          </span>

          {/* Description + variation selector — grid col 3 */}
          <div className="flex flex-col gap-1 min-w-0 md:pr-8">
            {/* Expandable description toggle */}
            <button
              type="button"
              onClick={() => setIsExpanded((v) => !v)}
              aria-expanded={isExpanded}
              aria-controls={`desc-panel-${selected.productId}`}
              className="flex items-center gap-1 text-left w-full min-w-0 cursor-pointer group/desc"
            >
              <span className="text-sm text-gray-700 font-medium truncate flex-1 min-w-0">
                {baseName}
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 flex-shrink-0 text-gray-400 transition-transform duration-200 group-hover/desc:text-slate-600 ${isExpanded ? "rotate-180" : ""}`}
              />
            </button>

            {/* Variation dropdown — only shown when >1 variation */}
            {hasMultipleVariations && (
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger className="h-7 w-full max-w-[180px] text-xs border-slate-200 focus:ring-slate-900 px-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {variations.map((v) => (
                    <SelectItem key={v.productId} value={v.productId} className="text-xs">
                      {v.variation}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Single variation label (no dropdown) */}
            {!hasMultipleVariations && variations[0].variation !== "Standard" && (
              <span className="text-xs text-slate-400">
                {variations[0].variation}
              </span>
            )}
          </div>

          {/* Price — grid col 4, updates with selected variation */}
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-slate-900">
              {ZAR.format(selected.price)}
            </span>
            {selected.discountType && (
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
            className="text-xs font-semibold px-4 py-2 bg-slate-900 text-white rounded hover:bg-slate-800 active:scale-[0.98] transition-all"
          >
            Add
          </button>
        </div>
      </div>

      {/* ── Expanded accordion panel ── */}
      {isExpanded && (
        <div
          id={`desc-panel-${selected.productId}`}
          className="col-span-full bg-slate-50 border-t border-gray-100 px-4 py-4 md:px-6 rounded-b-lg"
        >
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
            Description
          </p>
          <p className="text-sm text-slate-700 leading-relaxed">
            {selected.description ?? selected.name}
          </p>

          {selected.details && (
            <div className="mt-4">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                Specifications
              </p>
              <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                {selected.details}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
