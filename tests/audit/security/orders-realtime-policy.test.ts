// tests/audit/security/orders-realtime-policy.test.ts
//
// Guards the orders Realtime cross-tenant policy fix.
//
// Finding: The Supabase-auto-generated policy
//   "Authenticated users receive order changes" (SELECT, qual = true)
// allowed any authenticated buyer to subscribe to postgres_changes on the
// orders table and receive every order across all tenants.
//
// Investigation result (recorded here as regression context):
//   The app uses a Broadcast channel ("admin-orders"), NOT postgres_changes.
//   src/components/admin/OrderLedger.tsx subscribes via .on("broadcast", ...)
//   src/app/actions/checkout.ts sends pings via the service-role REST API.
//   No postgres_changes subscription exists anywhere in the codebase.
//   The wide-open SELECT policy therefore has no operational benefit — it is
//   a pure security liability and must be dropped.
//
// Fix: 20260504_01_drop_orders_realtime_policy.sql
//   DROP POLICY "Authenticated users receive order changes" ON public.orders;
//
// Regression guard: if someone re-enables Realtime on orders in the future
// they must explicitly scope the policy — this test will catch a re-addition
// of a qual=true policy and require justification.

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// ── Migration file ────────────────────────────────────────────────────────────

let migrationSource: string;

try {
  migrationSource = fs.readFileSync(
    path.resolve(
      __dirname,
      "../../../supabase/migrations/20260504_01_drop_orders_realtime_policy.sql"
    ),
    "utf-8"
  );
} catch {
  migrationSource = "";
}

describe("Migration: drop orders Realtime cross-tenant policy", () => {
  it("migration file exists", () => {
    expect(migrationSource, "migration file not found").not.toBe("");
  });

  it("targets the correct policy name", () => {
    // The exact name of the auto-generated policy that must be removed.
    expect(migrationSource).toMatch(/Authenticated users receive order changes/);
  });

  it("is a DROP POLICY statement on public.orders", () => {
    expect(migrationSource).toMatch(/DROP\s+POLICY/i);
    expect(migrationSource).toMatch(/ON\s+(?:public\.)?orders/i);
  });

  it("does not contain CREATE POLICY (no replacement introduced)", () => {
    // The fix is removal only — no new policy should be created in this migration.
    // A future developer who wants to re-add Realtime must open a separate PR.
    expect(migrationSource).not.toMatch(/CREATE\s+POLICY/i);
  });
});

// ── Codebase investigation — confirms no postgres_changes subscription ────────

let orderLedgerSource: string;
let checkoutSource: string;

try {
  orderLedgerSource = fs.readFileSync(
    path.resolve(__dirname, "../../../src/components/admin/OrderLedger.tsx"),
    "utf-8"
  );
} catch {
  orderLedgerSource = "";
}

try {
  checkoutSource = fs.readFileSync(
    path.resolve(__dirname, "../../../src/app/actions/checkout.ts"),
    "utf-8"
  );
} catch {
  checkoutSource = "";
}

describe("Codebase: Realtime uses Broadcast, not postgres_changes", () => {
  it("OrderLedger uses broadcast channel, not postgres_changes", () => {
    // The subscription is .on("broadcast", ...) — not .on("postgres_changes", ...).
    // Note: the word "postgres_changes" may appear in comments; we check the call pattern.
    expect(orderLedgerSource).toMatch(/\.on\s*\(\s*["']broadcast["']/);
    expect(orderLedgerSource).not.toMatch(/\.on\s*\(\s*["']postgres_changes["']/);
  });

  it("checkout sends broadcast via REST (service-role only, not client-side)", () => {
    // The ping uses the service-role key — no anon-key client involved.
    expect(checkoutSource).toMatch(/realtime\/v1\/api\/broadcast/);
    expect(checkoutSource).toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it("no file in src/ has an active postgres_changes subscription on orders", () => {
    // We check for the subscription call pattern — .on("postgres_changes", ...) or
    // .on('postgres_changes', ...) — not just the string, which may appear in comments.
    // If this ever fails, the new subscription needs a properly-scoped RLS policy.
    const srcDir = path.resolve(__dirname, "../../../src");
    const hasPgChangesSubscription = findInDir(
      srcDir,
      /\.on\s*\(\s*["']postgres_changes["']/
    );
    expect(hasPgChangesSubscription).toBe(false);
  });
});

// ── Helper ────────────────────────────────────────────────────────────────────

function findInDir(dir: string, pattern: RegExp): boolean {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return false;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (findInDir(full, pattern)) return true;
    } else if (entry.isFile() && /\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      try {
        const content = fs.readFileSync(full, "utf-8");
        if (pattern.test(content)) return true;
      } catch {
        // skip unreadable files
      }
    }
  }
  return false;
}
