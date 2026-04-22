"use server";

import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { adminClient } from "@/lib/supabase/admin";

// [L4] Max-length caps on address fields
const addressSchema = z.object({
  line1: z.string().trim().min(1, "Street address is required").max(200),
  line2: z.string().trim().max(200).optional(),
  suburb: z.string().trim().max(100).optional(),
  city: z.string().trim().min(1, "City is required").max(100),
  province: z.string().trim().max(100).optional(),
  postal_code: z.string().trim().max(20).optional(),
  country: z.string().trim().max(100).default("South Africa"),
});

export async function saveAddressAction(
  formData: FormData
): Promise<{ error: string } | { success: true }> {
  const session = await getSession();
  if (!session || !session.isBuyer) return { error: "Unauthorized" };

  const parsed = addressSchema.safeParse({
    line1: formData.get("line1"),
    line2: formData.get("line2") || undefined,
    suburb: formData.get("suburb") || undefined,
    city: formData.get("city"),
    province: formData.get("province") || undefined,
    postal_code: formData.get("postal_code") || undefined,
    country: formData.get("country") || "South Africa",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { error } = await adminClient.from("addresses").insert({
    profile_id: session.profileId,
    type: "shipping",
    is_default: true,
    ...parsed.data,
  });

  if (error) return { error: "Failed to save address. Please try again." };
  return { success: true };
}
