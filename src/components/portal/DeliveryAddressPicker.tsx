"use client";

import { useState } from "react";
import { MapPin, ChevronDown, Plus } from "lucide-react";
import AddressGateForm from "@/components/auth/AddressGateForm";

export interface ShippingAddress {
  id: string;
  label: string | null;
  line1: string;
  line2: string | null;
  suburb: string | null;
  city: string;
  province: string | null;
  postal_code: string | null;
  is_default: boolean;
}

interface DeliveryAddressPickerProps {
  addresses: ShippingAddress[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAddressAdded: (addressId?: string) => void;
}

function formatAddress(addr: ShippingAddress): string {
  const parts = [addr.line1, addr.line2, addr.suburb, addr.city, addr.postal_code].filter(Boolean);
  return parts.join(", ");
}

export default function DeliveryAddressPicker({
  addresses,
  selectedId,
  onSelect,
  onAddressAdded,
}: DeliveryAddressPickerProps) {
  const [expanded, setExpanded] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  const selected = addresses.find((a) => a.id === selectedId) ?? addresses[0] ?? null;

  if (!selected && addresses.length === 0) {
    return (
      <div className="bg-white border border-gray-100 rounded-lg p-4 mb-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <MapPin className="w-4 h-4 text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-900">Delivery Address</h3>
        </div>
        <AddressGateForm onSaved={(addressId) => onAddressAdded(addressId)} />
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-100 rounded-lg shadow-sm mb-4">
      {/* Collapsed state */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-start justify-between p-4 text-left"
      >
        <div className="flex items-start gap-3 min-w-0">
          <MapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Delivery Address
            </p>
            {selected && (
              <>
                {selected.label && (
                  <p className="text-sm font-medium text-slate-900">{selected.label}</p>
                )}
                <p className="text-sm text-slate-600 truncate">
                  {formatAddress(selected)}
                </p>
              </>
            )}
          </div>
        </div>
        <span className="text-xs font-medium text-primary flex items-center gap-1 flex-shrink-0 mt-0.5">
          {expanded ? "Close" : "Change"}
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </span>
      </button>

      {/* Expanded state */}
      {expanded && (
        <div className="border-t border-gray-100 p-4 space-y-2">
          {addresses.map((addr) => (
            <label
              key={addr.id}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                addr.id === selectedId
                  ? "border-primary bg-primary/5"
                  : "border-slate-100 hover:border-slate-200"
              }`}
            >
              <input
                type="radio"
                name="delivery_address"
                value={addr.id}
                checked={addr.id === selectedId}
                onChange={() => {
                  onSelect(addr.id);
                  setExpanded(false);
                }}
                className="mt-0.5 accent-primary"
              />
              <div className="min-w-0">
                {addr.label && (
                  <p className="text-sm font-medium text-slate-900">{addr.label}</p>
                )}
                <p className="text-sm text-slate-600">{formatAddress(addr)}</p>
              </div>
            </label>
          ))}

          {!showAddForm ? (
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-2 w-full p-3 rounded-lg border border-dashed border-slate-200 text-sm text-slate-500 hover:border-slate-300 hover:text-slate-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add new address
            </button>
          ) : (
            <div className="pt-2">
              <AddressGateForm
                onSaved={(addressId) => {
                  setShowAddForm(false);
                  setExpanded(false);
                  onAddressAdded(addressId);
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
