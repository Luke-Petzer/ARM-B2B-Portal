// tests/audit/credit/credit-feature-gate.test.ts
//
// Sentinel tests for FINDING-101: the credit / statement feature gates.
//
// Background
// ──────────
// Payments are currently managed offline (outside this portal). Displaying
// outstanding balances or sending statements would show permanently inaccurate
// numbers because the portal has no live payment-received data.
//
// Three feature flags gate the credit/statement surface:
//
//   STATEMENT_PAGE_ENABLED  = false  (src/app/(portal)/dashboard/statement/page.tsx)
//   STATEMENT_NAV_ENABLED   = false  (src/components/portal/NavBar.tsx)
//   SEND_STATEMENT_ENABLED  = false  (src/components/admin/CreditDrawer.tsx)
//
// These flags are deliberately false. Re-enabling them is a business decision
// that requires:
//   1. Payment tracking to be implemented (payments recorded in the DB, not
//      just managed externally in the client's ERP/spreadsheet).
//   2. Explicit sign-off from the business owner.
//   3. Removal of this sentinel test (or an update to the expected value)
//      with a commit message explaining the business decision.
//
// If any of these tests start failing unexpectedly, a flag was changed without
// the above prerequisites being met. Do not simply update the expected value —
// investigate whether payment tracking is live before re-enabling.
//
// Note on CREDIT_CHECK_ENABLED
// ─────────────────────────────
// The audit document (docs/audit/12-open-questions.md) references a
// CREDIT_CHECK_ENABLED = false flag, but this flag does not exist in the
// codebase. The checkCreditStatus() function runs live for admin-side credit
// approval and for 30-day buyer checkout validation. The three flags above are
// the actual implemented gates. FINDING-101 covers these three flags only.

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// ── Source file readers ───────────────────────────────────────────────────────

function readSource(relativePath: string): string {
  try {
    return fs.readFileSync(path.resolve(__dirname, "../../../", relativePath), "utf-8");
  } catch {
    return "";
  }
}

const statementPageSource = readSource("src/app/(portal)/dashboard/statement/page.tsx");
const navBarSource = readSource("src/components/portal/NavBar.tsx");
const creditDrawerSource = readSource("src/components/admin/CreditDrawer.tsx");

// ── STATEMENT_PAGE_ENABLED ───────────────────────────────────────────────────

describe("STATEMENT_PAGE_ENABLED — must remain false until payment tracking is live", () => {
  it("source file exists", () => {
    expect(statementPageSource).not.toBe("");
  });

  it("flag is declared as false (re-enabling requires a documented business decision)", () => {
    // DO NOT simply flip this to true without:
    //  1. Payment tracking implemented in the DB
    //  2. Business owner sign-off
    //  3. A commit message explaining the decision
    expect(statementPageSource).toMatch(/const STATEMENT_PAGE_ENABLED\s*=\s*false/);
  });

  it("redirect guard is wired to the flag (disabled page redirects to /dashboard)", () => {
    // Confirms the flag is not just declared but actually enforced.
    // If the flag is false, any visit to /dashboard/statement must redirect.
    expect(statementPageSource).toMatch(/if\s*\(!STATEMENT_PAGE_ENABLED\)\s*redirect/);
  });
});

// ── STATEMENT_NAV_ENABLED ────────────────────────────────────────────────────

describe("STATEMENT_NAV_ENABLED — must remain false until payment tracking is live", () => {
  it("source file exists", () => {
    expect(navBarSource).not.toBe("");
  });

  it("flag is declared as false (re-enabling requires a documented business decision)", () => {
    // DO NOT simply flip this to true without:
    //  1. Payment tracking implemented in the DB
    //  2. Business owner sign-off
    //  3. A commit message explaining the decision
    expect(navBarSource).toMatch(/const STATEMENT_NAV_ENABLED\s*=\s*false/);
  });

  it("nav link is gated by the flag (Statement link hidden when disabled)", () => {
    // Confirms the flag controls the nav link, not just declared.
    expect(navBarSource).toMatch(/STATEMENT_NAV_ENABLED\s*&&/);
  });
});

// ── SEND_STATEMENT_ENABLED ───────────────────────────────────────────────────

describe("SEND_STATEMENT_ENABLED — must remain false until payment tracking is live", () => {
  it("source file exists", () => {
    expect(creditDrawerSource).not.toBe("");
  });

  it("flag is declared as false (re-enabling requires a documented business decision)", () => {
    // DO NOT simply flip this to true without:
    //  1. Payment tracking implemented in the DB
    //  2. Business owner sign-off
    //  3. A commit message explaining the decision
    expect(creditDrawerSource).toMatch(/const SEND_STATEMENT_ENABLED\s*=\s*false/);
  });

  it("Send Statement button is gated by the flag (hidden when disabled)", () => {
    // Confirms the flag controls the UI button, not just declared.
    expect(creditDrawerSource).toMatch(/SEND_STATEMENT_ENABLED\s*&&/);
  });
});
