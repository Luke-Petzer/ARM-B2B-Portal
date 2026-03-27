import "server-only";
import { adminClient } from "@/lib/supabase/admin";

export interface CreditStatus {
  blocked: boolean;
  reason: "overdue" | "limit_exceeded" | "status_indeterminate" | null;
  /** Current sum of all unpaid/credit_approved confirmed orders */
  outstanding: number;
  /** Client's configured credit limit (null if not set) */
  creditLimit: number | null;
}

/**
 * Checks whether a 30-day client's credit should block the "Approve on Credit" button.
 *
 * Blocked if:
 *  1. Any unpaid or credit_approved order with confirmed_at < first day of the current calendar month
 *  2. Credit limit rule (Rule 2):
 *       credit_limit = null  → unlimited credit, skip check
 *       credit_limit = 0     → COD / no credit allowed, ALWAYS blocked
 *       credit_limit > 0     → blocked if outstanding > credit_limit
 *
 * This check is admin-side ONLY. The buyer portal never calls this.
 */
export async function checkCreditStatus(profileId: string): Promise<CreditStatus> {
  // Start of current calendar month (UTC midnight)
  const now = new Date();
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  // Fetch orders and profile in parallel
  const [ordersResult, profileResult] = await Promise.all([
    adminClient
      .from("orders")
      .select("id, total_amount, confirmed_at, payment_status")
      .eq("profile_id", profileId)
      .in("payment_status", ["unpaid", "credit_approved"])
      .not("confirmed_at", "is", null),
    adminClient
      .from("profiles")
      .select("credit_limit")
      .eq("id", profileId)
      .single(),
  ]);

  if (ordersResult.error || !ordersResult.data) {
    // Fail closed — a DB error is indeterminate state; safer to block than
    // to accidentally approve a client whose status we cannot verify.
    console.error("[credit] failed to fetch orders for profileId:", profileId, ordersResult.error?.message);
    return { blocked: true, reason: "status_indeterminate", outstanding: 0, creditLimit: null };
  }

  const orders = ordersResult.data;

  // C5-03: Log profile fetch errors for observability. When the profile query
  // fails, creditLimit falls through to null (unlimited), which is the
  // least-disruptive failure mode in an admin-only context. The error is logged
  // so the discrepancy is visible in application monitoring.
  if (profileResult.error) {
    console.error(
      "[credit] failed to fetch profile for profileId:",
      profileId,
      profileResult.error.message
    );
  }

  const creditLimit =
    profileResult.data?.credit_limit != null
      ? Number(profileResult.data.credit_limit)
      : null;

  const outstanding = orders.reduce((sum, o) => sum + Number(o.total_amount), 0);

  // Rule 1: any confirmed order from a previous statement period is overdue
  const hasOverdue = orders.some((o) => {
    if (!o.confirmed_at) return false;
    return new Date(o.confirmed_at) < startOfMonth;
  });

  if (hasOverdue) {
    return { blocked: true, reason: "overdue", outstanding, creditLimit };
  }

  // Rule 2: credit limit enforcement
  //   null → unlimited, skip check
  //   0    → COD / no credit, always block regardless of outstanding balance
  //   > 0  → block if outstanding exceeds the configured limit
  if (creditLimit != null && (creditLimit === 0 || outstanding > creditLimit)) {
    return { blocked: true, reason: "limit_exceeded", outstanding, creditLimit };
  }

  return { blocked: false, reason: null, outstanding, creditLimit };
}
