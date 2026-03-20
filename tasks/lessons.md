# Lessons Learned

> Rules derived from corrections and mistakes during this project.
> Update this file whenever a correction is made.

---

## Next.js 16 Breaking Changes

- **`next lint` removed** — `next lint` is no longer a CLI command in Next.js 16. Use `eslint src` (or `npx eslint src`) directly in scripts and CI.

- **`eslint-config-next` v16 exports flat config natively** — Do not use `FlatCompat`. Import directly: `import nextConfig from 'eslint-config-next'; export default [...nextConfig];`

- **`middleware.ts` → `proxy.ts`** — The file convention and the exported function name both changed. The file must be `src/proxy.ts` and the exported function must be named `proxy` (not `middleware`).

- **`experimental.typedRoutes` moved to `typedRoutes`** — In `next.config.ts`, this is now a top-level key, not under `experimental`.

- **`next typegen` needed after adding routes** — When `typedRoutes: true`, run `npx next typegen` any time new routes are added, otherwise `redirect()` type-checks fail with `RouteImpl` errors.

## Zod

- **Zod v4: `.errors` renamed to `.issues`** — `ZodError` no longer has a `.errors` property. Use `zodError.issues[0].message` instead of `zodError.errors[0].message`.

## Supabase TypeScript Types

- **`Relationships` array required for column-select inference** — Without `Relationships: []` (or a populated array) on each table in the Database type, Supabase's column-select narrowing (e.g. `.select("id, role")`) resolves to `never`. Always include `Relationships` in every table definition.

## Auth

- **Buyer JWT sub claim must equal profile.id** — Supabase's `auth.uid()` reads the `sub` claim from the JWT. For buyers, the custom JWT `sub` must be set to `profile.id` (not a fabricated value) so RLS policies using `auth.uid()` correctly isolate buyer data.

- **Admin profile.id must equal auth.users.id** — The `handle_new_admin_user` trigger inserts the profile with `id = NEW.id` (the auth user UUID). This is the critical condition that makes `auth.uid() = profile.id` true for admins and allows RLS to work without separate joins.

- **Never expose SUPABASE_SERVICE_ROLE_KEY or SUPABASE_JWT_SECRET to the client** — These are server-only secrets. Service role bypasses all RLS. JWT secret allows forging sessions.

## Schema

- **Snapshot product data in order_items** — Store `sku`, `product_name`, `unit_price` directly on `order_items` at insert time. Product edits or deletions must never corrupt historical order records.

- **line_total integrity is enforced at the DB layer** — The `trg_order_items_validate_line_total` trigger rejects any row where `line_total != ROUND(unit_price * quantity, 2)`. Do not attempt to bypass this; fix the application calculation instead.

## Rate Limiting

- **Rate limiter must degrade gracefully** — If Upstash Redis is unreachable, log the error but allow the request through. A broken rate limiter must not block legitimate logins.
