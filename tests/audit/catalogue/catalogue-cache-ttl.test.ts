// tests/audit/catalogue/catalogue-cache-ttl.test.ts
//
// Guards the catalogue unstable_cache TTL against silent drift.
//
// Rationale (from docs/audit/ux-dynamic-update-bugs-diagnosis.md):
//   revalidateTag("catalogue") only invalidates the cache for FUTURE page
//   requests. A buyer who is already viewing the catalogue page will not see
//   changes until they navigate away and back. The checkout guard is the
//   real safety net for inactive products.
//
//   The TTL bounds worst-case staleness for buyers who are actively browsing.
//   60 seconds is the deliberate ceiling chosen during the 2026-05-04 audit:
//   short enough that a deactivated product disappears within a minute for
//   returning visitors, without introducing real-time polling or websockets.
//
// If you need to change the TTL, update it in dashboard/page.tsx AND update
// the expected value below. Do not silently bump either without reviewing
// the trade-off documented in the diagnosis report.

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const dashboardSource = fs.readFileSync(
  path.resolve(__dirname, "../../../src/app/(portal)/dashboard/page.tsx"),
  "utf-8"
);

describe("Catalogue cache TTL", () => {
  it("unstable_cache revalidate is 60 seconds (not the original 300)", () => {
    // The cache config lives in the getCatalogueData unstable_cache call.
    // Worst-case stale window for a buyer already on the page = this TTL value.
    // 60s is the deliberate ceiling — see docs/audit/ux-dynamic-update-bugs-diagnosis.md
    expect(dashboardSource).toMatch(/revalidate:\s*60\b/);
  });

  it("catalogue cache tag is still 'catalogue' (required for revalidateTag to work)", () => {
    // toggleProductActiveAction calls revalidateTag("catalogue") in admin.ts.
    // If the tag here drifts from "catalogue", on-demand invalidation silently breaks.
    expect(dashboardSource).toMatch(/tags:\s*\["catalogue"\]/);
  });
});
