"use client";

import { useRef, useEffect, useCallback } from "react";

/**
 * Hook that enables horizontal drag-to-scroll on a container element.
 * Distinguishes between clicks (< 5px movement) and drags.
 * Applies cursor: grab / grabbing styles.
 */
export function useDragScroll<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startScrollLeft = useRef(0);
  const hasDragged = useRef(false);

  const DRAG_THRESHOLD = 5;

  const handleMouseDown = useCallback((e: MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    isDragging.current = true;
    hasDragged.current = false;
    startX.current = e.pageX - el.offsetLeft;
    startScrollLeft.current = el.scrollLeft;
    el.style.cursor = "grabbing";
    el.style.userSelect = "none";
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current) return;
    const el = ref.current;
    if (!el) return;
    e.preventDefault();
    const x = e.pageX - el.offsetLeft;
    const walk = x - startX.current;
    if (Math.abs(walk) > DRAG_THRESHOLD) {
      hasDragged.current = true;
    }
    el.scrollLeft = startScrollLeft.current - walk;
  }, []);

  const handleMouseUp = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    isDragging.current = false;
    el.style.cursor = "grab";
    el.style.userSelect = "";
  }, []);

  const handleClick = useCallback((e: MouseEvent) => {
    if (hasDragged.current) {
      e.preventDefault();
      e.stopPropagation();
      hasDragged.current = false;
    }
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    el.style.cursor = "grab";
    el.addEventListener("mousedown", handleMouseDown);
    el.addEventListener("mousemove", handleMouseMove);
    el.addEventListener("mouseup", handleMouseUp);
    el.addEventListener("mouseleave", handleMouseUp);
    el.addEventListener("click", handleClick, true);

    return () => {
      el.removeEventListener("mousedown", handleMouseDown);
      el.removeEventListener("mousemove", handleMouseMove);
      el.removeEventListener("mouseup", handleMouseUp);
      el.removeEventListener("mouseleave", handleMouseUp);
      el.removeEventListener("click", handleClick, true);
    };
  }, [handleMouseDown, handleMouseMove, handleMouseUp, handleClick]);

  return ref;
}
