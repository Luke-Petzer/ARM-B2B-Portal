# System Simplified — UI-Only Removals

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the `system-simplified` branch, hide all action buttons from the admin dashboard while leaving all underlying logic untouched — producing a read-only review interface.

**Architecture:** Pure JSX deletion. No logic, server actions, state, or imports are removed — only the rendered UI elements. The `ExpandedRow` component in `OrderLedger.tsx` retains its handlers and state; they simply have no buttons to trigger them.

**Tech Stack:** Next.js 14, React, TypeScript

---

## Files to Modify

| File | What changes |
|------|-------------|
| `src/app/(admin)/admin/page.tsx` | Delete the 4 KPI stat cards grid (lines 234–271) |
| `src/components/admin/OrderLedger.tsx` | Delete assignment button/badge + all action buttons from `ExpandedRow` |

---

### Task 1: Switch to system-simplified branch

**Files:**
- N/A — git operation only

- [ ] **Step 1: Confirm you are on the right branch**

```bash
git checkout system-simplified
git status
```

Expected output: `On branch system-simplified` with a clean working tree.

---

### Task 2: Remove 4 KPI cards from the admin dashboard page

**Files:**
- Modify: `src/app/(admin)/admin/page.tsx` lines 233–271

The block to remove is the `{/* KPI cards */}` section. Delete lines 233–271 in their entirety:

```tsx
      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="Pending Orders"
          value={String(pendingCount)}
          sub="Awaiting EFT verification"
          icon={<Clock className="w-5 h-5 text-amber-600" />}
          iconBg="bg-amber-50"
          badge="EFT"
          badgeColor="text-amber-600 bg-amber-50"
        />
        <KpiCard
          label="In Progress"
          value={String(processingCount)}
          sub="Confirmed & processing"
          icon={<Loader className="w-5 h-5 text-sky-600" />}
          iconBg="bg-sky-50"
          badge="Active"
          badgeColor="text-sky-600 bg-sky-50"
        />
        <KpiCard
          label="Total Revenue"
          value={ZAR.format(totalRevenue)}
          sub="From fulfilled orders"
          icon={<TrendingUp className="w-5 h-5 text-emerald-600" />}
          iconBg="bg-emerald-50"
          badge="Fulfilled"
          badgeColor="text-emerald-600 bg-emerald-50"
        />
        <KpiCard
          label="Active Clients"
          value={String(activeClients)}
          sub="Registered buyer accounts"
          icon={<Users className="w-5 h-5 text-violet-600" />}
          iconBg="bg-violet-50"
          badge="Accounts"
          badgeColor="text-violet-600 bg-violet-50"
        />
      </div>
```

Replace with: *(nothing — delete the block entirely)*

- [ ] **Step 2: Delete the KPI cards block**

In `src/app/(admin)/admin/page.tsx`, delete the entire `{/* KPI cards */}` block shown above. The `{/* Action bar */}` div should now follow directly after whatever precedes the cards.

- [ ] **Step 3: Verify the file compiles**

```bash
cd /Users/lukepetzer/LP-Web-Studio/Clients/Rasheed-B2B/Codebase/rasheed-ordering-portal
npx tsc --noEmit 2>&1 | head -30
```

Expected: No new errors related to `page.tsx`. (Unused imports like `KpiCard`, `Clock`, `Loader`, `TrendingUp`, `Users`, `pendingCount`, `processingCount`, `totalRevenue`, `activeClients` may produce warnings — these are acceptable for this soft-delete pass; do not remove them.)

- [ ] **Step 4: Commit**

```bash
git add src/app/(admin)/admin/page.tsx
git commit -m "feat(simplified): hide KPI stat cards from admin dashboard"
```

---

### Task 3: Remove the "Assign to Me" button and assignment badge from ExpandedRow

**Files:**
- Modify: `src/components/admin/OrderLedger.tsx` lines 293–309

The block to remove is inside the `<div className="flex items-center gap-3">` in the ExpandedRow header. It is the assignment conditional. Keep the item count `<span>` that follows it.

Remove this block (lines 294–309):

```tsx
              {/* Assignment badge / Assign to Me */}
              {assigneeName ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-violet-50 text-violet-700 border border-violet-200">
                  Assigned: {assigneeName}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleAssign}
                  disabled={isAssigning}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200 hover:bg-violet-50 hover:text-violet-700 hover:border-violet-200 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                >
                  {isAssigning ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                  Assign to Me
                </button>
              )}
```

After deletion, the `<div className="flex items-center gap-3">` should contain only the item count span:

```tsx
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400">
                {order.items.length} item{order.items.length !== 1 ? "s" : ""}
              </span>
            </div>
```

- [ ] **Step 5: Delete the assignment badge/button block**

Make the edit described above in `src/components/admin/OrderLedger.tsx`.

---

### Task 4: Remove all action buttons from the ExpandedRow actions footer

**Files:**
- Modify: `src/components/admin/OrderLedger.tsx` lines 415–548

The entire `{/* Actions row */}` div needs to be simplified. Keep only the informational "Created: … · payment method" text. Remove: Send Statement button, statementResult feedback, error display, Cancel Order, Approve & Mark Paid, Approve on Credit, Mark as Paid.

Replace the entire `{/* Actions row */}` block (lines 415–548):

