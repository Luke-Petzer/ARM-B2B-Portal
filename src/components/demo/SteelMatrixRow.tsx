"use client";

import { useState, useRef } from "react";
import { ShoppingCart, CheckCircle } from "lucide-react";

// ---------------------------------------------------------------------------
// Static data model — Equal Angle Grade Mild Steel
// ---------------------------------------------------------------------------

const steelData = {
  name: "Equal Angle Grade Mild Steel",
  pricePerKg: 18.5,
  dimensions: {
    "25 x 25": { "2mm": 0.777, "2.5mm": 0.954, "3mm": 1.114, "4mm": 1.773 },
    "30 x 30": { "2.5mm": 0.953, "3mm": 1.171, "4mm": 1.363, "5mm": 2.18 },
    "40 x 40": { "3mm": 1.285, "4mm": 1.582, "5mm": 1.874, "6mm": 2.417 },
  } as Record<string, Record<string, number>>,
};

const ZAR = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
  minimumFractionDigits: 2,
});

// ---------------------------------------------------------------------------
// Hover-to-zoom image
// ---------------------------------------------------------------------------

function ZoomableImage({ src, alt }: { src: string; alt: string }) {
  const [hovered, setHovered] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const wrapRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPos({ x: e.clientX - rect.left + 16, y: e.clientY - rect.top - 150 });
  };

  return (
    <div
      ref={wrapRef}
      className="relative w-12 h-12 cursor-zoom-in"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseMove={handleMouseMove}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="w-12 h-12 object-cover rounded-lg border border-slate-200"
      />
      {hovered && (
        <div
          className="absolute z-50 pointer-events-none rounded-xl overflow-hidden border-2 border-slate-300 shadow-2xl"
          style={{ left: pos.x, top: pos.y, width: 300, height: 300 }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={alt} className="w-full h-full object-cover" />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Success toast
// ---------------------------------------------------------------------------

function Toast({ visible }: { visible: boolean }) {
  return (
    <div
      className={`flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg shadow-lg transition-all duration-300 whitespace-nowrap ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1 pointer-events-none"
      }`}
    >
      <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
      Added!
    </div>
  );
}

// ---------------------------------------------------------------------------
// SteelMatrixRow — 12-column grid, same spans as header
// col-span-1  Image
// col-span-3  Product title
// col-span-2  Dimension dropdown
// col-span-2  Thickness dropdown
// col-span-2  Length input
// col-span-2  Price + action
// ---------------------------------------------------------------------------

export default function SteelMatrixRow() {
  const dimensionKeys = Object.keys(steelData.dimensions);
  const [dimension, setDimension] = useState(dimensionKeys[0]);
  const thicknessKeys = Object.keys(steelData.dimensions[dimension]);
  const [thickness, setThickness] = useState(thicknessKeys[0]);
  const [length, setLength] = useState(6);
  const [toastVisible, setToastVisible] = useState(false);

  const handleDimensionChange = (dim: string) => {
    setDimension(dim);
    setThickness(Object.keys(steelData.dimensions[dim])[0]);
  };

  const kgPerMeter = steelData.dimensions[dimension]?.[thickness] ?? 0;
  const totalWeight = parseFloat((length * kgPerMeter).toFixed(3));
  const totalPrice = parseFloat((totalWeight * steelData.pricePerKg).toFixed(2));

  const handleAddToCart = () => {
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2500);
  };

  const placeholderImage =
    "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=300&h=300&fit=crop&auto=format";

  const selectClass =
    "w-full h-9 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 cursor-pointer transition-all";

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-200 px-4 py-4">
      <div className="grid grid-cols-12 gap-4 items-center">

        {/* col-span-1 — Image */}
        <div className="col-span-1 flex items-center">
          <ZoomableImage src={placeholderImage} alt={steelData.name} />
        </div>

        {/* col-span-3 — Product title */}
        <div className="col-span-3">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-0.5">
            Structural Steel
          </p>
          <p className="text-sm font-bold text-slate-900 leading-tight">
            {steelData.name}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {ZAR.format(steelData.pricePerKg)}/kg
          </p>
        </div>

        {/* col-span-2 — Dimension dropdown */}
        <div className="col-span-2">
          <select
            value={dimension}
            onChange={(e) => handleDimensionChange(e.target.value)}
            className={selectClass}
          >
            {dimensionKeys.map((dim) => (
              <option key={dim} value={dim}>
                {dim} mm
              </option>
            ))}
          </select>
        </div>

        {/* col-span-2 — Thickness dropdown (cascades) */}
        <div className="col-span-2">
          <select
            value={thickness}
            onChange={(e) => setThickness(e.target.value)}
            className={selectClass}
          >
            {thicknessKeys.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        {/* col-span-2 — Length input */}
        <div className="col-span-2">
          <input
            type="number"
            min={0.1}
            step={0.1}
            value={length}
            onChange={(e) =>
              setLength(Math.max(0, parseFloat(e.target.value) || 0))
            }
            className="w-full h-9 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all"
          />
        </div>

        {/* col-span-2 — Price + Add to Cart */}
        <div className="col-span-2 flex flex-col items-end gap-1.5">
          <div className="text-right">
            <p className="text-xs text-slate-500 tabular-nums">
              {totalWeight.toFixed(2)} kg
            </p>
            <p className="text-base font-black text-emerald-700 tabular-nums leading-tight">
              {ZAR.format(totalPrice)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Toast visible={toastVisible} />
            <button
              type="button"
              onClick={handleAddToCart}
              className="h-8 px-3 bg-slate-900 hover:bg-slate-700 active:scale-[0.97] text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-1.5 transition-all duration-150 whitespace-nowrap"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              Add
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
