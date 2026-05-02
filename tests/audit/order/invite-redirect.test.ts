/**
 * Structural test: inviteClientAction must include redirectTo pointing at
 * NEXT_PUBLIC_APP_URL/auth/callback?next=/reset-password so invited clients
 * land on the Set Password page (not verify-success, which assumes the user
 * already has a password).
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const source = fs.readFileSync(
  path.resolve(__dirname, "../../../src/app/actions/admin.ts"),
  "utf-8"
);

describe("inviteClientAction — redirectTo", () => {
  it("passes redirectTo to inviteUserByEmail", () => {
    expect(source).toMatch(/inviteUserByEmail\(email,\s*\{[\s\S]*?redirectTo:/);
  });

  it("redirectTo routes to reset-password (not verify-success — invited users have no password yet)", () => {
    expect(source).toMatch(/NEXT_PUBLIC_APP_URL.*auth\/callback.*reset-password/);
  });
});
