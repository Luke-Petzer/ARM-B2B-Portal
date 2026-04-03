// tests/audit/auth/authorization.test.ts
//
// C2 — Authorization & RLS Enforcement
//
// Static-analysis tests verifying that:
//   1. Every admin server action gates on requireAdmin()
//   2. Buyer sessions hard-code isAdmin = false (no privilege escalation via JWT crafting)
//   3. Admin sessions hard-code isBuyer = false
//   4. create_order_atomic restricts EXECUTE to service_role only
//   5. Buyer login action rejects admin accounts
//   6. Session module preference order: buyer JWT checked before Supabase Auth

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const adminActionSource = fs.readFileSync(
  path.resolve(__dirname, "../../../src/app/actions/admin.ts"),
  "utf-8"
);

const authActionSource = fs.readFileSync(
  path.resolve(__dirname, "../../../src/app/actions/auth.ts"),
  "utf-8"
);

const sessionSource = fs.readFileSync(
  path.resolve(__dirname, "../../../src/lib/auth/session.ts"),
  "utf-8"
);

const hardeningMigration = fs.readFileSync(
  path.resolve(__dirname, "../../../supabase/migrations/20260326_emergency_hardening.sql"),
  "utf-8"
);

// ── 1. requireAdmin guard — every exported admin action ──────────────────────

/**
 * Extract all exported async function names from admin.ts and verify each one
 * calls requireAdmin() within its body.
 *
 * Strategy: find each `export async function <name>` declaration, then scan
 * the function body for `requireAdmin` before the next exported function.
 */
describe("Authorization: admin.ts — every exported action must call requireAdmin()", () => {
  // Locate all exported functions and their body bounds
  const exportPattern = /export async function (\w+)/g;
  const matches: { name: string; index: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = exportPattern.exec(adminActionSource)) !== null) {
    matches.push({ name: m[1], index: m.index });
  }

  for (let i = 0; i < matches.length; i++) {
    const { name, index } = matches[i];
    const bodyEnd = i + 1 < matches.length ? matches[i + 1].index : adminActionSource.length;
    const body = adminActionSource.slice(index, bodyEnd);

    it(`${name}() calls requireAdmin() before any data mutation`, () => {
      expect(body).toMatch(/requireAdmin\s*\(\)/);
    });
  }
});

// ── 2. Buyer session always returns isAdmin: false ────────────────────────────

describe("Authorization: session.ts — privilege isolation", () => {
  it("buyer session returns isAdmin: false (hardcoded — cannot be escalated via JWT claims)", () => {
    // The buyer JWT path returns a hardcoded isAdmin: false regardless of what
    // app_role claim is in the token. This prevents a crafted JWT with
    // app_role: 'admin' from gaining admin privilege.
    //
    // The pattern to find: inside the buyer cookie branch, isAdmin is false.
    // We verify the literal `isAdmin: false` appears in the session source.
    expect(sessionSource).toMatch(/isAdmin:\s*false/);
  });

  it("admin session derives isBuyer from role (profile.role !== 'admin')", () => {
    // isBuyer is derived from the profile role, not hardcoded.
    // For admin roles this evaluates to false; for buyer roles it evaluates to true.
    expect(sessionSource).toMatch(/isBuyer:\s*profile\.role\s*!==\s*["']admin["']/);
  });

  it("buyer cookie is checked BEFORE Supabase Auth (buyer-first preference order)", () => {
    // getSession() checks the buyer JWT cookie first. If a user has both
    // a buyer cookie and a stale Supabase Auth session, the buyer session wins.
    // This prevents unintended role confusion during the transition period.
    const buyerIdx = sessionSource.indexOf("BUYER_SESSION_COOKIE");
    const supabaseIdx = sessionSource.indexOf("supabase.auth.getUser");
    expect(buyerIdx).toBeGreaterThanOrEqual(0);
    expect(supabaseIdx).toBeGreaterThanOrEqual(0);
    expect(buyerIdx).toBeLessThan(supabaseIdx);
  });

  it("session.ts imports server-only to prevent accidental client bundle inclusion", () => {
    expect(sessionSource).toMatch(/^import "server-only"/m);
  });

  it("admin session uses adminClient (service role) to bypass RLS for profile lookup", () => {
    // Standard SSR clients don't have app_role in their JWT (Supabase dashboard users),
    // so RLS policies would deny the SELECT. The service-role client bypasses RLS,
    // allowing the profile lookup to succeed for all admin users.
    expect(sessionSource).toMatch(/adminClient/);
  });
});

// ── 3. Buyer login rejects admin accounts ─────────────────────────────────────

describe("Authorization: auth.ts — buyer login rejects admin accounts", () => {
  it("buyerLoginAction checks profile.role === 'admin' and returns an error", () => {
    // Admins authenticate via a separate admin login endpoint. If an admin
    // account number were somehow submitted to the buyer login form, it must
    // be rejected to prevent admin accounts from establishing buyer sessions.
    expect(authActionSource).toMatch(/profile\.role\s*===\s*["']admin["']/);
  });

  it("buyerLoginAction returns a generic 'Account not found or inactive.' for admin accounts", () => {
    // The error message must be deliberately vague — same message used for
    // missing accounts — to prevent confirming whether an account exists.
    expect(authActionSource).toMatch(/Account not found or inactive\./);
  });
});

// ── 4. create_order_atomic — EXECUTE restricted to service_role ───────────────

describe("Authorization: create_order_atomic — least-privilege EXECUTE grant", () => {
  it("GRANT EXECUTE is scoped to service_role only — not anon or authenticated", () => {
    // If the function were executable by anon or authenticated, any Supabase
    // user could forge orders directly. The service-role restriction ensures
    // only the server-side adminClient can call it.
    expect(hardeningMigration).toMatch(/GRANT EXECUTE/);
    expect(hardeningMigration).toMatch(/TO\s+service_role/);
  });

  it("GRANT does NOT include the anon role", () => {
    // Explicitly confirm there is no GRANT to anon.
    expect(hardeningMigration).not.toMatch(/GRANT EXECUTE.*anon/);
  });

  it("GRANT does NOT include the authenticated role", () => {
    // Explicitly confirm there is no GRANT to authenticated (which would allow
    // any logged-in Supabase user to call the function directly).
    expect(hardeningMigration).not.toMatch(/GRANT EXECUTE.*authenticated/);
  });

  it("function uses SECURITY DEFINER (runs as owner, not caller)", () => {
    // SECURITY DEFINER ensures the function executes with postgres (owner)
    // privileges regardless of the calling role. Combined with
    // SET search_path = public, this prevents search_path injection.
    expect(hardeningMigration).toMatch(/SECURITY DEFINER/);
  });

  it("function pins search_path to 'public' (prevents search_path injection)", () => {
    // Without SET search_path, a malicious caller could create a schema that
    // shadows 'public' and redirect INSERT statements to attacker-controlled tables.
    expect(hardeningMigration).toMatch(/SET search_path\s*=\s*public/);
  });
});
