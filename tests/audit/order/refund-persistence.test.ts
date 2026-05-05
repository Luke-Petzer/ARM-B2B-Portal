/**
 * Structural tests for refund request persistence (Branch 2).
 *
 * Background
 * ──────────
 * Previously, submitRefundRequestAction only sent emails. If Resend was down
 * or the email was missed, the request was permanently lost with no record in
 * the portal. This branch adds DB-first persistence via the refund_requests
 * table, auto-generated RRQ-NNNNN references, and an admin workflow page.
 *
 * These tests verify structural guarantees across:
 *   1. submitRefundRequestAction — DB insert precedes email dispatch
 *   2. Admin actions — auth-gated, status-constrained updates
 *   3. Email templates — requestReference prop present in both templates
 *   4. Buyer UI — reference shown in success state, refund badge in history
 *   5. Admin page — auth-guarded, shows all requests
 *   6. Navigation — Refund Requests added to admin sidebar and mobile nav
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

function readSource(relativePath: string): string {
  try {
    return fs.readFileSync(path.resolve(__dirname, "../../../", relativePath), "utf-8");
  } catch {
    return "";
  }
}

const refundActionSource   = readSource("src/app/actions/refund.ts");
const refundAdminSource    = readSource("src/app/actions/refund-admin.ts");
const emailTemplateSource  = readSource("src/emails/RefundRequest.tsx");
const modalSource          = readSource("src/components/portal/RefundRequestModal.tsx");
const orderHistorySource   = readSource("src/components/portal/OrderHistoryTable.tsx");
const adminPageSource      = readSource("src/app/(admin)/admin/refund-requests/page.tsx");
const sidebarSource        = readSource("src/components/admin/AdminSidebar.tsx");
const mobileNavSource      = readSource("src/components/admin/AdminMobileNav.tsx");
const migrationSource      = readSource("supabase/migrations/20260505_01_create_refund_requests_table.sql");

// ── Migration ─────────────────────────────────────────────────────────────────

describe("Migration — refund_requests table", () => {
  it("migration file exists", () => {
    expect(migrationSource).not.toBe("");
  });

  it("creates the refund_requests table", () => {
    expect(migrationSource).toContain("CREATE TABLE");
    expect(migrationSource).toContain("refund_requests");
  });

  it("includes a reference column with UNIQUE constraint", () => {
    expect(migrationSource).toContain("reference");
    expect(migrationSource).toContain("UNIQUE");
  });

  it("creates a sequence for auto-generated references", () => {
    expect(migrationSource).toContain("CREATE SEQUENCE");
    expect(migrationSource).toContain("refund_request_reference_seq");
  });

  it("creates BEFORE INSERT trigger for reference generation", () => {
    expect(migrationSource).toMatch(/BEFORE INSERT ON public\.refund_requests/);
  });

  it("enables RLS", () => {
    expect(migrationSource).toContain("ENABLE ROW LEVEL SECURITY");
  });

  it("forces RLS (consistent with all other tables)", () => {
    expect(migrationSource).toContain("FORCE ROW LEVEL SECURITY");
  });

  it("creates buyer SELECT policy (buyers read own records)", () => {
    expect(migrationSource).toContain("buyers_read_own_refund_requests");
    expect(migrationSource).toMatch(/profile_id = auth\.uid\(\)/);
  });

  it("revokes INSERT/UPDATE/DELETE from authenticated and anon", () => {
    expect(migrationSource).toContain("REVOKE INSERT, UPDATE, DELETE ON public.refund_requests FROM authenticated");
    expect(migrationSource).toContain("REVOKE INSERT, UPDATE, DELETE ON public.refund_requests FROM anon");
  });

  it("attaches the audit trigger", () => {
    expect(migrationSource).toContain("trg_audit_refund_requests");
    expect(migrationSource).toMatch(/log_table_audit\(\)/);
  });

  it("includes status CHECK constraint with valid values", () => {
    expect(migrationSource).toContain("pending");
    expect(migrationSource).toContain("acknowledged");
    expect(migrationSource).toContain("resolved");
    expect(migrationSource).toContain("CHECK");
  });

  it("includes pre-flight, post-flight, and rollback SQL in comments", () => {
    expect(migrationSource).toContain("PRE-FLIGHT");
    expect(migrationSource).toContain("POST-FLIGHT");
    expect(migrationSource).toContain("ROLLBACK");
  });
});

// ── submitRefundRequestAction — DB-first ──────────────────────────────────────

describe("submitRefundRequestAction — DB-first persistence", () => {
  it("source file exists", () => {
    expect(refundActionSource).not.toBe("");
  });

  it("inserts into refund_requests before sending emails", () => {
    // The insert call must appear before the email send calls in source order.
    const insertPos = refundActionSource.indexOf(".from(\"refund_requests\")");
    const emailPos  = refundActionSource.indexOf("resend.emails.send(");
    expect(insertPos).toBeGreaterThan(0);
    expect(emailPos).toBeGreaterThan(insertPos);
  });

  it("selects reference from the insert result", () => {
    expect(refundActionSource).toContain(".select(\"reference\")");
  });

  it("returns { success: true, reference } on success", () => {
    expect(refundActionSource).toContain("return { success: true, reference }");
  });

  it("returns an error if the DB insert fails (before attempting emails)", () => {
    expect(refundActionSource).toContain("insertError");
    // Error return appears before email sends
    const errPos   = refundActionSource.indexOf("insertError");
    const emailPos = refundActionSource.indexOf("resend.emails.send(");
    expect(errPos).toBeGreaterThan(0);
    expect(emailPos).toBeGreaterThan(errPos);
  });

  it("emails are still fire-and-forget (reference recorded even if email fails)", () => {
    // The fire-and-forget pattern: Promise.all(sends).catch(...)
    expect(refundActionSource).toMatch(/Promise\.all\(sends\)\.catch/);
  });

  it("email subjects include the request reference", () => {
    expect(refundActionSource).toContain("Return Request ${reference}");
  });

  it("passes adminUrl to email props", () => {
    expect(refundActionSource).toContain("adminUrl");
  });
});

// ── Admin actions ─────────────────────────────────────────────────────────────

describe("markRefundAcknowledgedAction", () => {
  it("source file exists", () => {
    expect(refundAdminSource).not.toBe("");
  });

  it("checks admin session before any DB call", () => {
    const sessionPos = refundAdminSource.indexOf("getSession()");
    const dbPos      = refundAdminSource.indexOf(".from(\"refund_requests\")");
    expect(sessionPos).toBeGreaterThan(0);
    expect(dbPos).toBeGreaterThan(sessionPos);
  });

  it("only transitions requests with status = pending", () => {
    expect(refundAdminSource).toContain(".eq(\"status\", \"pending\")");
  });

  it("sets acknowledged_at and acknowledged_by", () => {
    expect(refundAdminSource).toContain("acknowledged_at");
    expect(refundAdminSource).toContain("acknowledged_by");
  });

  it("calls revalidatePath after successful acknowledge", () => {
    expect(refundAdminSource).toContain("revalidatePath");
    expect(refundAdminSource).toContain("/admin/refund-requests");
  });
});

describe("markRefundResolvedAction", () => {
  it("can resolve from pending OR acknowledged (not only one state)", () => {
    expect(refundAdminSource).toContain(".in(\"status\", [\"pending\", \"acknowledged\"])");
  });

  it("sets resolved_at and resolved_by", () => {
    expect(refundAdminSource).toContain("resolved_at");
    expect(refundAdminSource).toContain("resolved_by");
  });
});

// ── Email templates ───────────────────────────────────────────────────────────

describe("RefundRequest email templates — requestReference prop", () => {
  it("requestReference is declared in RefundRequestEmailProps", () => {
    expect(emailTemplateSource).toContain("requestReference: string");
  });

  it("BuyerRefundConfirmationEmail renders the request reference", () => {
    expect(emailTemplateSource).toContain("Request Reference");
    expect(emailTemplateSource).toContain("{requestReference}");
  });

  it("BusinessRefundNotificationEmail renders the request reference", () => {
    // Both templates use the same prop and render it
    const occurrences = (emailTemplateSource.match(/requestReference/g) ?? []).length;
    expect(occurrences).toBeGreaterThanOrEqual(2);
  });

  it("adminUrl is declared in RefundRequestEmailProps", () => {
    expect(emailTemplateSource).toContain("adminUrl: string");
  });

  it("BusinessRefundNotificationEmail includes admin portal link", () => {
    expect(emailTemplateSource).toContain("adminUrl");
    expect(emailTemplateSource).toContain("View in admin portal");
  });
});

// ── Buyer UI ─────────────────────────────────────────────────────────────────

describe("RefundRequestModal — shows reference in success state", () => {
  it("requestReference state is declared", () => {
    expect(modalSource).toContain("requestReference");
    expect(modalSource).toContain("useState");
  });

  it("reference is extracted from the action result", () => {
    expect(modalSource).toContain("setRequestReference(result.reference)");
  });

  it("reference is rendered in the success state", () => {
    expect(modalSource).toContain("{requestReference}");
  });
});

describe("OrderHistoryTable — refund status badge", () => {
  it("RefundBadge component is defined", () => {
    expect(orderHistorySource).toContain("function RefundBadge");
  });

  it("refundStatus is included in OrderRow interface", () => {
    expect(orderHistorySource).toContain("refundStatus?:");
  });

  it("RefundBadge is rendered when refundStatus is present", () => {
    expect(orderHistorySource).toContain("order.refundStatus");
    expect(orderHistorySource).toContain("RefundBadge");
  });

  it("badge covers all three statuses", () => {
    expect(orderHistorySource).toContain("Return Pending");
    expect(orderHistorySource).toContain("Return Acknowledged");
    expect(orderHistorySource).toContain("Return Resolved");
  });
});

// ── Admin page ────────────────────────────────────────────────────────────────

describe("Admin refund requests page", () => {
  it("page file exists", () => {
    expect(adminPageSource).not.toBe("");
  });

  it("redirects unauthenticated visitors to /admin/login", () => {
    expect(adminPageSource).toContain("isAdmin");
    expect(adminPageSource).toContain("/admin/login");
  });

  it("fetches refund_requests with buyer and order joins", () => {
    expect(adminPageSource).toContain("from(\"refund_requests\")");
    expect(adminPageSource).toContain("order:orders!order_id");
    expect(adminPageSource).toContain("buyer:profiles!profile_id");
  });

  it("shows a pending count badge in the page header", () => {
    expect(adminPageSource).toContain("pendingCount");
    expect(adminPageSource).toContain("pending");
  });

  it("renders acknowledge and resolve actions via RefundRequestActions", () => {
    expect(adminPageSource).toContain("RefundRequestActions");
  });
});

// ── Navigation ────────────────────────────────────────────────────────────────

describe("Admin navigation — Refund Requests link", () => {
  it("AdminSidebar includes /admin/refund-requests", () => {
    expect(sidebarSource).toContain("/admin/refund-requests");
    expect(sidebarSource).toContain("Refund Requests");
  });

  it("AdminMobileNav includes /admin/refund-requests", () => {
    expect(mobileNavSource).toContain("/admin/refund-requests");
    expect(mobileNavSource).toContain("Refund Requests");
  });
});
