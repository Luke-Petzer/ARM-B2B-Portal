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
    expect(adminActionSource).toMatch(/cancelOrderAction[\s\S]{0,1000}\.select\("id, status"\)/);
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
    expect(adminActionSource).toMatch(/v\.includes\(","\)/);
  });

  it("csvEsc wraps values containing double-quotes and escapes them as double-double-quotes", () => {
    // RFC 4180: a quote character must be escaped by doubling it.
    expect(adminActionSource).toMatch(/v\.includes\('?"'?\)/);
    expect(adminActionSource).toMatch(/replace\(\/"\//);
    expect(adminActionSource).toMatch(/""/);
  });

  it("csvEsc wraps values containing newlines", () => {
    expect(adminActionSource).toMatch(/v\.includes\(["']\\n["']\)/);
  });

  it("business name is passed through csvEsc", () => {
    expect(adminActionSource).toMatch(/csvEsc\(bizName\)/);
  });

  it("product name is passed through csvEsc", () => {
    expect(adminActionSource).toMatch(/csvEsc\(item\.product_name\)/);
  });

  it("[M10] csvEsc sanitises formula-injection prefixes (CWE-1236)", () => {
    // [M10] csvEsc now prefixes values starting with =, +, -, @, tab, or
    // carriage-return with a single quote so spreadsheet apps treat the cell
    // as a literal string instead of a formula.
    const csvEscBody = adminActionSource.match(/function csvEsc[\s\S]*?\n\}/)?.[0] ?? "";
    // Must contain a regex test for formula-dangerous leading characters
    expect(csvEscBody).toMatch(/\^?\[=\+\\-@/);
    // Must prefix with a single quote
    expect(csvEscBody).toMatch(/`'\$\{/);
  });
});

// ---------------------------------------------------------------------------
// 5. Double-submit risk (FIN-005) — checkout.ts
// ---------------------------------------------------------------------------

describe("checkoutAction — idempotency guard (FIN-005)", () => {
  it("[M6] checkoutAction has a client_submission_id idempotency guard", () => {
    // [M6] The checkout flow now accepts a client-generated submission ID
    // (client_submission_id) and checks for duplicate submissions before
    // creating a new order. This prevents double-submit from network retries.
    expect(checkoutSource).toMatch(/idempotency/i);
    expect(checkoutSource).toMatch(/client_submission_id/);
  });

  it("[M6] duplicate submission ID returns the existing order instead of creating a new one", () => {
    // The server queries for an existing order with the same client_submission_id
    // and short-circuits if found, preventing duplicate order creation.
    expect(checkoutSource).toMatch(/\.eq\("client_submission_id"/);
  });
});
