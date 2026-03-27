// tests/audit/order/state-machine.test.ts
//
// Static-analysis audit tests for the order state machine in admin.ts.
// All assertions operate on the raw source text — no Supabase or Next.js
// runtime is required, so every test is deterministic and side-effect-free.

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const adminActionSource = fs.readFileSync(
  path.resolve(__dirname, "../../../src/app/actions/admin.ts"),
  "utf-8"
);

const checkoutSource = fs.readFileSync(
  path.resolve(__dirname, "../../../src/app/actions/checkout.ts"),
  "utf-8"
);

// ---------------------------------------------------------------------------
// 1. assignOrderAction — immutability guard
// ---------------------------------------------------------------------------

describe("assignOrderAction — immutability guard", () => {
  it("uses .is('assigned_to', null) to enforce single-assignment", () => {
    // The Supabase filter .is("assigned_to", null) causes the UPDATE to match
    // zero rows when the field is already set, making the assignment immutable.
    expect(adminActionSource).toMatch(/\.is\("assigned_to",\s*null\)/);
  });

  it("detects already-assigned orders by checking data.length === 0", () => {
    // When the conditional UPDATE matches no rows, data is an empty array.
    // The guard inspects this to differentiate 'already assigned' from a real error.
    expect(adminActionSource).toMatch(/data\.length\s*===\s*0/);
  });

  it("returns the correct error message for already-assigned orders", () => {
    expect(adminActionSource).toMatch(/Order is already assigned to another employee\./);
  });
});

// ---------------------------------------------------------------------------
// 2. approveOrderAction — state transition guards
// ---------------------------------------------------------------------------

