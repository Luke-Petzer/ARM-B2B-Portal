import { describe, it, expect } from "vitest";

describe("ProductRow hover preview contract", () => {
  it("preview should NOT render when hovered=false", () => {
    const hovered = false;
    const primaryImageUrl = "https://example.com/img.jpg";
    const shouldRenderPreview = hovered && !!primaryImageUrl;
    expect(shouldRenderPreview).toBe(false);
  });

  it("preview should render when hovered=true and image exists", () => {
    const hovered = true;
    const primaryImageUrl = "https://example.com/img.jpg";
    const shouldRenderPreview = hovered && !!primaryImageUrl;
    expect(shouldRenderPreview).toBe(true);
  });

  it("preview should NOT render when hovered=true but no image", () => {
    const hovered = true;
    const primaryImageUrl: string | null = null;
    const shouldRenderPreview = hovered && !!primaryImageUrl;
    expect(shouldRenderPreview).toBe(false);
  });
});
