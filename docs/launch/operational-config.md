# Operational Configuration — Launch Settings

Environment variables and settings that must be configured in the Vercel dashboard before (or shortly after) go-live. These are not secrets — they are operational toggles controlled by the client.

---

## WhatsApp Contact Button

**Variable:** `NEXT_PUBLIC_WHATSAPP_NUMBER`

A floating WhatsApp button appears in the bottom-right corner of every authenticated portal page when this variable is set. When blank or unset, the button is hidden.

**Format:** Phone number with country code, digits only — no spaces, dashes, or `+` prefix.

| Correct | Incorrect |
|---|---|
| `27721234567` | `+27 72 123 4567` |
| `27212710526` | `021 271 0526` |

**Where to set it:**

1. Go to the [Vercel dashboard](https://vercel.com) → select the AR Steel project
2. Settings → Environment Variables
3. Add `NEXT_PUBLIC_WHATSAPP_NUMBER` under **Production** (and Preview if desired)
4. Redeploy or trigger a new deployment — the variable takes effect on next build

**What it controls:**

- Component: `src/components/portal/WhatsAppButton.tsx`
- Mounted in: `src/app/(portal)/layout.tsx` (line 51–53)
- The button links to `https://wa.me/{NEXT_PUBLIC_WHATSAPP_NUMBER}`
- Visible on all buyer portal pages: `/dashboard`, `/orders`, `/cart`, `/checkout/*`
- Not shown on the public landing page or legal pages

---

## Daily Report Email Recipients

**Column:** `tenant_config.report_emails` (set via `/admin/settings`)

The daily orders report is uploaded to Supabase Storage at 23:59 each day. When recipient addresses are configured, the report is also emailed to those addresses.

**Where to configure:**

1. Log in as a Super Admin
2. Go to `/admin/settings`
3. Find the "Report Emails" field
4. Enter one or more email addresses (comma-separated)
5. Save

**Format:** Comma-separated valid email addresses.

Example: `rasheed@arsteelmanufacturing.co.za, accounts@arsteelmanufacturing.co.za`

---

## Delivery Time Windows

**Constant:** `ESTIMATED_DELIVERY_RANGE` in `src/lib/config/delivery.ts`

Currently set to `"5–10 business days"` as a placeholder. Update this before launch once Rasheed confirms actual lead times.

**To update:** Edit line 11 of `src/lib/config/delivery.ts` — this single constant is imported by both the cart page and the order confirmation page.

---

## Super Admin Account

**Variable:** `ADMIN_SUPER_EMAIL`

The email address of the Super Admin — the only user who can access `/admin/settings` (tenant config, admin user management). Set in Vercel Environment Variables under **Production**.

Only one Super Admin is supported. To change the Super Admin, update this env var and redeploy.

---

## Supabase Auth Redirect URL

Before go-live, lock the Supabase Auth allowed redirect URLs to the production domain:

1. Go to the [Supabase dashboard](https://supabase.com) → Authentication → URL Configuration
2. Set **Site URL** to `https://portal.arsteelmanufacturing.co.za` (or whichever domain is used)
3. Add `https://portal.arsteelmanufacturing.co.za/**` to **Redirect URLs**
4. Remove any `localhost` or preview URLs from the allowlist

This prevents auth token abuse via open redirects.
