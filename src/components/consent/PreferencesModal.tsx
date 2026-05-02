"use client";

import { useConsentStore } from "@/lib/consent/store";

const CATEGORIES = [
  {
    key: "necessary" as const,
    label: "Strictly Necessary",
    description:
      "Session authentication cookies required for you to log in and use the portal. Cannot be disabled.",
    locked: true,
  },
  {
    key: "analytics" as const,
    label: "Analytics",
    description:
      "Help us understand how visitors use the site so we can improve it. No data is sold to third parties.",
    locked: false,
  },
  {
    key: "marketing" as const,
    label: "Marketing",
    description:
      "Allow us to show you relevant promotions. No data is sold to third parties.",
    locked: false,
  },
];

export default function PreferencesModal() {
  const modalOpen = useConsentStore((s) => s.modalOpen);
  const preferences = useConsentStore((s) => s.preferences);
  const closeModal = useConsentStore((s) => s.closeModal);
  const updatePreference = useConsentStore((s) => s.updatePreference);
  const saveCustom = useConsentStore((s) => s.saveCustom);

  if (!modalOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Cookie preferences"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4"
      onClick={(e) => {
        // Close on backdrop click
        if (e.target === e.currentTarget) closeModal();
      }}
    >
      <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-slate-900">Cookie Preferences</h2>
          <p className="mt-1 text-sm text-slate-500">
            Choose which cookies you allow. You can change these at any time via the Cookie
            Settings link in the footer.
          </p>
        </div>

        {/* Category toggles */}
        <div className="px-6 py-4 space-y-5">
          {CATEGORIES.map(({ key, label, description, locked }) => {
            const checked = key === "necessary" ? true : preferences[key];
            return (
              <div key={key} className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900">{label}</p>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{description}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={checked}
                  aria-label={`${label} cookies`}
                  disabled={locked}
                  onClick={() => {
                    if (!locked && key !== "necessary") {
                      updatePreference(key, !preferences[key]);
                    }
                  }}
                  className={[
                    "relative flex-shrink-0 mt-0.5 h-6 w-11 rounded-full transition-colors",
                    checked ? "bg-slate-900" : "bg-slate-200",
                    locked ? "opacity-60 cursor-not-allowed" : "cursor-pointer",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform",
                      checked ? "translate-x-6" : "translate-x-1",
                    ].join(" ")}
                  />
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer actions */}
        <div className="px-6 pb-6 flex items-center justify-end gap-2 border-t border-gray-100 pt-4">
          <button
            type="button"
            onClick={closeModal}
            className="text-xs font-semibold px-4 py-2 border border-gray-200 rounded text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={saveCustom}
            className="text-xs font-semibold px-4 py-2 bg-slate-900 text-white rounded hover:bg-slate-800 transition-colors"
          >
            Save preferences
          </button>
        </div>
      </div>
    </div>
  );
}
