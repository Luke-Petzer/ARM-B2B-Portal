export const dynamic = "force-dynamic";

// Phase 5: Full admin dashboard renders here.
// Placeholder confirms admin auth + middleware are working correctly.
import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { logoutAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";

export default async function AdminDashboardPage() {
  const session = await getSession();
  if (!session || !session.isAdmin) redirect("/admin/login");

  return (
    <main className="container mx-auto px-4 py-10 max-w-5xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Signed in as admin
          </p>
        </div>
        <form action={logoutAction}>
          <Button variant="outline" size="sm" type="submit">
            Sign Out
          </Button>
        </form>
      </div>
      <p className="text-muted-foreground">
        Phase 5 — Full admin dashboard coming soon.
      </p>
    </main>
  );
}
