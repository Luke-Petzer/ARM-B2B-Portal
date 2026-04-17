"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
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

  // [L7] UUID validation on orderId
  const rawOrderId = formData.get("orderId") as string;
  const orderIdResult = z.string().uuid().safeParse(rawOrderId);
  if (!orderIdResult.success) return;
  const orderId = orderIdResult.data;

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
