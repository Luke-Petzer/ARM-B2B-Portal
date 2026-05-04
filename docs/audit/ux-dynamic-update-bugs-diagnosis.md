# UX Dynamic Update Bugs — Diagnosis Report

**Branch:** `investigate/ux-dynamic-update-bugs`  
**Date:** 2026-05-04  
**Status:** Investigation complete, awaiting developer approval before fixes

---

## Bug 1 — Admin Order Search/Filter Requires "Apply" Click

### Reported behaviour
Typing in the admin order search box or changing the status dropdown does not filter results. The admin must click the "Apply" button to see results change.

### Root cause — confirmed

`src/app/(admin)/admin/page.tsx` is a **Next.js Server Component** that reads filter state from URL `searchParams` and runs Supabase queries server-side. The search/filter form is a plain HTML `<form method="GET">` with uncontrolled inputs (`defaultValue`, not `value`):

```tsx
<form method="GET" className="flex flex-wrap items-center gap-4">
  <input type="text" name="search" defaultValue={search ?? ""} ... />
  <select name="status" defaultValue={status ?? ""}>...</select>
  <input type="date" name="dateFrom" defaultValue={dateFrom ?? ""} ... />
  <input type="date" name="dateTo" defaultValue={dateTo ?? ""} ... />
  <button type="submit">Apply</button>
</form>
```

Every filter change requires a full page reload (GET request with new query params) to query the DB. There is no client-side filtering in the `OrderLedger` component — it syncs its `orders` state from server-provided `initialOrders` and only re-fetches on Supabase Realtime broadcast (`new_order` events) or explicit `router.refresh()`.

### Why products and clients pages feel different

- `/admin/products` → `ProductsTable.tsx` holds all products in client state, derives `filteredProducts` from a `searchTerm` useState — **instant client-side filtering**
- `/admin/clients` → `ClientsTable.tsx` same pattern — **instant client-side filtering**
- `/admin` (command center) → server-side filtering via URL params — **requires form submit**

The inconsistency is the UX bug. The design decision to use server-side filtering for orders is architecturally justified (orders grow without bound; loading all for client-side filtering would not scale), but it creates a jarring UX difference from the other two pages.

### Impact
- **Severity:** Medium UX friction, no data integrity risk
- **Scope:** Only affects the main admin command centre (`/admin`)
- **Workaround:** Click "Apply" after each filter change

### Fix options (for developer decision)

| Option | Effort | Tradeoff |
|--------|--------|----------|
| A. Auto-submit on change via `onChange={e => e.currentTarget.form?.requestSubmit()}` | Low | Fast, keeps server-side filtering, but triggers a network round-trip per keystroke — needs debounce |
| B. Debounced auto-submit (300 ms debounce on text input, immediate on select/date) | Medium | Best UX, keeps server architecture |
| C. Convert to client-side filtering (fetch all orders once, filter in memory) | High | Not scalable — orders table grows indefinitely, could fetch thousands of rows |
| D. Keep as-is, rename button to "Search" and add a small hint label | Trivial | No UX improvement, just documentation |

**Recommendation:** Option B — debounced auto-submit. The form stays server-side (scalable, URL-shareable, works without JS), but the UX feels instant.

---

## Bug 2 — Product Deactivation Does Not Update Buyer Catalogue Without Refresh

### Reported behaviour
After an admin deactivates a product, the buyer catalogue still shows the product until the buyer manually refreshes the page.

### Investigation findings

#### Cache invalidation — correctly wired up ✅

`toggleProductActiveAction` (admin.ts:1000–1020) calls `revalidateTag("catalogue", {})` after a successful DB update:

```typescript
export async function toggleProductActiveAction(formData: FormData) {
  // ...
  const { error } = await adminClient
    .from("products")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) { return { error: "Failed to update product status." }; }

  revalidateTag("catalogue", {}); // ✅ invalidates the buyer cache
}
```

The buyer dashboard (`dashboard/page.tsx:13–41`) uses `unstable_cache` tagged with `"catalogue"`:

```typescript
const getCatalogueData = unstable_cache(
  async () => { /* DB query with .eq("is_active", true) */ },
  ["catalogue-data"],
  { tags: ["catalogue"], revalidate: 300 }
);
```

So the cache IS invalidated on every `toggleProductActiveAction` call. The **next** buyer page request after deactivation will fetch fresh data from the DB and the deactivated product will be absent.

#### Checkout defence — correctly guarded ✅

`checkout.ts:332–337` explicitly rejects inactive products at order placement time, even if they're still in the buyer's cart from a stale page load:

```typescript
// Guard: reject inactive products — may have been deactivated after cart load.
for (const item of items) {
  const dbProduct = productMap.get(item.productId)!;
  if (dbProduct.is_active === false) {
    return { error: `"${item.name}" is no longer available. Please remove it from your cart.` };
  }
}
```

