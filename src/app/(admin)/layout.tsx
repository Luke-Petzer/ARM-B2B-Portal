import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { adminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import Image from "next/image";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminLogoutButton from "@/components/admin/AdminLogoutButton";
import AdminMobileNav from "@/components/admin/AdminMobileNav";
import type { Route } from "next";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session?.isAdmin) redirect("/admin/login" as Route);

  // Fetch admin's own profile for sidebar display
  const { data: profile } = await adminClient
    .from("profiles")
    .select("contact_name, email")
    .eq("id", session.profileId)
    .single();

  const adminName = profile?.contact_name ?? "Admin";
  const adminEmail = profile?.email ?? "";

  // Determine super admin status via Supabase Auth email
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const superEmail = process.env.ADMIN_SUPER_EMAIL;
  const isSuperAdmin = Boolean(
    superEmail && user?.email && user.email === superEmail
  );

  return (
    <div className="min-h-screen bg-slate-50 flex overflow-x-hidden font-inter">
      <AdminSidebar adminName={adminName} adminEmail={adminEmail} isSuperAdmin={isSuperAdmin} />

      {/* Main area */}
      <div className="flex-1 min-w-0 md:ml-[250px] flex flex-col min-h-screen">
        {/* Top header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-50">
          <div className="flex items-center gap-4">
            <AdminMobileNav isSuperAdmin={isSuperAdmin} />
            <Image
              src="/logo.png"
              alt="AR Steel Manufacturing"
              height={28}
              width={110}
              className="hidden md:block object-contain"
            />
            <p className="text-sm font-medium text-slate-700">
              {adminName}
              <span className="ml-2 text-[11px] font-normal text-slate-400">Admin</span>
            </p>
          </div>
          <AdminLogoutButton variant="header" />
        </header>

        {/* Page content */}
        <main className="flex-1 min-w-0 overflow-y-scroll p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
