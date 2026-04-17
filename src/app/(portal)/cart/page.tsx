export const dynamic = "force-dynamic";

import CartReviewShell from "./CartReviewShell";
import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { adminClient } from "@/lib/supabase/admin";

interface PageProps {
  searchParams: Promise<{ reorder?: string }>;
}

export default async function CartPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { reorder: reorderId } = await searchParams;

  // If ?reorder=<orderId>, fetch those items to pre-hydrate the cart
  let reorderItems: {
    productId: string | null;
    sku: string;
    name: string;
    unitPrice: number;
    quantity: number;
  }[] = [];

  if (reorderId) {
    // Fetch order ownership check and items in parallel
    const [{ data: order }, { data: orderItems }] = await Promise.all([
      adminClient
        .from("orders")
        .select("id")
        .eq("id", reorderId)
        .eq("profile_id", session.profileId)
        .maybeSingle(),
      adminClient
        .from("order_items")
        .select("product_id, sku, product_name, unit_price, quantity")
        .eq("order_id", reorderId),
    ]);

    if (order) {
      type RawItem = {
        product_id: string | null;
        sku: string;
        product_name: string;
        unit_price: number;
        quantity: number;
      };
      reorderItems = ((orderItems ?? []) as RawItem[]).map((i) => ({
        productId: i.product_id,
        sku: i.sku,
        name: i.product_name,
        unitPrice: Number(i.unit_price),
        quantity: i.quantity,
      }));
    }
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/30 flex flex-col">
      <CartReviewShell reorderItems={reorderId ? reorderItems : null} />
    </div>
  );
}
