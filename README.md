# AR Steel Manufacturing — B2B/B2C Ordering Portal

An order placement portal for AR Steel Manufacturing (Pty) Ltd, serving both trade (B2B) and consumer (B2C) customers.

## What this platform does

Buyers browse the product catalogue, add items to cart, and place orders. The platform records the order, emails confirmations, and provides a read-only admin view of placed orders. Order processing, payment verification, and dispatch are handled in the client's ERP — not in this platform.

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js (App Router) + React |
| Database / Auth | Supabase (Postgres + Row Level Security) |
| Hosting | Vercel |
| Email | Resend + React Email |
| Rate limiting | Upstash Redis |
| PDF generation | `@react-pdf/renderer` |

## Setup

```bash
pnpm install
cp .env.example .env.local   # fill in required values
pnpm dev                     # http://localhost:3000
```

Required environment variables are documented in `.env.example`.

## Checks

```bash
pnpm typecheck   # TypeScript
pnpm lint        # ESLint
pnpm test        # Vitest
pnpm build       # Next.js production build
```

## Documentation

- **[CODEBASE.md](CODEBASE.md)** — full architectural reference: DB schema, auth, pricing engine, server actions, deployment
- **[docs/](docs/)** — audit reports, launch checklist, QA plan, implementation plans

## Licence

Proprietary — not for redistribution. All rights reserved by AR Steel Manufacturing (Pty) Ltd.
