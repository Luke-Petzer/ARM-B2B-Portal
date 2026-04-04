# Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the minimal placeholder landing page with a full-viewport portfolio/showcase site for AR Steel Manufacturing, fixing the routing that currently blocks unauthenticated access.

**Architecture:** Single `'use client'` page component in `src/app/page.tsx` with an inline scroll-aware navbar. Four supporting changes: routing fix in `src/proxy.ts`, overflow/scroll fix in `src/app/layout.tsx`, Bebas Neue font variable added to `tailwind.config.ts`, and `overflow-hidden` scoped to portal/admin sub-layouts (which already have it on their own wrapper divs).

**Tech Stack:** Next.js 16 App Router, Tailwind CSS, `next/font/google` (Bebas Neue), lucide-react, plain `<img>` for Unsplash placeholders.

---

## File Map

| Action | File | Purpose |
|--------|------|---------|
| Modify | `src/proxy.ts` | Stop redirecting unauthenticated users from `/` to `/login` |
| Modify | `src/app/layout.tsx` | Remove `overflow-hidden` + `h-[100dvh]` from root; add `scroll-smooth` |
| Modify | `tailwind.config.ts` | Add `bebas` font family pointing to `var(--font-bebas)` |
| Replace | `src/app/page.tsx` | Full landing page — navbar, hero, 7 dept rows, CTA, footer |

---

## Task 1: Fix proxy routing — let unauthenticated users reach the landing page

**Files:**
- Modify: `src/proxy.ts:87-102`

The current `if (pathname === "/")` block redirects unauthenticated visitors to `/login`. Change the fallthrough so they see the landing page instead. Authenticated buyers still go to `/dashboard`; authenticated admins still go to `/admin`.

- [ ] **Step 1: Open `src/proxy.ts` and replace the root redirect block**

Find this block (lines 87–102):
```ts
// ── Root redirect ────────────────────────────────────────────────────────
if (pathname === "/") {
  const buyerSession = await getBuyerSessionFromCookie(request);
  if (buyerSession) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const supabase = createMiddlewareClient(request, response);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  return NextResponse.redirect(new URL("/login", request.url));
}
```

Replace with:
```ts
// ── Root redirect ────────────────────────────────────────────────────────
if (pathname === "/") {
  const buyerSession = await getBuyerSessionFromCookie(request);
  if (buyerSession) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const supabase = createMiddlewareClient(request, response);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  // Unauthenticated users see the landing page
  return response;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/proxy.ts
git commit -m "fix(routing): allow unauthenticated users to reach landing page"
```

---

## Task 2: Fix root layout — enable page scroll and smooth anchors

**Files:**
- Modify: `src/app/layout.tsx`

The root layout currently applies `h-[100dvh] overflow-hidden` to both `<html>` and `<body>`, which locks the viewport and prevents the landing page from scrolling. The portal layout (`src/app/(portal)/layout.tsx`) and admin layout (`src/app/(admin)/layout.tsx`) already apply `overflow-hidden` on their own wrapper divs — so removing it from root does not break those views.

- [ ] **Step 1: Replace `src/app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AR Steel Manufacturing",
  description: "Precision-manufactured steel products and hardware solutions.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth" style={{ colorScheme: "light" }}>
      <body className={`${inter.variable} font-inter antialiased`}>
        {children}
      </body>
    </html>
  );
}
```

Key changes from the original:
- `h-[100dvh] overflow-hidden` removed from `<html>` and `<body>`
- `scroll-smooth` added to `<html>`
- Metadata updated to reflect the business

- [ ] **Step 2: Verify portal and admin layouts still constrain their own overflow**

Open `src/app/(portal)/layout.tsx` — confirm the wrapper div has `h-[100dvh] overflow-hidden` (line 44). No change needed.

Open `src/app/(admin)/layout.tsx` — confirm the wrapper div has `h-[100dvh] overflow-hidden` (line 31). No change needed.

- [ ] **Step 3: Commit**

```bash
git add src/app/layout.tsx
git commit -m "fix(layout): remove root overflow-hidden to enable landing page scroll"
```

---

## Task 3: Add Bebas Neue font variable to Tailwind config

**Files:**
- Modify: `tailwind.config.ts`

