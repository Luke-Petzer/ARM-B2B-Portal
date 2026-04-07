# Remove POS Status Column — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the "POS Status" column from the admin orders table on the `system-simplified` branch, leaving all underlying status logic and the `StatusBadge` component untouched.

**Architecture:** Pure JSX deletion across one file. Three touch points in `OrderLedger.tsx`: the `<th>` header cell, the `<td>` data cell in each row, and two `colSpan={6}` values that must become `colSpan={5}` to keep the table layout correct.

**Tech Stack:** Next.js 14, React, TypeScript

---

## Files to Modify

| File | What changes |
|------|-------------|
| `src/components/admin/OrderLedger.tsx` | Remove `<th>POS Status</th>`, remove `<td><StatusBadge /></td>`, update both `colSpan={6}` → `colSpan={5}` |

---

### Task 1: Remove the POS Status column from the orders table

**Files:**
- Modify: `src/components/admin/OrderLedger.tsx`

There are **4 touch points** in a single file. Make all 4 changes then commit once.

---

**Touch point 1 — Remove the `<th>` header cell (line 569–571):**

Find and delete:
```tsx
            <th className="text-center text-[11px] font-medium text-slate-400 uppercase tracking-wider px-6 py-3">
              POS Status
            </th>
```

---

**Touch point 2 — Remove the `<td>` data cell in the row body (lines 613–615):**

Find and delete:
```tsx
                    <td className="px-6 py-4 text-center">
                      <StatusBadge status={order.status} />
                    </td>
```

---

**Touch point 3 — Update `colSpan` in the "no orders" empty state (line 577):**

Find:
```tsx
              <td colSpan={6} className="px-6 py-16 text-center text-sm text-slate-400">
```

Replace with:
```tsx
              <td colSpan={5} className="px-6 py-16 text-center text-sm text-slate-400">
```

---

**Touch point 4 — Update `colSpan` in the `ExpandedRow` component (line 286):**

Find:
```tsx
      <td colSpan={6} className="p-0">
```

Replace with:
```tsx
      <td colSpan={5} className="p-0">
```

---

**IMPORTANT rules:**
- Do NOT remove `StatusBadge`, its import, or `order.status` — soft delete only
- Do NOT touch any other columns, rows, or logic
- All 4 touch points must be changed in the same edit pass

- [ ] **Step 1: Make all 4 edits in `src/components/admin/OrderLedger.tsx`**

Apply the 4 changes described above.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/lukepetzer/LP-Web-Studio/Clients/Rasheed-B2B/Codebase/rasheed-ordering-portal
npx tsc --noEmit 2>&1 | head -30
```

Expected: No new errors. Unused import warnings for `StatusBadge` are acceptable — do not remove it.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/OrderLedger.tsx
git commit -m "feat(simplified): remove POS Status column from orders table"
```
