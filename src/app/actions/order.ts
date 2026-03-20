"use server";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { adminClient } from "@/lib/supabase/admin";

/**
 * Loads the items from a previous order into the cart store and redirects to /cart.
 * The actual cart merge happens client-side via a small client component on /cart
 * that reads the `reorder` search param, fetches the items, and hydrates the store.
 */
export async function reorderAction(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");

  const orderId = formData.get("orderId") as string;
  if (!orderId) return;

  // Verify order belongs to this buyer
  const { data: order } = await adminClient
    .from("orders")
    .select("id, profile_id")
    .eq("id", orderId)
    .eq("profile_id", session.profileId)
    .single();

  if (!order) return;

  // Cast required: typedRoutes doesn't cover dynamic query strings
  redirect(`/cart?reorder=${orderId}` as "/cart");
}
