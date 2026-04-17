// tests/audit/api/route-access.test.ts
//
// Static-analysis audit tests for API route authentication and access control.
// Source files are read as plain strings — no Next.js runtime required.

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// ── Source file fixtures ───────────────────────────────────────────────────────

const invoiceRouteSource = fs.readFileSync(
  path.resolve(__dirname, "../../../src/app/api/invoice/[orderId]/route.ts"),
  "utf-8"
);

const cronRouteSource = fs.readFileSync(
  path.resolve(__dirname, "../../../src/app/api/cron/daily-report/route.ts"),
  "utf-8"
);

const dailyReportRouteSource = fs.readFileSync(
  path.resolve(__dirname, "../../../src/app/api/reports/daily/route.ts"),
  "utf-8"
);

const dailyReportLibSource = fs.readFileSync(
  path.resolve(__dirname, "../../../src/lib/reports/daily-report.ts"),
  "utf-8"
);

// ── 1. Invoice Route — authentication ─────────────────────────────────────────

describe("Invoice Route (/api/invoice/[orderId]): authentication", () => {
  it("calls getSession() to authenticate the request", () => {
    expect(invoiceRouteSource).toMatch(/getSession\(\)/);
  });

  it("returns HTTP 401 for unauthenticated requests", () => {
    // Source must contain a 401 status literal as the unauthenticated response.
    expect(invoiceRouteSource).toMatch(/status:\s*401/);
  });

  it("scopes the order query to session.profileId for cross-buyer isolation", () => {
    // The .eq("profile_id", session.profileId) clause ensures a buyer can only
    // retrieve orders that belong to their own profile, preventing horizontal
    // privilege escalation via a known orderId.
    expect(invoiceRouteSource).toMatch(/\.eq\("profile_id",\s*session\.profileId\)/);
  });

  it("sets Content-Type to application/pdf on the response", () => {
    expect(invoiceRouteSource).toMatch(/"Content-Type":\s*"application\/pdf"/);
  });
});

// ── 2. Invoice Route — IDOR (Insecure Direct Object Reference) protection ─────

describe("Invoice Route (/api/invoice/[orderId]): IDOR protection", () => {
  it("gates order lookup on session.profileId — prevents horizontal privilege escalation", () => {
    // The query chains .eq("id", orderId) WITH .eq("profile_id", session.profileId).
    // Both conditions must be present so an attacker cannot enumerate invoices
    // belonging to other buyers by guessing or enumerating order IDs.
    expect(invoiceRouteSource).toMatch(/\.eq\("id",\s*orderId\)/);
    expect(invoiceRouteSource).toMatch(/\.eq\("profile_id",\s*session\.profileId\)/);
  });

  it("does NOT grant admin bypass via session.isAdmin — admins use a separate path", () => {
    // This route is buyer-facing only. Admin access to invoices should use a
    // dedicated admin route with appropriate privilege checks. An isAdmin bypass
    // here would allow any admin session to fetch any buyer's invoice by orderId
    // without the profileId scope.
    expect(invoiceRouteSource).not.toMatch(/session\.isAdmin/);
  });

  it("returns 404 (not 403) when the order is not found for this buyer", () => {
    // Returning 404 rather than 403 avoids leaking whether a given orderId
    // exists for a different buyer (oracle attack mitigation).
    expect(invoiceRouteSource).toMatch(/status:\s*404/);
  });
});

// ── 3. Cron Route — secret validation ─────────────────────────────────────────

