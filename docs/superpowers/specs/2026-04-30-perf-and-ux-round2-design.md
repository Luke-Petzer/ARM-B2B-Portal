# Performance & UX Round 2 — Design Spec

**Date:** 2026-04-30
**Status:** Approved
**Scope:** Three fixes targeting buyer-side perceived performance and mobile UX

---

## Table of Contents

1. [Fix A — Product list performance (hover previews + image sizing)](#fix-a--product-list-performance)
2. [Fix B — Catalogue page eager image loading](#fix-b--catalogue-page-eager-image-loading)
3. [Fix C — Category pills scrolling (mobile + desktop)](#fix-c--category-pills-scrolling)

---

## Fix A — Product list performance

### Problem

The product catalogue on the buyer dashboard loads slowly. With ~150+ products rendered at once (pagination is not allowed per client constraint), the browser fetches excessive image data on initial load.

### Root cause

Two issues in `src/components/portal/ProductRow.tsx`:

1. **Hover preview always in DOM (lines 87-94):** Every product row renders a 288×288 `<Image fill>` for the hover-zoom preview. It's hidden with `opacity-0 group-hover:opacity-100`, but the browser still downloads the image. With 150 products, that's 150 large images fetched on page load that the user will never see until they hover.

2. **Missing `sizes` on thumbnails (line 76-81):** The 44×44 thumbnail `<Image>` has no `sizes` prop. Next.js defaults to serving a much larger image than needed, wasting bandwidth per row.

### Solution

#### A1. Conditional hover preview rendering

Replace the always-rendered hover preview with a hover-state-driven conditional render. Only mount the `<Image fill>` when the user hovers over the thumbnail area.

**File:** `src/components/portal/ProductRow.tsx`

- Add `const [hovered, setHovered] = useState(false);`
- Add `onMouseEnter={() => setHovered(true)}` and `onMouseLeave={() => setHovered(false)}` on the thumbnail wrapper div (line 72)
- Change the hover preview block (lines 87-94) from always-rendered to `{hovered && primaryImageUrl && ( ... )}`. Remove the `opacity-0 group-hover:opacity-100` CSS transition since visibility is now controlled by React state.

**Trade-off:** The first hover on a product will show a brief image load (the 288px image wasn't prefetched). This is acceptable — users hover on one product at a time, and the image loads in ~100-200ms on a decent connection. The alternative (prefetching 150 images) is far worse.

#### A2. Add `sizes` to thumbnails

Add `sizes="44px"` to the thumbnail `<Image>` at line 76. This tells Next.js to serve a 44px-wide image (or 88px for 2x displays) instead of the default large size.

**File:** `src/components/portal/ProductRow.tsx` (same file as A1)

### Files changed (Fix A)

| File | Action |
|------|--------|
| `src/components/portal/ProductRow.tsx` | Add hover state for conditional preview render; add `sizes="44px"` to thumbnail |

### Testing

- Verify product thumbnails still display correctly at 44×44
- Verify hover preview appears on mouse enter and disappears on mouse leave
- Verify no hover preview images are fetched on initial page load (check Network tab, filter by image)
- Verify the hover preview image loads and displays correctly on first hover
- Verify mobile still works (no hover on touch devices — preview should not appear)

---

## Fix B — Catalogue page eager image loading

### Problem

The catalogue page (`src/app/catalogue/page.tsx`) renders 11 static WebP images. Currently only page 1 has `priority={true}`. All other pages use Next.js's default `loading="lazy"`, meaning they only start downloading when the user scrolls near them. The user wants above-the-fold content first, then everything else loading progressively in the background.

### Root cause

Next.js `<Image>` applies `loading="lazy"` by default unless `priority` is set. Pages 2-11 are lazy-loaded, causing a visible loading delay as the user scrolls.

### Solution

**File:** `src/app/catalogue/page.tsx`

1. **Page 1:** Already has `priority={true}` — keep as-is. This preloads the above-the-fold image.
2. **Pages 2-11:** Add `loading="eager"` so the browser starts downloading them immediately after page 1, without waiting for scroll. They load progressively in order.
3. **All pages:** Add `sizes="(max-width: 896px) 100vw, 896px"` — the images render inside a `max-w-4xl` container (896px). Without `sizes`, Next.js may serve the full 1240px source image even on smaller screens.

Implementation — update the `<Image>` in the `.map()`:

```tsx
<Image
  key={page.src}
  src={page.src}
  alt={page.alt}
  width={1240}
  height={1754}
  className="w-full h-auto block"
  sizes="(max-width: 896px) 100vw, 896px"
  priority={i === 0}
  loading={i === 0 ? undefined : "eager"}
/>
```

Note: When `priority` is set, Next.js ignores `loading`, so we pass `undefined` for page 1 and `"eager"` for the rest.

### Files changed (Fix B)

| File | Action |
|------|--------|
| `src/app/catalogue/page.tsx` | Add `sizes`, `loading="eager"` to catalogue images; use index in `.map()` |

### Testing

- Open catalogue page — verify page 1 loads instantly (above the fold)
- Check Network tab — verify pages 2-11 start downloading immediately (not on scroll)
- Verify images display correctly at all viewport widths
- Verify no layout shift (width/height are already specified)

---

## Fix C — Category pills scrolling

### Problem

The category navigation pills in `src/app/(portal)/dashboard/CatalogueShell.tsx` (lines 143-162) have `overflow-x-auto` with `scrollbarWidth: "none"` (Firefox-only). On WebKit browsers (Chrome, Safari), the scrollbar is still visible. On mobile, touch scrolling works but isn't optimised. On desktop, there's no way to drag-scroll the pills.

### Root cause

- `scrollbarWidth: "none"` is a Firefox-only CSS property
- No `::-webkit-scrollbar { display: none }` equivalent for Chrome/Safari
- No `touch-action: pan-x` for optimised mobile horizontal scrolling
- No mouse drag-to-scroll handlers for desktop

### Solution

#### C1. Hide scrollbar cross-browser

Add a CSS utility class that hides scrollbars in all browsers:

**File:** `src/app/globals.css`

```css
.scrollbar-hide {
  -ms-overflow-style: none;   /* IE/Edge */
  scrollbar-width: none;       /* Firefox */
}
.scrollbar-hide::-webkit-scrollbar {
  display: none;               /* Chrome/Safari/Opera */
}
```

Apply `scrollbar-hide` class to the pills container div and remove the inline `style={{ scrollbarWidth: "none" }}`.

#### C2. Mobile touch optimisation

Add `touch-action: pan-x` to the pills container. This tells the browser this element only scrolls horizontally, preventing vertical scroll interference on mobile.

#### C3. Desktop drag-to-scroll

Add mousedown/mousemove/mouseup handlers to enable click-and-drag scrolling on desktop. Extract this into a small custom hook `useDragScroll` to keep the component clean.

**File:** New hook `src/hooks/useDragScroll.ts`

```
useDragScroll():
  - Returns a ref to attach to the scrollable container
  - On mousedown: record startX and scrollLeft, set isDragging
  - On mousemove (if dragging): update scrollLeft based on delta
  - On mouseup/mouseleave: clear isDragging
  - Adds cursor: grab / cursor: grabbing styles
  - Cleans up event listeners on unmount
```

**File:** `src/app/(portal)/dashboard/CatalogueShell.tsx`

- Import and attach `useDragScroll` ref to the pills container div
- Add `scrollbar-hide` class, remove inline scrollbarWidth style
- Add `touch-action: pan-x` to the container

### Files changed (Fix C)

| File | Action |
|------|--------|
| `src/app/globals.css` | Add `.scrollbar-hide` utility class |
| `src/hooks/useDragScroll.ts` | **New** — custom hook for drag-to-scroll |
| `src/app/(portal)/dashboard/CatalogueShell.tsx` | Apply scrollbar-hide class, touch-action, useDragScroll hook |

### Testing

- Verify scrollbar is hidden on Chrome, Safari, Firefox
- Verify touch scrolling works on mobile (horizontal swipe on pills)
- Verify drag-to-scroll works on desktop (click and drag the pills)
- Verify clicking a pill still triggers `scrollToCategory` (drag vs click distinction)
- Verify cursor changes to `grab` on hover and `grabbing` while dragging

---

## Cumulative file change summary

| File | Fix | Action |
|------|-----|--------|
| `src/components/portal/ProductRow.tsx` | A | Conditional hover preview; `sizes` on thumbnail |
| `src/app/catalogue/page.tsx` | B | `sizes` + `loading="eager"` on catalogue images |
| `src/app/globals.css` | C | `.scrollbar-hide` utility class |
| `src/hooks/useDragScroll.ts` | C | **New** — drag-to-scroll hook |
| `src/app/(portal)/dashboard/CatalogueShell.tsx` | C | Scrollbar hiding, touch-action, drag-to-scroll |

**Total:** 4 modified files, 1 new file. No DB migrations. No new dependencies.

---

## Out of scope

- **Virtualisation (`react-window`):** Not needed — conditional hover preview rendering eliminates the main performance bottleneck (150 unnecessary image fetches). DOM node count with ~150 products is manageable.
- **`content-visibility: auto`:** Browser support is good but may cause layout shift with the current grid layout. Can be explored later.
- **UUID validation fix:** Dropped — only affects legacy seed data profiles. New Auth-created buyers work correctly.
- **Server-side image optimisation:** Next.js Image component already handles format conversion and resizing via `sizes` prop.
