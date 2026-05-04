import { describe, it, expect } from "vitest";

describe("ClientDrawer FormData preparation", () => {
  const VALID_UUID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

  it("formData.set ensures id is present even if hidden input is missing", () => {
    const formData = new FormData();
    formData.set("account_number", "ACC-001");
    formData.set("business_name", "Test Corp");
    formData.set("role", "buyer_30_day");

    expect(formData.get("id")).toBeNull();

    formData.set("id", VALID_UUID);

    expect(formData.get("id")).toBe(VALID_UUID);
  });

  it("formData.set overwrites a stale or empty id from the DOM", () => {
    const formData = new FormData();
    formData.set("id", "");

    formData.set("id", VALID_UUID);

    expect(formData.get("id")).toBe(VALID_UUID);
  });

  it("formData.set preserves other form fields", () => {
    const formData = new FormData();
    formData.set("account_number", "ACC-001");
    formData.set("business_name", "Test Corp");
    formData.set("role", "buyer_30_day");
    formData.set("contact_name", "John Doe");

    formData.set("id", VALID_UUID);

    expect(formData.get("id")).toBe(VALID_UUID);
    expect(formData.get("account_number")).toBe("ACC-001");
    expect(formData.get("business_name")).toBe("Test Corp");
    expect(formData.get("role")).toBe("buyer_30_day");
    expect(formData.get("contact_name")).toBe("John Doe");
  });
});
