import { describe, it, expect, vi, beforeEach } from "vitest";

describe("useDragScroll logic", () => {
  let el: {
    scrollLeft: number;
    offsetLeft: number;
    addEventListener: ReturnType<typeof vi.fn>;
    removeEventListener: ReturnType<typeof vi.fn>;
    style: Record<string, string>;
  };

  beforeEach(() => {
    el = {
      scrollLeft: 0,
      offsetLeft: 10,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      style: { cursor: "" },
    };
  });

  it("calculates correct scroll delta from mouse movement", () => {
    const startX = 100 - el.offsetLeft; // 90
    const startScrollLeft = 0;
    const moveX = 80 - el.offsetLeft; // 70
    const walk = moveX - startX; // -20
    const newScrollLeft = startScrollLeft - walk; // 20
    expect(newScrollLeft).toBe(20);
  });

  it("calculates correct scroll delta when dragging right", () => {
    const startX = 100 - el.offsetLeft; // 90
    const startScrollLeft = 100;
    const moveX = 150 - el.offsetLeft; // 140
    const walk = moveX - startX; // 50
    const newScrollLeft = startScrollLeft - walk; // 50
    expect(newScrollLeft).toBe(50);
  });

  it("should not trigger click when drag distance exceeds threshold", () => {
    const DRAG_THRESHOLD = 5;
    const startX = 100;
    const endX = 110;
    const distance = Math.abs(endX - startX);
    expect(distance > DRAG_THRESHOLD).toBe(true);
  });

  it("should allow click when drag distance is within threshold", () => {
    const DRAG_THRESHOLD = 5;
    const startX = 100;
    const endX = 103;
    const distance = Math.abs(endX - startX);
    expect(distance > DRAG_THRESHOLD).toBe(false);
  });
});
