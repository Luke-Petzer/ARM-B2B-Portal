"use server";

import { getSession } from "@/lib/auth/session";
import { adminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

/**
 * Mark a refund request as acknowledged by the current admin.
 * Only transitions requests that are currently in 'pending' status.
 */
export async function markRefundAcknowledgedAction(
  refundRequestId: string
): Promise<{ error: string } | { success: true }> {
  const session = await getSession();
  if (!session?.isAdmin) return { error: "Not authorised." };

  const { error } = await adminClient
    .from("refund_requests")
    .update({
      status: "acknowledged",
      acknowledged_at: new Date().toISOString(),
      acknowledged_by: session.profileId,
    })
    .eq("id", refundRequestId)
    .eq("status", "pending");

  if (error) {
    console.error("[refund-admin] acknowledge failed:", error.message);
    return { error: "Failed to acknowledge request. Please try again." };
  }

  revalidatePath("/admin/refund-requests");
  return { success: true };
}

/**
 * Mark a refund request as resolved by the current admin.
 * Transitions from either 'pending' or 'acknowledged' status.
 */
export async function markRefundResolvedAction(
  refundRequestId: string
): Promise<{ error: string } | { success: true }> {
  const session = await getSession();
  if (!session?.isAdmin) return { error: "Not authorised." };

  const { error } = await adminClient
    .from("refund_requests")
    .update({
      status: "resolved",
      resolved_at: new Date().toISOString(),
      resolved_by: session.profileId,
    })
    .eq("id", refundRequestId)
    .in("status", ["pending", "acknowledged"]);

  if (error) {
    console.error("[refund-admin] resolve failed:", error.message);
    return { error: "Failed to resolve request. Please try again." };
  }

  revalidatePath("/admin/refund-requests");
  return { success: true };
}
