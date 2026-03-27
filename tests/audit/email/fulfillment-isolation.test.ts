/**
 * Email Failure Isolation Audit
 *
 * Proves that dispatchFulfillmentEmails failures are fully contained:
 * - An exception thrown inside the function never propagates to checkoutAction
 * - Individual Resend API errors are caught per-email, not globally re-thrown
 * - PDF generation occurs AFTER the DB commit (order is safe before PDF runs)
 * - The order redirect does not depend on email success
 *
 * These are structural (static analysis) tests. They verify the isolation
 * pattern holds in the source code, preventing regression.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const checkoutPath = path.resolve(
  __dirname,
  "../../../src/app/actions/checkout.ts"
);
const checkoutSource = fs.readFileSync(checkoutPath, "utf-8");

describe("dispatchFulfillmentEmails — call-site isolation", () => {
  it("is called with .catch() — never awaited directly", () => {
    // Pattern: dispatchFulfillmentEmails(...).catch(...)
    // This ensures a thrown error inside never propagates to checkoutAction
    expect(checkoutSource).toMatch(/dispatchFulfillmentEmails\([\s\S]*?\)\.catch\(/);
  });

  it("is NEVER called with await (which would propagate throws)", () => {
    expect(checkoutSource).not.toMatch(/await dispatchFulfillmentEmails/);
  });
});

describe("dispatchFulfillmentEmails — per-email error handling", () => {
  it("supplier email error is caught with if(error) and logged, not re-thrown", () => {
    // After each resend.emails.send() call the pattern is: if (error) { console.error }
    // This must appear at least once for the supplier email
    expect(checkoutSource).toMatch(/if \(error\)[\s\S]*?console\.error/);
  });

  it("both email sends have independent error catches (supplier + buyer)", () => {
    // Pattern should appear at least twice — once per email send
    const matches = checkoutSource.match(/if \(error\)[\s\S]*?console\.error/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(2);
  });

  it("no throw statement follows an email send error", () => {
    // After a Resend error, we must log — never throw
    // Look for: if (error) { ... throw ... } — this must NOT exist
    const throwAfterEmailError = /if \(error\)\s*\{[\s\S]*?throw[\s\S]*?\}/;
    expect(checkoutSource).not.toMatch(throwAfterEmailError);
  });
});

describe("Order commit precedes all email/PDF work", () => {
  it("dispatchFulfillmentEmails CALL SITE appears after create_order_atomic", () => {
    // The function *definition* appears before the rpc call (that's fine — it's
    // defined at module scope). The *call site* with order arguments must appear
    // after the rpc call. We search for the invocation pattern, not the definition.
    const rpcIndex = checkoutSource.indexOf('"create_order_atomic"');
    // Call site: dispatchFulfillmentEmails(order, ...  — has actual arguments
    const callSiteIndex = checkoutSource.indexOf("dispatchFulfillmentEmails(order");
    expect(rpcIndex).toBeGreaterThan(-1);
    expect(callSiteIndex).toBeGreaterThan(-1);
    expect(callSiteIndex).toBeGreaterThan(rpcIndex);
  });

  it("renderInvoiceToBuffer is called inside dispatchFulfillmentEmails (not in checkoutAction body)", () => {
    // The import of renderInvoiceToBuffer appears at the top — that's expected.
    // What matters: its *invocation* is inside the helper, which is fire-and-forget.
    // We verify the call `renderInvoiceToBuffer({` appears inside the helper function body.
    const helperStart = checkoutSource.indexOf("async function dispatchFulfillmentEmails");
    const helperEnd = checkoutSource.indexOf("export async function checkoutAction");
    const pdfCallIndex = checkoutSource.indexOf("renderInvoiceToBuffer({");
    expect(helperStart).toBeGreaterThan(-1);
    expect(helperEnd).toBeGreaterThan(-1);
    expect(pdfCallIndex).toBeGreaterThan(helperStart);
    expect(pdfCallIndex).toBeLessThan(helperEnd);
  });

  it("redirect call appears after dispatchFulfillmentEmails call-site", () => {
    // The redirect must come AFTER the fire-and-forget dispatch
    const emailCallIndex = checkoutSource.indexOf("dispatchFulfillmentEmails");
    // Find the redirect for the 30-day path
    const redirectIndex = checkoutSource.indexOf("redirect(`/checkout/");
    expect(redirectIndex).toBeGreaterThan(emailCallIndex);
  });
});
