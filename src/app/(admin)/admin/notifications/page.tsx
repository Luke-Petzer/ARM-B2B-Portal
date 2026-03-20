import { adminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import GlobalBannerAdmin from "@/components/admin/GlobalBannerAdmin";
import type { Route } from "next";

export const metadata = {
  title: "Notifications | Admin",
};

export default async function AdminNotificationsPage() {
  const session = await getSession();
  if (!session?.isAdmin) redirect("/admin/login" as Route);

  const { data: settings } = await adminClient
    .from("global_settings")
    .select("banner_message, is_banner_active")
    .eq("id", 1)
    .single();

  return (
    <div className="max-w-[700px]">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
          Notifications
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage portal-wide announcements displayed to all buyers.
        </p>
      </div>

      <GlobalBannerAdmin
        initialMessage={settings?.banner_message ?? null}
        initialActive={settings?.is_banner_active ?? false}
      />
    </div>
  );
}
