# Mobile UI Fixes Implementation Plan

> **For agentic workers:** Use the subagent-driven-development or executing-plans workflow to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve mobile UI/UX issues related to the authentication loading state, mobile navigation, catalog sidebar overlap, and the review order table, ensuring the desktop layout remains unaffected and the visual design remains professional and corporate.

**Architecture:** We will implement responsive CSS utility classes (Tailwind's `md:` prefix) and conditional React rendering to restructure the layout on screens under 768px. For the authentication form, we will enhance the existing `isPending` state with a `lucide-react` spinner. No new major dependencies will be introduced.

**Tech Stack:** Next.js, React, Tailwind CSS, lucide-react.

---

### Task 1: Authentication Loading State

**Files:**
- Modify: `src/app/(auth)/login/page.tsx`
- Modify: `src/app/(auth)/admin/login/page.tsx`

- [ ] **Step 1: Write the failing test**
Because there is no existing testing suite (Playwright/Jest) configured in the UI layer for these login boxes, we will bypass TDD for visual component modifications, as instructed by the user.

- [ ] **Step 2: Implement the minimal code for Buyer Login**
In `src/app/(auth)/login/page.tsx`, import `Loader2` from `lucide-react` and update the submit button to show the spinner when `isPending` is true.

- [ ] **Step 3: Implement the minimal code for Admin Login**
In `src/app/(auth)/admin/login/page.tsx`, import `Loader2` from `lucide-react` and update the submit button similarly.

- [ ] **Step 4: Commit**
```bash
git add src/app/\(auth\)/login/page.tsx src/app/\(auth\)/admin/login/page.tsx
git commit -m "fix(auth): add loading spinner to authentication forms"
```

---

### Task 2: Mobile Navigation

**Files:**
- Modify: `src/components/portal/NavBar.tsx`

- [ ] **Step 1: Write/bypass the failing test**
Bypass TDD for visual/CSS responsiveness adjustments.

- [ ] **Step 2: Add state for Mobile Menu toggle**
In `src/components/portal/NavBar.tsx`, convert to stateful component by importing `useState`, `Menu`, and `X` from `lucide-react`. Add a state variable `const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);`.

- [ ] **Step 3: Restructure NavBar for Mobile**
Hide the desktop links block `(<div className="flex items-center gap-8 ml-4">)` and Logout button behind an `md:flex` class. Add a hamburger button `<button className="md:hidden">` on the right side.
If `isMobileMenuOpen` is true, render a pop-down absoluted/fixed menu below the navbar containing the links and the logout form.

- [ ] **Step 4: Commit**
```bash
git add src/components/portal/NavBar.tsx
git commit -m "fix(nav): implement responsive hamburger menu for mobile devices"
```

---

### Task 3: Catalog Mobile Overlap

**Files:**
- Modify: `src/app/(portal)/dashboard/CatalogueShell.tsx`
- Modify: `src/components/portal/CartSidebar.tsx`

- [ ] **Step 1: Write/bypass the failing test**
Bypass TDD for visual/CSS responsiveness adjustments.

- [ ] **Step 2: Refactor CatalogueShell layout container**
Update `src/app/(portal)/dashboard/CatalogueShell.tsx` to alter the `main` container from `<main className="flex-1 flex overflow-hidden">` to `<main className="flex-1 flex flex-col md:flex-row overflow-hidden">`. This ensures elements stack vertically on mobile. Let the custom `section` scroll natively on mobile without overlapping.

- [ ] **Step 3: Refactor CartSidebar width constraints**
Update `src/components/portal/CartSidebar.tsx` to change `<aside className="w-[400px] ...">` to `<aside className="w-full md:w-[400px] border-t md:border-l md:border-t-0 ...">`. This allows the side-cart to take up the full width when stacked below the product list on mobile.

- [ ] **Step 4: Commit**
```bash
git add src/app/\(portal\)/dashboard/CatalogueShell.tsx src/components/portal/CartSidebar.tsx
git commit -m "fix(catalogue): stack cart sidebar vertically on mobile viewports to prevent overlap"
```

---

### Task 4: Review Order Mobile Table

**Files:**
- Modify: `src/app/(portal)/cart/CartReviewShell.tsx`

- [ ] **Step 1: Write/bypass the failing test**
Bypass TDD for visual/CSS responsiveness adjustments.

- [ ] **Step 2: Refactor Table into Mobile Grid/Cards**
Update `src/app/(portal)/cart/CartReviewShell.tsx` to change the `grid-cols-12` wrapper to stack on mobile (`grid-cols-1 lg:grid-cols-12`). The items table container becomes `col-span-1 lg:col-span-8` and summary becomes `col-span-1 lg:col-span-4`.

- [ ] **Step 3: Convert Table to Responsive Cards**
Apply `block md:table` to the `<table>` element.
Hide the `<thead>` on mobile with `hidden md:table-header-group`.
Make `<tbody>` `block md:table-row-group`.
Make each `<tr>` `block md:table-row border-b md:border-none p-4 md:p-0`.
Inside each `<td>`, use `flex justify-between items-center md:table-cell` and display a mobile-only label string so mobile users can distinguish Product SKU, Description, Line Total, and Action. Use Tailwind `md:` utilities to ensure the desktop `<table>` remains unaffected.

- [ ] **Step 4: Commit**
```bash
git add src/app/\(portal\)/cart/CartReviewShell.tsx
git commit -m "fix(checkout): refactor review order table into responsive cards for mobile"
```