**Current:**
```tsx
          {/* Actions row */}
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400">
                Created: {fmtDate(order.created_at)} ·{" "}
                <span className="capitalize">{order.payment_method.replace(/_/g, " ")}</span>
              </span>
              {/* Send Statement — 30-day orders */}
              {order.payment_method === "30_day_account" && (
                <button
                  type="button"
                  onClick={handleSendStatement}
                  disabled={isSendingStatement}
                  className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[11px] font-medium border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                >
                  {isSendingStatement ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                  Send Statement
                </button>
              )}
              {statementResult && (
                <span className={`text-xs ${statementResult.ok ? "text-emerald-600" : "text-red-600"}`}>
                  {statementResult.message}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4">
              {error && (
                <span className="text-xs text-red-600">{error}</span>
              )}
              {/* ── Cancel — pending orders only ── */}
              {order.status === "pending" && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button
                      type="button"
                      disabled={isCancelling}
                      className="h-9 px-4 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors shadow-sm flex items-center gap-2 disabled:opacity-40 disabled:pointer-events-none"
                    >
                      {isCancelling ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
                      Cancel Order
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancel this order?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently cancel order {order.reference_number}. The buyer will not be notified automatically. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep Order</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleCancel}
                        className="bg-red-600 hover:bg-red-700 text-white"
                      >
                        Yes, Cancel Order
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              {/* ── EFT: single "Approve & Mark Paid" ── */}
              {order.status === "pending" && order.payment_method === "eft" && (
                <ApproveDialog
                  label="Approve & Mark Paid"
                  description="This verifies payment and notifies dispatch. This action cannot be undone."
                  onConfirm={() => handleApprove("paid")}
                  isLoading={isApproving}
                />
              )}

              {/* ── 30-Day: two buttons for pending orders ── */}
              {order.status === "pending" && order.payment_method === "30_day_account" && (
                <>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button
                        type="button"
                        disabled={approveOnCreditDisabled}
                        title={
                          isHardBlocked
                            ? "Blocked: overdue invoices"
                            : willExceedLimit && !isSuperAdmin
                            ? "Approval blocked: Credit limit exceeded"
                            : willExceedLimit && isSuperAdmin && !creditOverrideAcknowledged
                            ? "Acknowledge the credit limit override above to enable"
                            : undefined
                        }
                        className="h-9 px-4 bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors shadow-sm flex items-center gap-2 disabled:opacity-40 disabled:pointer-events-none"
                      >
                        {isApproving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                        Approve on Credit
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Confirm: Approve on Credit</AlertDialogTitle>
                        <AlertDialogDescription>
                          Approves this order against the client&apos;s credit account. Revenue is recognised now.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleApprove("credit_approved")}
                          className="bg-sky-600 hover:bg-sky-700 text-white"
                        >
                          Approve on Credit
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  <ApproveDialog
                    label="Approve & Mark Paid"
                    description="Client is paying immediately. This marks the order as paid and notifies dispatch."
                    onConfirm={() => handleApprove("paid")}
                    isLoading={isApproving}
                  />
                </>
              )}

              {/* ── 30-Day: credit-approved order settling later ── */}
              {order.status === "confirmed" && order.payment_status === "credit_approved" && (
                <ApproveDialog
                  label="Mark as Paid"
                  description="Record that this credit account order has now been settled."
                  confirmLabel="Confirm Payment"
                  onConfirm={() => handleApprove("paid")}
                  isLoading={isApproving}
                  variant="secondary"
                />
              )}
            </div>
          </div>
```

**Replace with** (informational metadata only, no buttons):
```tsx
          {/* Actions row */}
          <div className="flex items-center mt-4">
            <span className="text-xs text-slate-400">
              Created: {fmtDate(order.created_at)} ·{" "}
              <span className="capitalize">{order.payment_method.replace(/_/g, " ")}</span>
            </span>
          </div>
```

- [ ] **Step 6: Replace the actions row block**

Make the edit described above in `src/components/admin/OrderLedger.tsx`.

- [ ] **Step 7: Verify the file compiles**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: No new type errors. Unused variable warnings (`isCancelling`, `isApproving`, `handleCancel`, `handleApprove`, `handleSendStatement`, `isSendingStatement`, `statementResult`, `error`, `approveOnCreditDisabled`, `isHardBlocked`, `willExceedLimit`, `creditOverrideAcknowledged`, `setCreditOverrideAcknowledged`) are acceptable — do not remove them.

- [ ] **Step 8: Commit**

```bash
git add src/components/admin/OrderLedger.tsx
git commit -m "feat(simplified): hide all action buttons from order expanded rows"
```

---

### Task 5: Manual verification

- [ ] **Step 9: Start the dev server and verify**

```bash
npm run dev
```

Navigate to `/admin` and confirm:
- [ ] No KPI stat cards visible at the top of the dashboard
- [ ] Orders table loads normally (rows clickable, expand/collapse works)
- [ ] Expanded order row shows: Line Items table, Order Notes (if any), Credit banners (if applicable) — and the "Created: …" metadata line
- [ ] No "Assign to Me" button or assignee badge visible
- [ ] No "Cancel Order", "Approve & Mark Paid", "Approve on Credit", "Mark as Paid", or "Send Statement" buttons visible anywhere
- [ ] The filters/search/export bar above the table is unchanged

---

## Credit System Note

The credit warning banners (overdue notice, credit limit violation alert) are left in place intentionally. They are informational displays. The credit override checkbox for super admins is also retained since the credit system will be revisited in a later pass.
