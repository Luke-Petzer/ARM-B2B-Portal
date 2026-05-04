# Agent Fix Template

Standard workflow for all audit remediation branches. Every step is mandatory unless explicitly noted.

---

## Branch setup

```bash
git checkout main && git pull origin main
git checkout -b <branch-name>
```

Branch naming: `fix/<finding-id>-<short-description>` (e.g. `fix/finding-160-r2-rounding`)

---

## Implementation loop (TDD)

For each task:

1. **Write the failing test first.** Run it — confirm it fails for the right reason.
2. **Implement the minimal fix.** No refactoring, no scope creep.
3. **Run the test again** — confirm it passes.
4. **Run the full suite** — no regressions.

---

## Pre-PR checklist (all five must pass)

Run in this order before every push to a branch:

```bash
pnpm install --frozen-lockfile   # ensures deps match lockfile (catches drift)
pnpm typecheck                   # tsc --noEmit (fast, catches obvious errors)
pnpm lint                        # eslint src (0 errors required; warnings OK if pre-existing)
pnpm test                        # vitest run (all tests must pass)
pnpm build                       # next build (REQUIRED — regenerates typed routes)
```

### Why `pnpm build` is mandatory

Next.js 16 generates typed routes at build time (`.next/types/`). `pnpm typecheck`
runs `tsc --noEmit` against whatever types are on disk — if the local `.next/types/`
are stale (or absent, as in CI), `tsc` may miss errors that the build catches.

**Concrete failure mode:** `router.push(url)` where `url` is a template literal
passes `pnpm typecheck` locally with stale generated types, but fails Vercel's build
with `Argument of type '...' is not assignable to parameter of type 'RouteImpl<...>'`.

The fix for Next.js typed-route template literals is to cast: `url as Route` (imported
from `"next"`). Always apply this cast when constructing router URLs dynamically.

### Common typed-routes issue and fix

```typescript
import type { Route } from "next";
import { useRouter } from "next/navigation";

const router = useRouter();

// ❌ Fails Vercel build with stale local types
router.push(`/admin?${qs}`);

// ✅ Correct — cast to Route
router.push(`/admin?${qs}` as Route, { scroll: false });
```

---

## Commit and push

```bash
git add <specific files>   # never git add -A
git commit -m "fix(<scope>): <description>

<body — what changed and why>

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"

git push -u origin <branch-name>
```

Conventional commits required. `fix(scope):` for bug fixes, `feat(scope):` for features.

---

## Open PR

```bash
gh pr create \
  --title "fix(<scope>): <description>" \
  --body "..."
```

PR body must include:
- What changed and why (not just what)
- Files changed table
- Test plan checklist (all 5 checks + manual smoke tests)

---

## Scope rules

- **One finding = one branch = one PR.** No bundling unrelated fixes.
- Do not refactor adjacent code, rename variables, or "tidy up while you're there."
- If the fix touches >5 files, requires a new dependency, a DB migration, or a public API change: **stop and surface to the developer before proceeding.**
- Never push to `main` directly. Never `git push --force` to a shared branch (force-with-lease on unmerged personal branches is OK).
- PRs are merged via GitHub UI/CLI — not local git merge to main.

---

## After PR is merged

Wait for developer confirmation before starting the next branch.

```bash
git checkout main && git pull origin main
# then start the next branch from the updated main
```