describe("Cron Route (/api/cron/daily-report): secret validation", () => {
  it("reads the authorization header from the request", () => {
    expect(cronRouteSource).toMatch(/headers\.get\("authorization"\)/);
  });

  it("reads CRON_SECRET from the environment", () => {
    expect(cronRouteSource).toMatch(/process\.env\.CRON_SECRET/);
  });

  it("returns 401 when the authorization header is missing or CRON_SECRET is unset", () => {
    // The guard `!authHeader || !cronSecret || ...` covers both cases in a
    // single branch. A missing env var (undeployed secret) also returns 401
    // rather than silently allowing access.
    expect(cronRouteSource).toMatch(/!authHeader\s*\|\|\s*!cronSecret/);
    expect(cronRouteSource).toMatch(/status:\s*401/);
  });

  it("uses timingSafeEqual for constant-time token comparison — not string equality", () => {
    // [M15] Timing-safe comparison prevents timing side-channel attacks where
    // an attacker can measure response times to progressively guess the secret.
    // The comparison must use crypto.timingSafeEqual on Buffer representations.
    expect(cronRouteSource).toMatch(/timingSafeEqual/);
    expect(cronRouteSource).not.toMatch(/startsWith/);
    expect(cronRouteSource).not.toMatch(/includes\s*\(/);
  });

  it("requires the Bearer prefix in the authorization header value", () => {
    // The comparison is against the full `Bearer <secret>` string, so a request
    // that presents the raw secret without the prefix is rejected.
    expect(cronRouteSource).toMatch(/Bearer \$\{cronSecret\}/);
  });
});

// ── 4. Daily Report Route — admin-only access ─────────────────────────────────

describe("Daily Report Route (/api/reports/daily): admin-only access", () => {
  it("checks session.isAdmin before serving data", () => {
    expect(dailyReportRouteSource).toMatch(/session\?\.isAdmin/);
  });

  it("returns 401 when the session is missing or the caller is not an admin", () => {
    // A buyer session (isAdmin === false) must be rejected here; the route
    // must not fall through to CSV generation for non-admin callers.
    expect(dailyReportRouteSource).toMatch(/status:\s*401/);
  });

  it("validates the date query parameter against a strict YYYY-MM-DD regex before use", () => {
    // Without validation an attacker could inject arbitrary strings into the
    // date that ends up in the filename (Content-Disposition header) or is
    // passed to new Date(), potentially causing misbehaviour.
    expect(dailyReportRouteSource).toMatch(/\/\^\\d\{4\}-\\d\{2\}-\\d\{2\}\$\//);
  });

  it("date regex anchors both start (^) and end ($) of the string", () => {
    // An un-anchored regex like /\d{4}-\d{2}-\d{2}/ would accept strings
    // such as '2024-01-01; DROP TABLE orders'. Both anchors are required.
    expect(dailyReportRouteSource).toMatch(/\^\\d\{4\}-\\d\{2\}-\\d\{2\}\$/);
  });
});

// ── 5. CSV injection in daily-report.ts ───────────────────────────────────────

describe("daily-report.ts: CSV injection surface", () => {
  it("exports a csvEsc helper function", () => {
    expect(dailyReportLibSource).toMatch(/function csvEsc/);
  });

  it("csvEsc wraps values containing commas in double-quotes (RFC 4180)", () => {
    // A value like 'Smith, Ltd' must be emitted as '"Smith, Ltd"' to avoid
    // splitting into spurious columns.
    expect(dailyReportLibSource).toMatch(/v\.includes\(","\)/);
  });

  it("csvEsc escapes internal double-quotes by doubling them (RFC 4180)", () => {
    // 'She said "hello"' → '"She said ""hello"""'
    // The replace pattern must be: v.replace(/"/g, '""')
    expect(dailyReportLibSource).toMatch(/v\.replace\(\/"\//);
    expect(dailyReportLibSource).toMatch(/'""'/);
  });

  it("[M10] csvEsc sanitises formula-injection characters by prefixing with a single quote", () => {
    // [M10] csvEsc now prefixes values starting with =, +, -, @, tab, or
    // carriage-return with a single quote so spreadsheet apps treat the cell
    // as a literal string instead of a formula (CWE-1236 mitigation).
    const csvEscBody = dailyReportLibSource.match(/function csvEsc[\s\S]*?\n\}/)?.[0] ?? "";
    // Must contain a regex test for formula-dangerous leading characters
    expect(csvEscBody).toMatch(/\^?\[=\+\\-@/);
    // Must prefix with a single quote
    expect(csvEscBody).toMatch(/`'`|`'\$\{|'\$\{v\}/);
  });

  it("dateStr column (DD/MM/YYYY) is safe from formula injection", () => {
    // The date string is constructed from integer parts (getUTCDate, etc.) and
    // forward slashes only. It can never start with a formula character, so
    // csvEsc is not needed for this column and there is no injection risk.
    expect(dailyReportLibSource).toMatch(/`\$\{dd\}\/\$\{mm\}\/\$\{yyyy\}`/);
  });
});

// ── 6. server-only guard ───────────────────────────────────────────────────────

describe("daily-report.ts: server-only guard", () => {
  it("imports 'server-only' at the top of the file", () => {
    // Importing 'server-only' causes a build-time error if the module is ever
    // accidentally bundled into a client component, preventing secrets (admin
    // Supabase key, order data) from leaking to the browser.
    expect(dailyReportLibSource).toMatch(/^import "server-only"/m);
  });

  it("'server-only' import appears before any other imports", () => {
    const serverOnlyIdx = dailyReportLibSource.indexOf('import "server-only"');
    const adminClientIdx = dailyReportLibSource.indexOf("adminClient");
    expect(serverOnlyIdx).toBeGreaterThanOrEqual(0);
    expect(serverOnlyIdx).toBeLessThan(adminClientIdx);
  });
});
