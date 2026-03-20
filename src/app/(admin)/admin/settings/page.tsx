import { adminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import SettingsForm from "@/components/admin/SettingsForm";
import type { Route } from "next";

export default async function AdminSettingsPage() {
  const session = await getSession();
  if (!session?.isAdmin) redirect("/admin/login" as Route);

  // Email lock — only the super admin may access this page
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const superEmail = process.env.ADMIN_SUPER_EMAIL;
  if (!superEmail || user?.email !== superEmail) {
    redirect("/admin" as Route);
  }

  const { data: config } = await adminClient
    .from("tenant_config")
    .select("*")
    .eq("id", 1)
    .single();

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

      <SettingsForm config={config} />
    </div>
  );
}
