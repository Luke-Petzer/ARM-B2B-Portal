"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ConsentStatus = "pending" | "accepted" | "rejected" | "customised";

export interface ConsentPreferences {
  necessary: boolean; // always true — cannot be disabled
  analytics: boolean;
  marketing: boolean;
}

interface ConsentState {
  status: ConsentStatus;
  preferences: ConsentPreferences;
  modalOpen: boolean;
  acceptAll: () => void;
  rejectAll: () => void;
  openModal: () => void;
  closeModal: () => void;
  updatePreference: (category: "analytics" | "marketing", value: boolean) => void;
  saveCustom: () => void;
  hasConsented: (category: "analytics" | "marketing") => boolean;
}

const DEFAULT_PREFERENCES: ConsentPreferences = {
  necessary: true,
  analytics: false,
  marketing: false,
};

export const useConsentStore = create<ConsentState>()(
  persist(
    (set, get) => ({
      status: "pending",
      preferences: { ...DEFAULT_PREFERENCES },
      modalOpen: false,

      acceptAll: () =>
        set({
          status: "accepted",
          preferences: { necessary: true, analytics: true, marketing: true },
        }),

      rejectAll: () =>
        set({
          status: "rejected",
          preferences: { ...DEFAULT_PREFERENCES },
        }),

      openModal: () => set({ modalOpen: true }),
      closeModal: () => set({ modalOpen: false }),

      updatePreference: (category, value) =>
        set((state) => ({
          preferences: { ...state.preferences, [category]: value },
        })),

      saveCustom: () => set({ status: "customised", modalOpen: false }),

      hasConsented: (category) => get().preferences[category] === true,
    }),
    {
      name: "cookie-consent-v1",
      // modalOpen is transient UI state — do not persist
      partialize: (state) => ({
        status: state.status,
        preferences: state.preferences,
      }),
    }
  )
);
