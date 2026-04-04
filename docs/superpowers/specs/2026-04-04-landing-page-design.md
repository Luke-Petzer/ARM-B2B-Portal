# AR Steel Manufacturing — Landing Page Design Spec
**Date:** 2026-04-04  
**Branch:** system-simplified  
**Approach:** Inspired & Simplified (Approach 2)

---

## Overview

Replace the existing minimal `src/app/page.tsx` with a full portfolio/showcase landing page for AR Steel Manufacturing. The page showcases the business's 7 service departments to potential clients. It sits in front of the ordering portal and links buyers to `/login`.

This is a sales/demo page — copy and images are placeholders. The client will supply final assets after approving the design.

---

## Middleware Fix

The current middleware redirects all unauthenticated users to `/login`, making the landing page unreachable. The `/` route must be added to the public whitelist in `src/middleware.ts` so unauthenticated visitors can access the landing page.

---

## Typography

| Role | Font | Source |
|------|------|--------|
| Display / Headings | Bebas Neue | `next/font/google` |
| Body / UI | Inter | Already in app (`var(--font-inter)`) |

Bebas Neue is loaded via `next/font/google` in `src/app/page.tsx` (page-level, not root layout — avoids polluting the ordering portal font stack).

---

## Colour Palette

Matches existing AR Steel brand from the ordering portal and catalogue.

| Token | Value | Usage |
|-------|-------|-------|
| Background | `#050d14` | Page background, hero, navbar at top |
| Surface | `#0a1929` | Navbar pill, CTA section, footer |
| Surface Light | `#112236` | Department row alternating tint |
| Border | `rgba(255,255,255,0.08)` | Subtle dividers, pill border |
| Text Primary | `#ffffff` | Headings, button labels |
| Text Muted | `#8a9ab0` | Body copy, nav links, subtitles |
| Primary Blue | `hsl(215 75% 21%)` | Matches existing `--primary` CSS var |

---

## Page Structure

```
<Navbar />           — scroll-aware, three states
<Hero />             — full viewport, seamless with navbar
<Departments />      — 7 alternating rows, id="services"
<CTABanner />        — full-width call to action
<Footer />           — id="footer", three columns
```

All implemented in a single `src/app/page.tsx`. No new component files.

**Client component requirement:** The scroll-aware navbar requires `useState` and `useEffect`, so `page.tsx` must have the `'use client'` directive. This means the existing Supabase `displayName` fetch cannot run server-side on this page. The business name is hardcoded as `"AR Steel Manufacturing"` — this is a portfolio/demo page, not a multi-tenant view.

---

## Section 1: Navbar

### Three States

**State 1 — At Top (default)**
- Position: `fixed`, `top-0`, full viewport width
- Background: transparent (hero bleeds through)
- Padding: `px-8 md:px-16 lg:px-24 py-8` — generous, spacious
- Layout: logo left · nav links + login button right, spread across full width
- No border, no backdrop blur

**State 2 — Scrolled Down (pill)**
- Triggers at ~80px scroll
- Animates (300ms ease) into a centered floating pill
- Max-width: ~680px, centered with `mx-auto`
- Background: `#0a1929`, border: `1px solid rgba(255,255,255,0.1)`, `rounded-full`
- Backdrop blur: `backdrop-blur-md`
- Padding tightens: `px-6 py-3`
- Logo shrinks, items pull closer together

**State 3 — Hidden**
- Triggers when scrolling down past ~200px from pill activation
- Slides up with `translateY(-100%)`, `transition: transform 300ms ease`

**State 4 — Reappear**
- Triggers on any upward scroll
- Slides back down to pill position

### Nav Items
- **Logo**: `/logo.png`, `next/image`, height 40px at top / 32px in pill
- **Services**: Inter, small, muted → anchors to `#services`
- **Contact Us**: Inter, small, muted → anchors to `#footer`
- **Login**: White border button, Bebas Neue label, `rounded-full`, → `/login`

---

## Section 2: Hero

Full viewport height (`min-h-screen`). Same `#050d14` background — completely seamless with the transparent navbar.

**Content (centered, left-aligned on desktop):**
- Eyebrow label: `"AR · STEEL MANUFACTURING"` — Inter, `tracking-[0.3em]`, uppercase, muted, small
- Diamond accent: small rotated square (`w-2 h-2`) before eyebrow
- Headline: `"Built From Steel.\nBuilt to Last."` — Bebas Neue, `text-7xl md:text-8xl lg:text-9xl`, white
- Subheading: one-line descriptor — Inter, `text-lg`, muted, `max-w-xl`
- Buttons row:
  - Primary: `"Our Services"` — white fill, dark text, scrolls to `#services`
  - Secondary: `"Login"` — white border only, → `/login`

**Background texture:**
- Faint CSS grid pattern (`background-image: linear-gradient`) — very low opacity (`0.04`), dark lines on dark bg. CSS only, no images.

