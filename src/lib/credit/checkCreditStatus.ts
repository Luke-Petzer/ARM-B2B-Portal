import "server-only";
import { adminClient } from "@/lib/supabase/admin";

export interface CreditStatus {
  blocked: boolean;
  reason: "overdue" | "limit_exceeded" | "status_indeterminate" | null;
}

/**
 * Checks whether a 30-day client's credit should block the "Approve on Credit" button.
 *
 * Blocked if:
 *  1. Any unpaid or credit_approved order with confirmed_at < first day of the current calendar month
 *  2. Sum of unpaid + credit_approved confirmed orders > client's credit_limit (when limit is set)
 *
 * This check is admin-side ONLY. The buyer portal never calls this.
 */
export async function checkCreditStatus(profileId: string): Promise<CreditStatus> {
  // Start of current calendar month (UTC midnight)
  const now = new Date();
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  // Fetch all unpaid + credit_approved confirmed orders for this profile
  const { data: orders, error } = await adminClient
    .from("orders")
    .select("id, total_amount, confirmed_at, payment_status")
    .eq("profile_id", profileId)
    .in("payment_status", ["unpaid", "credit_approved"])
    .not("confirmed_at", "is", null);

  if (error || !orders) {
    // Fail closed — a DB error is indeterminate state; safer to block than
    // to accidentally approve a client whose status we cannot verify.
    console.error("[credit] failed to fetch orders for profileId:", profileId, error?.message);
    return { blocked: true, reason: "status_indeterminate" };
  }

  // Rule 1: any confirmed order from a previous statement period is overdue
  const hasOverdue = orders.some((o) => {
    if (!o.confirmed_at) return false;
    return new Date(o.confirmed_at) < startOfMonth;
  });

  if (hasOverdue) {
    return { blocked: true, reason: "overdue" };
  }

  // Rule 2: outstanding balance exceeds credit limit
  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("credit_limit")
    .eq("id", profileId)
    .single();

  if (profileError) {
    console.error("[credit] failed to fetch profile for profileId:", profileId, profileError.message);
    return { blocked: true, reason: "status_indeterminate" };
  }

  if (profile?.credit_limit != null && profile.credit_limit > 0) {
    const outstanding = orders.reduce((sum, o) => sum + Number(o.total_amount), 0);
    if (outstanding > Number(profile.credit_limit)) {
      return { blocked: true, reason: "limit_exceeded" };
    }
  }

  return { blocked: false, reason: null };
}