Add `bebas` to the `fontFamily` extension so `font-bebas` is available as a Tailwind utility. The actual font is loaded page-level in `page.tsx` via `next/font/google` — this just wires the CSS variable into Tailwind.

- [ ] **Step 1: Edit `tailwind.config.ts`**

Find the `fontFamily` block:
```ts
fontFamily: {
  inter: ["var(--font-inter)", "Inter", "sans-serif"],
},
```

Replace with:
```ts
fontFamily: {
  inter: ["var(--font-inter)", "Inter", "sans-serif"],
  bebas: ["var(--font-bebas)", "sans-serif"],
},
```

- [ ] **Step 2: Commit**

```bash
git add tailwind.config.ts
git commit -m "chore(fonts): add bebas font family variable to Tailwind config"
```

---

## Task 4: Build the landing page

**Files:**
- Replace: `src/app/page.tsx`

Full `'use client'` component. Bebas Neue loaded via `next/font/google` and applied via `--font-bebas` CSS variable scoped to the page root div. Scroll state managed with `useState` + `useEffect`. No new files created.

- [ ] **Step 1: Replace `src/app/page.tsx` with the full landing page**

```tsx
'use client'

import { useEffect, useState, useRef } from 'react'
import { Bebas_Neue } from 'next/font/google'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowDown, Linkedin, Instagram, Phone, Mail, MapPin } from 'lucide-react'

const bebasNeue = Bebas_Neue({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-bebas',
})

type NavState = 'top' | 'pill' | 'hidden'

const departments = [
  {
    number: '01',
    name: 'Custom Steel Fabrication',
    subtitle: 'Laser Cutting · CNC Bending · Custom Metalwork',
    description:
      'From concept to finished component — we cut, bend and fabricate structural steel to exact tolerances. Our CNC laser cutting and press braking capabilities handle complex geometries for bespoke industrial applications.',
    image: 'https://images.unsplash.com/photo-1565439387858-29759c5d315f?q=80&w=1800&auto=format&fit=crop',
    imageAlt: 'Laser cutting steel in a manufacturing facility',
  },
  {
    number: '02',
    name: 'Perimeter Security',
    subtitle: 'Razor Wire · Wall Spikes · Palisade Systems',
    description:
      'Comprehensive boundary protection solutions including razor wire concertinas, galvanised wall spikes and palisade systems. Engineered for maximum deterrence and long-term outdoor durability.',
    image: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?q=80&w=1800&auto=format&fit=crop',
    imageAlt: 'Industrial perimeter security fencing',
  },
  {
    number: '03',
    name: 'Gate & Access Hardware',
    subtitle: 'Hinges · Catches · Lock Boxes · Security Bolts',
    description:
      'A complete range of gate fittings — from heavy-duty hinges and gate catches to lock boxes, barrel bolts and drop bolts. Precision-machined hardware built for high-frequency use and reliable access control.',
    image: 'https://images.unsplash.com/photo-1581092334651-ddf26d9a09d0?q=80&w=1800&auto=format&fit=crop',
    imageAlt: 'Industrial gate hardware and fittings',
  },
  {
    number: '04',
    name: 'Sliding Gate Systems',
    subtitle: 'Wheels · Tracks · Guides · Automation Ready',
    description:
      'Full structural kits for heavy-duty sliding gates. Machined tracking profiles, high-load-bearing wheels, guide systems and rigid chassis frames — everything needed for smooth, reliable gate operation.',
    image: 'https://images.unsplash.com/photo-1513828742140-ccaa28f3eda0?q=80&w=1800&auto=format&fit=crop',
    imageAlt: 'Industrial sliding gate system components',
  },
  {
    number: '05',
    name: 'Roofing & Construction',
    subtitle: 'Flashings · Truss Hangers · Bracing · Nail Plates',
    description:
      'Essential structural hardware for commercial roofing and general construction. Galvanised flashings, truss hangers, bracing straps, hoop iron and nail plates — built to last in demanding site conditions.',
    image: 'https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?q=80&w=1800&auto=format&fit=crop',
    imageAlt: 'Roofing and construction steel hardware',
  },
  {
    number: '06',
    name: 'Carport & Outdoor Structures',
    subtitle: 'Round & Square Poles · Washing Line Poles',
    description:
      'Round and square carport poles in multiple diameters and thicknesses, plus washing line poles. Galvanised and treated for outdoor durability — supplied in bulk packs for trade and construction.',
    image: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1800&auto=format&fit=crop',
    imageAlt: 'Steel carport and outdoor structure poles',
  },
  {
    number: '07',
    name: 'Workshop & Welding Supplies',
    subtitle: 'Argo Welding Rods · Cutting Disks · Tools',
    description:
      'Professional-grade workshop essentials under the Argo range — welding rods in multiple weights, cutting disks in all standard sizes, and gate wheel kits. Reliable consumables for fabricators and contractors.',
    image: 'https://images.unsplash.com/photo-1530124566582-a618bc2615dc?q=80&w=1800&auto=format&fit=crop',
    imageAlt: 'Welding and workshop tools and supplies',
  },
]

export default function LandingPage() {
  const [navState, setNavState] = useState<NavState>('top')
  const lastScrollY = useRef(0)

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY
      const scrollingDown = currentScrollY > lastScrollY.current

      if (currentScrollY < 80) {
        setNavState('top')
      } else if (scrollingDown && currentScrollY > 280) {
        setNavState('hidden')
      } else {
        setNavState('pill')
      }

      lastScrollY.current = currentScrollY
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const isPill = navState === 'pill' || navState === 'hidden'

  return (
    <div className={`${bebasNeue.variable} min-h-screen bg-[#050d14] text-white`}>

      {/* ── NAVBAR ── */}
      <nav
        className={[
          'fixed z-50 flex items-center justify-between transition-all duration-300 ease-in-out',
          isPill
            ? 'left-1/2 -translate-x-1/2 top-4 w-[min(680px,calc(100vw-2rem))] px-6 py-3 rounded-full bg-[#0a1929] border border-white/10 backdrop-blur-md shadow-2xl'
            : 'left-0 right-0 top-0 w-full px-8 md:px-16 lg:px-24 py-8',
          navState === 'hidden' ? '-translate-y-[calc(100%+1rem)]' : '',
        ].join(' ')}
      >
        <Link href="/" className="flex-shrink-0">
          <Image
            src="/logo.png"
            alt="AR Steel Manufacturing"
            height={isPill ? 32 : 40}
            width={isPill ? 80 : 100}
            className="object-contain transition-all duration-300"
            priority
          />
        </Link>

        <div className="flex items-center gap-5 md:gap-8">
          <a
            href="#services"
            className="text-sm text-white/60 hover:text-white transition-colors duration-200 cursor-pointer font-inter hidden sm:block"
          >
            Services
          </a>
          <a
            href="#footer"
            className="text-sm text-white/60 hover:text-white transition-colors duration-200 cursor-pointer font-inter hidden sm:block"
          >
            Contact Us
          </a>
          <Link
            href="/login"
            className="text-sm border border-white/30 hover:border-white text-white px-5 py-2 rounded-full transition-all duration-200 font-bebas tracking-widest hover:bg-white/10 cursor-pointer"
          >
            Login
          </Link>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section
        className="relative min-h-screen flex items-center bg-[#050d14] overflow-hidden"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      >
        {/* Radial vignette to soften grid toward edges */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at center, transparent 40%, #050d14 100%)',
          }}
        />

        <div className="relative z-10 w-full max-w-[1400px] mx-auto px-8 md:px-16 lg:px-24 pt-40 pb-24">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-2 h-2 bg-white/50 rotate-45 flex-shrink-0" />
            <span className="text-white/40 font-inter text-xs tracking-[0.3em] uppercase">
              AR · Steel Manufacturing
            </span>
          </div>

          <h1 className="font-bebas text-[76px] md:text-[100px] lg:text-[120px] leading-[0.92] text-white mb-8 max-w-4xl">
            Built From Steel.<br />
            Built to Last.
          </h1>

          <p className="font-inter text-lg text-white/45 max-w-xl leading-relaxed mb-12 border-l-2 border-white/15 pl-6">
            Precision-manufactured steel products and hardware solutions for the
            construction, security and fabrication industries.
          </p>

          <div className="flex items-center gap-4 flex-wrap">
            <a
              href="#services"
              className="bg-white text-[#050d14] px-8 py-3 font-inter font-semibold text-sm hover:bg-white/90 transition-colors duration-200 cursor-pointer rounded-sm"
            >
              Our Services
            </a>
            <Link
              href="/login"
              className="border border-white/25 text-white px-8 py-3 font-inter font-semibold text-sm hover:bg-white/8 hover:border-white/50 transition-all duration-200 rounded-sm"
            >
              Login
            </Link>
          </div>
        </div>

        <div className="absolute bottom-10 left-8 md:left-16 lg:left-24 z-10">
          <ArrowDown className="w-5 h-5 text-white/25 animate-bounce" />
        </div>
      </section>

      {/* ── DEPARTMENTS ── */}
      <section id="services">
        {departments.map((dept, index) => {
          const isEven = index % 2 === 1
          return (
            <div
              key={dept.number}
              className={`group py-24 md:py-32 ${isEven ? 'bg-[#0a1929]' : 'bg-[#050d14]'}`}
            >
              <div className="max-w-[1400px] mx-auto px-8 md:px-16 lg:px-24">
                <div
                  className={`flex flex-col ${
                    isEven ? 'lg:flex-row-reverse' : 'lg:flex-row'
                  } items-center gap-12 lg:gap-20`}
                >
                  {/* Text half */}
                  <div className="w-full lg:w-5/12 flex flex-col items-start relative">
                    {/* Ghost section number */}
                    <span
                      className="font-bebas text-[120px] md:text-[160px] leading-none text-white/[0.04] select-none absolute -top-6 -left-2 pointer-events-none"
                      aria-hidden="true"
                    >
                      {dept.number}
                    </span>

                    <h2 className="font-bebas text-5xl md:text-6xl text-white uppercase leading-tight mb-3 relative z-10">
                      {dept.name}
                    </h2>

                    {/* Animated underline */}
                    <div className="h-px w-full bg-white/8 mb-5 relative overflow-hidden">
                      <div className="absolute inset-y-0 left-0 bg-white/30 w-0 group-hover:w-full transition-all duration-700 ease-in-out" />
                    </div>

                    <p className="font-inter text-[11px] font-semibold tracking-[0.2em] uppercase text-white/70 mb-5 flex items-center gap-3">
                      <span className="w-1.5 h-1.5 bg-white/40 rotate-45 flex-shrink-0 inline-block" />
                      {dept.subtitle}
                    </p>

                    <p className="font-inter text-base text-white/45 leading-relaxed">
                      {dept.description}
                    </p>
                  </div>

                  {/* Image half */}
                  <div className="w-full lg:w-7/12 overflow-hidden">
                    <div className="aspect-[4/3] overflow-hidden relative">
                      <div className="absolute inset-0 z-10 bg-[#050d14]/55 group-hover:bg-transparent transition-all duration-700" />
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={dept.image}
                        alt={dept.imageAlt}
                        className="w-full h-full object-cover grayscale contrast-110 group-hover:grayscale-0 group-hover:scale-105 transition-all duration-700 ease-out"
                        loading="lazy"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </section>

      {/* ── CTA BANNER ── */}
      <section className="relative py-32 bg-[#0a1929] overflow-hidden">
        <div className="absolute top-1/2 right-0 w-96 h-96 border border-white/[0.04] rotate-45 translate-x-1/2 -translate-y-1/2 pointer-events-none" />
        <div className="absolute top-1/2 left-0 w-64 h-64 border border-white/[0.04] rotate-45 -translate-x-1/2 -translate-y-1/2 pointer-events-none" />

        <div className="relative z-10 max-w-3xl mx-auto px-8 text-center">
          <div className="w-3 h-3 bg-white/15 rotate-45 mx-auto mb-8" />
          <h2 className="font-bebas text-5xl md:text-7xl text-white mb-5">
            Ready to Place an Order?
          </h2>
          <p className="font-inter text-white/45 text-lg mb-10 max-w-xl mx-auto leading-relaxed">
            Log in to access pricing, place orders and manage your account.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center bg-white text-[#050d14] px-10 py-4 font-bebas text-xl tracking-widest hover:bg-white/90 transition-colors duration-200 rounded-sm"
          >
            Login to Order
          </Link>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer id="footer" className="bg-[#03080c] border-t border-white/[0.05] pt-20 pb-10">
        <div className="max-w-[1400px] mx-auto px-8 md:px-16 lg:px-24">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-16">

            {/* Brand */}
            <div>
              <Image
                src="/logo.png"
                alt="AR Steel Manufacturing"
                height={40}
                width={100}
                className="object-contain mb-5"
              />
              <p className="font-inter text-sm text-white/35 leading-relaxed max-w-xs">
                Precision-manufactured steel products and hardware for the
                construction, security and fabrication industries.
              </p>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="font-bebas text-white tracking-widest text-lg mb-6 border-l-2 border-white/15 pl-3">
                Quick Links
              </h4>
              <ul className="space-y-3 font-inter text-sm text-white/40">
                <li>
                  <a
                    href="#services"
                    className="hover:text-white transition-colors duration-200 cursor-pointer"
                  >
                    Our Services
                  </a>
                </li>
                <li>
                  <Link href="/login" className="hover:text-white transition-colors duration-200">
                    Login
                  </Link>
                </li>
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h4 className="font-bebas text-white tracking-widest text-lg mb-6 border-l-2 border-white/15 pl-3">
                Contact
              </h4>
              <ul className="space-y-4 font-inter text-sm text-white/40">
                <li className="flex items-start gap-3">
                  <Phone className="w-4 h-4 mt-0.5 flex-shrink-0 text-white/25" />
                  <span>021 271 0526</span>
                </li>
                <li className="flex items-start gap-3">
                  <Mail className="w-4 h-4 mt-0.5 flex-shrink-0 text-white/25" />
                  <span>info@armanufacturing.co.za</span>
                </li>
                <li className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-white/25" />
                  <span>
                    15 Hadji Ebrahim Crescent, Unit 9,<br />
                    Belgravia Industrial Park, Athlone, 7764
                  </span>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="pt-8 border-t border-white/[0.05] flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="font-inter text-xs text-white/25 tracking-widest uppercase">
              © 2026 AR Steel Manufacturing. All rights reserved.
            </p>
            <div className="flex items-center gap-5">
              <a
                href="#"
                aria-label="LinkedIn"
                className="text-white/25 hover:text-white transition-colors duration-200 cursor-pointer"
              >
                <Linkedin className="w-5 h-5" />
              </a>
              <a
                href="#"
                aria-label="Instagram"
                className="text-white/25 hover:text-white transition-colors duration-200 cursor-pointer"
              >
                <Instagram className="w-5 h-5" />
              </a>
            </div>
          </div>
        </div>
      </footer>

    </div>
  )
}
```

- [ ] **Step 2: Verify the page builds without TypeScript errors**

```bash
cd /path/to/rasheed-ordering-portal && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors. If `next/font/google` reports `Bebas_Neue` not found, check spelling — it's `Bebas_Neue` (underscore, capital N).

- [ ] **Step 3: Run the dev server and visually verify**

```bash
npm run dev
```

Open `http://localhost:3000` in the browser. Check:
- [ ] Landing page renders (not redirected to `/login`)
- [ ] Navbar is transparent at top, blending with hero background
- [ ] Scrolling down past 80px → navbar condenses into pill
- [ ] Scrolling down past 280px → pill hides off-screen
- [ ] Scrolling back up → pill reappears
- [ ] "Services" anchor scrolls to department rows
- [ ] "Contact Us" anchor scrolls to footer
- [ ] "Login" button navigates to `/login`
- [ ] 7 department rows render with alternating layout and backgrounds
- [ ] Hovering a department row → image goes to colour, scale-up, underline expands
- [ ] CTA section renders and "Login to Order" works
- [ ] Footer shows contact details

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(landing): portfolio showcase page with scroll-aware navbar and 7 department rows"
```

---

## Task 5: Final commit — bundle all changes

- [ ] **Step 1: Verify clean working tree**

```bash
git status
```

Expected: working tree clean (all changes committed in Tasks 1–4).

- [ ] **Step 2: Run typecheck and linter**

```bash
npm run typecheck && npm run lint
```

Fix any reported issues before proceeding.

- [ ] **Step 3: Final confirmation**

Navigate to `http://localhost:3000` while logged out. Confirm:
- Landing page visible (not `/login`)
- Portal at `/dashboard` still requires auth (redirects to `/login` when not logged in)
- Admin at `/admin` still requires auth (redirects to `/admin/login` when not logged in)