**Scroll indicator:**
- Animated bouncing arrow at bottom-left, muted colour

---

## Section 3: Department Rows (`id="services"`)

7 rows. Alternating layout: odd rows (1,3,5,7) → text left / image right. Even rows (2,4,6) → image left / text right.

### Per-Row Structure

**Text half:**
- Ghost number (`01`–`07`): Bebas Neue, `text-[160px]`, `opacity-5`, absolute positioned behind text
- Department name: Bebas Neue, `text-5xl md:text-6xl`, white, uppercase
- Animated underline: `div` that grows from `w-0` to `w-full` on row hover, `bg-white/20`, `h-px`, `transition-all duration-700`
- Subtitle: Inter, bold, uppercase, small, `tracking-widest`, white — lists key products/services
- Description: Inter, `text-muted`, `text-lg`, `leading-relaxed`, 2–3 sentences
- No "View More" links — content only, no CTAs per row

**Image half:**
- `aspect-[4/3]` container
- Unsplash placeholder image via `<img>` (not `next/image` — avoids domain config for external URLs)
- Default: `grayscale` + `contrast-125`
- On row hover: `grayscale-0`, `scale-105` — `transition-all duration-700`
- Subtle dark overlay via pseudo-element or `div` overlay, fades on hover

### The 7 Departments

| # | Name | Subtitle | Unsplash Query |
|---|------|----------|----------------|
| 01 | Custom Steel Fabrication | Laser Cutting · CNC Bending · Custom Metalwork | laser cutting steel |
| 02 | Perimeter Security | Razor Wire · Wall Spikes · Palisade Systems | security fence industrial |
| 03 | Gate & Access Hardware | Hinges · Catches · Lock Boxes · Security Bolts | industrial gate hardware |
| 04 | Sliding Gate Systems | Wheels · Tracks · Guides · Automation Ready | sliding gate industrial |
| 05 | Roofing & Construction | Flashings · Truss Hangers · Bracing · Nail Plates | roofing construction steel |
| 06 | Carport & Outdoor Structures | Round & Square Poles · Washing Line Poles | carport steel structure |
| 07 | Workshop & Welding Supplies | Argo Welding Rods · Cutting Disks · Tools | welding workshop tools |

### Row Backgrounds
- Odd rows: `#050d14`
- Even rows: `#0a1929` (subtle alternating tint)
- Generous vertical padding: `py-24 md:py-32`

---

## Section 4: CTA Banner

Full-width section, `#0a1929` background. Centered content:
- Heading: `"Ready to Place an Order?"` — Bebas Neue, `text-5xl md:text-6xl`, white
- Subtext: `"Log in to access pricing, place orders and manage your account."` — Inter, muted
- Button: `"Login to Order"` — white fill, dark text, Bebas Neue label, → `/login`
- Decorative: two large rotated border squares (CSS only), absolute positioned, very low opacity

---

## Section 5: Footer (`id="footer"`)

Background: `#03080c`. Top border: `border-white/10`.

**Three columns:**
1. **Brand** — logo + one-line descriptor, small muted text
2. **Quick Links** — Services (anchor `#services`), Login (`/login`)
3. **Contact** — Phone placeholder, Email placeholder, Address placeholder (client to fill)

**Bottom bar:**
- `"© 2026 AR Steel Manufacturing. All rights reserved."` — Inter, `text-xs`, muted
- Right: Social icon placeholders (LinkedIn, Instagram) — lucide-react icons

---

## Scroll Behaviour

- `scroll-smooth` must be **added** to the `<html>` element in `src/app/layout.tsx` — it is not currently set
- Anchor links use `href="#services"` and `href="#footer"`
- The `<html>` element currently has `overflow-hidden` in the root layout — **this must be removed for the landing page.** The landing page needs normal scroll. The fix: remove `overflow-hidden` from the root `<html>` and `<body>` in `layout.tsx`, and instead add it scoped to the portal layout (`src/app/(portal)/layout.tsx`) and admin layout (`src/app/(admin)/layout.tsx`) where it's actually needed.

---

## Middleware Fix Detail

File: `src/middleware.ts`

Add `"/"` to the list of public routes that skip the auth redirect. The landing page is intentionally public-facing.

---

## Accessibility

- All images have descriptive `alt` text
- Nav links have clear labels
- Colour contrast meets 4.5:1 for body text on dark backgrounds
- Focus states preserved on all interactive elements
- `prefers-reduced-motion`: hover transitions and navbar animation wrapped in `@media (prefers-reduced-motion: no-preference)`

---

## What This Spec Does NOT Cover

- Final copy (placeholder text throughout)
- Final images (Unsplash placeholders, client to supply)
- Contact form (footer has contact info only, no form)
- Mobile menu (hamburger) — nav collapses gracefully on mobile but no drawer/sheet
- SEO metadata — out of scope for this pass