#### The actual limitation — not a bug, expected ISR behaviour

The real issue is that Next.js `revalidateTag` only affects **future server renders**. A buyer who is already viewing the catalogue page (which rendered at some point in the past) will not see live updates until they:
1. Navigate away and back to `/dashboard`, or
2. Hard-refresh the page

This is the expected behaviour of Next.js ISR (Incremental Static Regeneration) for Server Components. The page is rendered server-side once and cached; the cache is invalidated on demand, but the already-delivered HTML in the browser is not retroactively updated.

This is **not a cache wiring bug** — the infrastructure is correct. It is a **fundamental property** of server-side rendering with caching.

### Impact
- **Severity:** Low — no data integrity risk; checkout guards prevent orders for deactivated products; the stale view clears on next navigation
- **Scope:** Buyer catalogue only; admin products table is client-rendered with `useOptimistic` so it reflects the toggle immediately
- **Real-world risk:** A buyer could see and add a deactivated product to their cart, but the checkout would reject it with a clear error message

### Fix options (for developer decision)

| Option | Effort | Tradeoff |
|--------|--------|----------|
| A. Keep as-is — document expected ISR behaviour | None | Checkout guard is the safety net; buyer gets a clear error if they attempt to order a deactivated product |
| B. Add periodic client-side revalidation (poll `/dashboard` via `router.refresh()` every N minutes) | Medium | Adds background network traffic; suitable only if deactivations are time-sensitive |
| C. Supabase Realtime broadcast on deactivation — buyer client calls `router.refresh()` | High | Same pattern already used for admin new-order alerts; adds real-time buyer experience |
| D. Show a "catalogue may be stale" banner with a refresh button | Low | UX transparency without polling |

**Decision (2026-05-04):** No real-time mechanism. The checkout guard is the correct safety net. TTL reduced to 60 s to bound worst-case stale window (see below).

---

## ISR / Cache Behaviour — Rationale for 60-Second TTL

**Decision:** Reduce `unstable_cache` TTL from 300 s → 60 s in `dashboard/page.tsx`.

### How Next.js ISR works here

```
Admin toggles product inactive
  → toggleProductActiveAction DB update
  → revalidateTag("catalogue")        ← invalidates the cache entry
  → Next buyer who navigates to /dashboard gets a fresh render ✅
  → Buyer already on /dashboard sees NO change until they navigate/refresh ❌ (expected)
```

`revalidateTag` marks the cache stale for the next request — it does not push updates to browsers that already received the rendered page. This is not a bug; it is how Next.js App Router ISR works for Server Components.

### Why 60 seconds

- **Checkout guard is the hard safety net.** A buyer cannot place an order for an inactive product regardless of what their browser is showing (`checkout.ts:332–337`).
- **5 minutes (300 s) was too long.** An admin who urgently deactivates a product (e.g. out of stock, safety recall) should not have to wait up to 5 minutes for new buyers to stop seeing it.
- **60 s bounds the window without real-time infrastructure.** Most buyers will navigate or refresh within 60 s during normal browsing; the stale window is an edge case.
- **Cost is negligible.** The catalogue query (`~142 products`) is cheap. A cache miss every 60 s per server instance is not a performance concern at this scale.

### How to change the TTL in future

1. Update `revalidate` in `getCatalogueData` (`dashboard/page.tsx:40`)
2. Update the `expect(dashboardSource).toMatch(/revalidate:\s*NN\b/)` in `tests/audit/catalogue/catalogue-cache-ttl.test.ts`
3. Update this document
4. Get developer sign-off — the TTL is a deliberate tradeoff, not an arbitrary number

---

## Minor Code Smell — `revalidateTag` Called With Extra Argument

In `admin.ts` the calls are:
```typescript
revalidateTag("catalogue", {}); // extra {} argument
```

The Next.js `revalidateTag` signature is `revalidateTag(tag: string)` — it does not accept a second argument. The extra `{}` is silently ignored by the JavaScript runtime and does not cause any functional issue. TypeScript did not flag it, likely because the function uses rest params or an any-typed overload somewhere in the Next.js declarations.

This is a trivial cleanup: remove the `{}` from all `revalidateTag(...)` calls in `admin.ts` (lines 827, 993, 1019).

---

## Summary

| Bug | Real? | Fix Required? |
|-----|-------|---------------|
| Bug 1: Admin search requires "Apply" click | Yes — UX inconsistency | Yes, recommend debounced auto-submit (Option B) |
| Bug 2: Deactivated products stay in buyer catalogue | Not broken — expected ISR behaviour; checkout guards | No critical fix; Option A (document + rely on checkout guard) is sufficient |
| `revalidateTag({})` extra argument | Trivial code smell | Optional cleanup |

**Decision required from developer before any changes are made.**
