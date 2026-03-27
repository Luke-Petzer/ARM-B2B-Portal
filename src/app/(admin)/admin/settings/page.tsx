import { adminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import SettingsForm from "@/components/admin/SettingsForm";
import type { Route } from "next";

export default async function AdminSettingsPage() {
  const session = await getSession();
  if (!session?.isAdmin) redirect("/admin/login" as Route);

  // Super admin gate — uses the same comma-split logic as getSession()
  if (!session.isSuperAdmin) redirect("/admin" as Route);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: config }, { data: adminUsers }] = await Promise.all([
    adminClient.from("tenant_config").select("*").eq("id", 1).single(),
    adminClient
      .from("profiles")
      .select("id, contact_name, email, admin_role")
      .eq("role", "admin"),
  ]);

  if (!config) {
    return (
      <div className="max-w-[800px]">
        <p className="text-sm text-slate-500">
          Tenant configuration not found. Run the setup SQL to seed the{" "}
          <code className="font-mono">tenant_config</code> table.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-[800px]">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
          Settings
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Configure your portal&apos;s identity, banking, and communication settings.
        </p>
      </div>

      <SettingsForm
        config={config}
        isSuperAdmin
        adminUsers={adminUsers ?? []}
        superAdminEmail={user?.email ?? null}
      />
    </div>
  );
}
