"use client";

import { useState } from "react";

interface QuantityStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}

export default function QuantityStepper({
  value,
  onChange,
  min = 1,
  max,
}: QuantityStepperProps) {
  /*
   * `raw` holds the text currently shown in the input while it is focused.
   * `isFocused` determines whether to show `raw` (typed) or `value` (parent).
   * This lets users delete the default "1" and type a new number freely,
   * while the +/− buttons always reflect the real parent state when unfocused.
   */
  const [raw, setRaw] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  const displayValue = isFocused ? raw : String(value);

  const decrement = () => {
    if (value > min) onChange(value - 1);
  };
  const increment = () => {
    if (max === undefined || value < max) onChange(value + 1);
  };

  const handleFocus = () => {
    setRaw(String(value));
    setIsFocused(true);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRaw(e.target.value);
    const n = parseInt(e.target.value, 10);
    if (!isNaN(n) && n >= min) {
      onChange(max !== undefined ? Math.min(n, max) : n);
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    const n = parseInt(raw, 10);
    if (isNaN(n) || n < min) {
      // Empty or invalid — fall back to minimum (1)
      onChange(min);
    } else {
      const clamped = max !== undefined ? Math.min(n, max) : n;
      onChange(clamped);
    }
  };

  return (
    <div className="flex items-center border border-gray-200 rounded-md overflow-hidden bg-white w-fit">
      <button
        type="button"
        onClick={decrement}
        className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-slate-900 hover:bg-gray-50 transition-colors"
        aria-label="Decrease quantity"
      >
        −
      </button>
      <input
        type="number"
        value={displayValue}
        min={min}
        max={max}
        onFocus={handleFocus}
        onChange={handleChange}
        onBlur={handleBlur}
        className="w-16 text-center text-[13px] font-medium border-x border-gray-100 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        aria-label="Quantity"
      />
      <button
        type="button"
        onClick={increment}
        className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-slate-900 hover:bg-gray-50 transition-colors"
        aria-label="Increase quantity"
      >
        +
      </button>
    </div>
  );
}
