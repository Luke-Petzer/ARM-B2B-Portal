# Audit Follow-Up Items

Items noted during the pre-flight toolchain fix (`fix/preflight-typecheck-lint`) that are non-blocking but should be addressed in a follow-up sprint.

---

## ESLint Warnings (6 total — non-blocking)

### Unused `eslint-disable` directives

These directives were added when the code contained explicit `any` types that have since been removed or narrowed. The `no-explicit-any` rule no longer triggers on these lines, making the directives stale.

| File | Line | Directive |
|---|---|---|
| `src/app/actions/admin.ts` | 582 | `@typescript-eslint/no-explicit-any` |
| `src/app/actions/admin.ts` | 950 | `@typescript-eslint/no-explicit-any` |
| `src/app/actions/admin.ts` | 1402 | `@typescript-eslint/no-explicit-any` |
| `src/app/actions/refund.ts` | 98 | `@typescript-eslint/no-explicit-any` |
| `src/lib/reports/daily-report.ts` | 90 | `@typescript-eslint/no-explicit-any` |

**Fix:** Remove the stale `// eslint-disable-next-line` comment on each line. ~5 minute task.

### `jsx-a11y/alt-text` on react-pdf `<Image>`

| File | Line | Rule |
|---|---|---|
| `src/lib/pdf/invoice.tsx` | 358 | `jsx-a11y/alt-text` |

`@react-pdf/renderer`'s `<Image>` component renders to PDF, not to HTML DOM, so `alt` attributes are meaningless and not supported by the renderer's type definitions. The rule fires because ESLint sees a JSX `<Image>` and applies the accessibility rule indiscriminately.

**Fix:** Add `// eslint-disable-next-line jsx-a11y/alt-text` above line 358, with a comment explaining the react-pdf context. This is a justified suppression.

---

## Notes

- All 6 warnings were pre-existing before the pre-flight branch. None were introduced by the fixes in this branch.
- The 5 unused-disable warnings will disappear if the stale comments are simply deleted.
- The jsx-a11y warning requires a justified `eslint-disable-next-line` because the `<Image>` type in `@react-pdf/renderer` does not accept an `alt` prop.

---

### CLEANUP-02 — Hide status filter from admin command centre

The admin command centre filter bar exposes filtering by order statuses
(`processing`, `fulfilled`) that map to features the client isn't using —
order management is handled in the ERP, not the portal. Hide these
filter options in the UI; preserve the underlying query logic in case
the feature is re-enabled in a future phase.

Severity: P3 (cosmetic).

---

## Deferred Items (post-launch)

Items that are known gaps but intentionally deferred. Not blocking launch. Revisit after the platform is live and stable.

| Ref | Item | Notes |
|---|---|---|
| N-07 | VAT rate hardcoded at 15% in cart components (`CartSidebar.tsx`, `CartReviewShell.tsx`) | Should source from `tenant_config.vat_rate` instead. Low risk while the SA VAT rate is stable. |
| N-04 | `buyer_sessions` session-revocation system | Schema exists, zero application code. Reserved for a future hardening phase. |
| N-05 | `order_status_history` admin UI | DB trigger populates this table on every status change. Currently no UI exposes it. Consider surfacing in admin audit view post-launch. |
| CLEANUP-02 | Status filter in admin command centre | Hide `processing` / `fulfilled` filter options; preserve query logic. P3 cosmetic. |
| Q-PERF-02 | Pagination on buyer order history | `OrderHistoryTable` loads all orders for a buyer. Will degrade for high-volume accounts. |
| — | PDF page footer overlap | Cosmetic issue noted on test invoice ORD-000039. Adjust footer/margin in `src/lib/pdf/invoice.tsx`. |