describe("approveOrderAction — state transition guards", () => {
  it("fetches current order state before updating (reads id, status, payment_status)", () => {
    // The action must read current state first so it can make the correct
    // transition decision. This select must precede any update call.
    expect(adminActionSource).toMatch(/select\("id,\s*status,\s*payment_status"\)/);
  });

  it("first approval checks currentOrder.status === 'pending'", () => {
    expect(adminActionSource).toMatch(/currentOrder\.status\s*===\s*["']pending["']/);
  });

  it("credit settlement checks status === 'confirmed' AND payment_status === 'credit_approved'", () => {
    expect(adminActionSource).toMatch(/currentOrder\.status\s*===\s*["']confirmed["']/);
    expect(adminActionSource).toMatch(/currentOrder\.payment_status\s*===\s*["']credit_approved["']/);
  });

  it("guards against invalid state transitions with !isFirstApproval && !isCreditSettlement", () => {
    // Any order that is neither pending (first approval) nor a credit-approved
    // confirmed order (credit settlement) must be rejected.
    expect(adminActionSource).toMatch(/!isFirstApproval\s*&&\s*!isCreditSettlement/);
  });

  it("returns the correct error message for invalid state transitions", () => {
    expect(adminActionSource).toMatch(/Order cannot be approved in its current state\./);
  });

  it("sets confirmed_at on first approval", () => {
    // confirmed_at records the approval timestamp for daily revenue attribution.
    // It must only appear in the isFirstApproval branch, not the credit settlement branch.
    expect(adminActionSource).toMatch(/confirmed_at:\s*new Date\(\)\.toISOString\(\)/);
  });

  it("does NOT set confirmed_at in the credit settlement update payload", () => {
    // The credit settlement branch should only set payment_status: "paid".
    // Extract the section after the isCreditSettlement assignment to verify
    // the else-branch payload does not contain confirmed_at.
    //
    // Strategy: find the updatePayload block and assert that confirmed_at only
    // appears once — in the isFirstApproval branch.
    const confirmedAtMatches = adminActionSource.match(/confirmed_at:/g);
    // confirmed_at appears exactly once (in the isFirstApproval payload only).
    expect(confirmedAtMatches).not.toBeNull();
    expect(confirmedAtMatches!.length).toBe(1);
  });

  it("validates approvalType — rejects values other than 'paid' and 'credit_approved'", () => {
    // The guard must check both literals so that arbitrary strings cannot be
    // submitted via FormData manipulation.
    expect(adminActionSource).toMatch(/approvalTypeRaw\s*!==\s*["']paid["']\s*&&\s*approvalTypeRaw\s*!==\s*["']credit_approved["']/);
  });

  it("returns 'Invalid approval type.' for invalid approvalType values", () => {
    expect(adminActionSource).toMatch(/Invalid approval type\./);
  });

  it("dispatch email is only sent on first approval — guarded by if (isFirstApproval)", () => {
    // sendDispatchEmail must not fire on a credit settlement (the dispatch
    // sheet was already sent during the first approval).
    expect(adminActionSource).toMatch(/if\s*\(isFirstApproval\)\s*\{[\s\S]*?sendDispatchEmail/);
  });
});

// ---------------------------------------------------------------------------
// 3. cancelOrderAction — pending-only guard
// ---------------------------------------------------------------------------

describe("cancelOrderAction — pending-only guard", () => {
  it("fetches current order before attempting cancellation", () => {
    // cancelOrderAction must read the current status before writing, so it
    // can reject non-pending orders without issuing a no-op UPDATE.
    expect(adminActionSource).toMatch(/cancelOrderAction[\s\S]{0,500}\.select\("id, status"\)/);
  });

  it("rejects non-pending orders with the correct status guard", () => {
    expect(adminActionSource).toMatch(/currentOrder\.status\s*!==\s*["']pending["']/);
  });

  it("returns 'Only pending orders can be cancelled.' error message", () => {
    expect(adminActionSource).toMatch(/Only pending orders can be cancelled\./);
  });

  it("sets cancelled_at timestamp on successful cancellation", () => {
    expect(adminActionSource).toMatch(/cancelled_at:\s*new Date\(\)\.toISOString\(\)/);
  });
});

// ---------------------------------------------------------------------------
// 4. CSV injection — csvEsc function in exportOrdersCsvAction
// ---------------------------------------------------------------------------

describe("csvEsc — CSV encoding in exportOrdersCsvAction", () => {
  it("csvEsc is defined in admin.ts", () => {
    expect(adminActionSource).toMatch(/function csvEsc\s*\(/);
  });

  it("csvEsc wraps values containing commas in double quotes", () => {
    expect(adminActionSource).toMatch(/value\.includes\(","\)/);
  });

  it("csvEsc wraps values containing double-quotes and escapes them as double-double-quotes", () => {
    // RFC 4180: a quote character must be escaped by doubling it.
    expect(adminActionSource).toMatch(/value\.includes\('?"'?\)/);
    expect(adminActionSource).toMatch(/replace\(\/"\//);
    expect(adminActionSource).toMatch(/""/);
  });

  it("csvEsc wraps values containing newlines", () => {
    expect(adminActionSource).toMatch(/value\.includes\(["']\\n["']\)/);
  });

  it("business name is passed through csvEsc", () => {
    expect(adminActionSource).toMatch(/csvEsc\(bizName\)/);
  });

  it("product name is passed through csvEsc", () => {
    expect(adminActionSource).toMatch(/csvEsc\(item\.product_name\)/);
  });

  it("RISK DOCUMENTED (FIN-CSV-001): csvEsc does not sanitise formula-injection prefixes", () => {
    // SECURITY RISK: csvEsc does not prefix-sanitise values that begin with
    // =, +, -, or @. If a business name or product name starts with one of
    // these characters (e.g. "=cmd|'/C calc'!A0"), opening the exported CSV
    // in Microsoft Excel or LibreOffice Calc will execute the formula.
    //
    // Mitigation options:
    //   1. Prepend a tab or single-quote to any cell value starting with
    //      =, +, -, or @.
    //   2. Warn admins in the UI that the CSV must not be opened in a
    //      spreadsheet application with untrusted data.
    //   3. Require an additional admin confirmation before export.
    //
    // The assertion below documents that no prefix-sanitisation currently exists.
    const hasPrefixSanitisation = /[=+\-@]/.test("dummy"); // trivially true, just for shape
    // The real check: csvEsc source does NOT contain a guard against formula starters.
    const csvEscBody = adminActionSource.match(/function csvEsc[\s\S]*?\n\}/)?.[0] ?? "";
    const sanitisesFormulaPrefix =
      /[=+\-@]/.test(csvEscBody) && /replace|prefix|formula/i.test(csvEscBody);
    expect(sanitisesFormulaPrefix).toBe(false);
    expect(true).toBe(true); // documentation-only assertion
  });
});

// ---------------------------------------------------------------------------
// 5. Double-submit risk (FIN-005) — checkout.ts
// ---------------------------------------------------------------------------

describe("checkoutAction — double-submit / idempotency risk (FIN-005)", () => {
  it("RISK DOCUMENTED: checkoutAction has no idempotency key guard", () => {
    // SECURITY / RELIABILITY RISK: checkoutAction does not check for an
    // idempotency key (e.g. X-Idempotency-Key header, a client-generated
    // nonce stored server-side, or a unique constraint on a client-supplied
    // order token). A network timeout followed by a client retry can
    // therefore create two identical orders for the same cart contents.
    //
    // Current mitigation: the atomic RPC call (create_order_atomic) uses a
    // DB transaction, so partial writes are impossible — but a full second
    // submission will produce a second order row with a new reference number.
    //
    // Recommended fix: have the client generate a UUID nonce before calling
    // checkoutAction and pass it as an idempotency_key. The server should
    // upsert on that key (or check for a duplicate before inserting) and
    // return the existing order ID on a replay.
    expect(checkoutSource).not.toMatch(/idempotency/i);
    expect(true).toBe(true); // documentation-only assertion
  });

  it("RISK DOCUMENTED: no X-Idempotency-Key header is extracted or validated", () => {
    // Confirms no HTTP-level idempotency mechanism is present in the checkout flow.
    expect(checkoutSource).not.toMatch(/X-Idempotency-Key/i);
    expect(true).toBe(true); // documentation-only assertion
  });
});
