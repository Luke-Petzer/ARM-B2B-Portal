import { describe, it, expect, vi, beforeEach } from "vitest";

// Stub persist so tests never touch localStorage
vi.mock("zustand/middleware", () => ({
  persist: (fn: (set: unknown, get: unknown, api: unknown) => unknown, _options: unknown) => fn,
}));

import { useConsentStore } from "@/lib/consent/store";

const reset = () =>
  useConsentStore.setState({
    status: "pending",
    preferences: { necessary: true, analytics: false, marketing: false },
    modalOpen: false,
  });

describe("useConsentStore", () => {
  beforeEach(reset);

  it("starts in pending status", () => {
    expect(useConsentStore.getState().status).toBe("pending");
  });

  it("acceptAll sets status accepted and all preferences true", () => {
    useConsentStore.getState().acceptAll();
    const { status, preferences } = useConsentStore.getState();
    expect(status).toBe("accepted");
    expect(preferences.analytics).toBe(true);
    expect(preferences.marketing).toBe(true);
    expect(preferences.necessary).toBe(true);
  });

  it("rejectAll sets status rejected and non-necessary to false", () => {
    useConsentStore.getState().acceptAll();
    useConsentStore.getState().rejectAll();
    const { status, preferences } = useConsentStore.getState();
    expect(status).toBe("rejected");
    expect(preferences.analytics).toBe(false);
    expect(preferences.marketing).toBe(false);
    expect(preferences.necessary).toBe(true);
  });

  it("openModal sets modalOpen true", () => {
    useConsentStore.getState().openModal();
    expect(useConsentStore.getState().modalOpen).toBe(true);
  });

  it("closeModal sets modalOpen false", () => {
    useConsentStore.getState().openModal();
    useConsentStore.getState().closeModal();
    expect(useConsentStore.getState().modalOpen).toBe(false);
  });

  it("updatePreference toggles individual category", () => {
    useConsentStore.getState().updatePreference("analytics", true);
    expect(useConsentStore.getState().preferences.analytics).toBe(true);
    useConsentStore.getState().updatePreference("analytics", false);
    expect(useConsentStore.getState().preferences.analytics).toBe(false);
  });

  it("saveCustom sets status customised and closes modal", () => {
    useConsentStore.getState().openModal();
    useConsentStore.getState().updatePreference("analytics", true);
    useConsentStore.getState().saveCustom();
    expect(useConsentStore.getState().status).toBe("customised");
    expect(useConsentStore.getState().modalOpen).toBe(false);
  });

  it("hasConsented returns false when category is false", () => {
    expect(useConsentStore.getState().hasConsented("analytics")).toBe(false);
  });

  it("hasConsented returns true after enabling that category", () => {
    useConsentStore.getState().updatePreference("analytics", true);
    expect(useConsentStore.getState().hasConsented("analytics")).toBe(true);
  });

  it("necessary preference stays true after rejectAll", () => {
    useConsentStore.getState().rejectAll();
    expect(useConsentStore.getState().preferences.necessary).toBe(true);
  });
});
