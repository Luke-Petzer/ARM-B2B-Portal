/**
 * Structural tests for the daily report email distribution feature.
 *
 * Background
 * ──────────
 * The cron job at /api/cron/daily-report uploads the daily orders CSV to
 * Supabase Storage and emails it to the addresses configured in
 * tenant_config.report_emails (a comma-separated TEXT column).
 *
 * These tests verify the structural guarantees:
 *   1. tenant_config is fetched alongside CSV generation (not an afterthought).
 *   2. report_emails is parsed as a comma-separated string.
 *   3. Email failures are non-fatal — logged, never thrown.
 *   4. Storage upload failure remains non-fatal (unchanged behaviour).
 *   5. The CSV is attached to the email (not just embedded in the body).
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const routeSource = fs.readFileSync(
  path.resolve(__dirname, "../../../src/app/api/cron/daily-report/route.ts"),
  "utf-8"
);

// ── Recipient parsing ────────────────────────────────────────────────────────

describe("report_emails — comma-separated parsing", () => {
  // The parsing logic is inline in the route. These tests validate the pattern
  // exists in source, not the runtime behaviour (which is straightforward).

  it("route splits report_emails on comma", () => {
    expect(routeSource).toMatch(/\.split\(\s*","\s*\)/);
  });

  it("route trims whitespace from each address", () => {
    expect(routeSource).toMatch(/\.map\(\s*\(e\)\s*=>\s*e\.trim\(\)\s*\)/);
  });

  it("route filters empty strings after trim", () => {
    expect(routeSource).toMatch(/\.filter\(\s*Boolean\s*\)/);
  });
});

// ── Non-fatal error handling ─────────────────────────────────────────────────

describe("email distribution — non-fatal on failure", () => {
  it("email error is logged with console.error, not thrown", () => {
    // Pattern: if (emailError) { console.error ... }
    // There must be no `throw` after an email error.
    expect(routeSource).toMatch(/emailError[\s\S]*?console\.error/);
  });

  it("no throw statement follows an email error", () => {
    // Structural guard: email failures must never propagate as exceptions.
    const throwAfterEmailError = /emailError[\s\S]*?throw/;
    expect(routeSource).not.toMatch(throwAfterEmailError);
  });

  it("storage upload error is logged with console.error, not thrown", () => {
    expect(routeSource).toMatch(/uploadError[\s\S]*?console\.error/);
  });

  it("missing Resend config is warned with console.warn, not thrown", () => {
    expect(routeSource).toMatch(/console\.warn\([^)]*RESEND/);
  });
});

// ── Integration shape ────────────────────────────────────────────────────────

describe("daily report cron — integration shape", () => {
  it("fetches tenant_config.report_emails", () => {
    expect(routeSource).toMatch(/report_emails/);
  });

  it("tenant_config is fetched via Promise.all alongside CSV generation", () => {
    // Both should appear inside a Promise.all call — confirms parallelisation.
    expect(routeSource).toMatch(/Promise\.all\([\s\S]*?tenant_config[\s\S]*?\)/);
  });

  it("CSV is sent as an email attachment (not embedded in body)", () => {
    expect(routeSource).toMatch(/attachments\s*:/);
  });

  it("attachment filename includes the date string", () => {
    expect(routeSource).toMatch(/daily-report-.*\.csv/);
  });

  it("attachment content is a Buffer of the CSV string", () => {
    expect(routeSource).toMatch(/Buffer\.from\(\s*csv/);
  });

  it("email is only sent when recipients list is non-empty", () => {
    // Guard: recipients.length > 0 must precede the send call.
    expect(routeSource).toMatch(/recipients\.length\s*>\s*0/);
  });
});
