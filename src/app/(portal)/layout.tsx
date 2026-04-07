import { adminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import GlobalBanner from "@/components/portal/GlobalBanner";
import NavBar from "@/components/portal/NavBar";
import type { AppRole } from "@/lib/supabase/types";

export const revalidate = 60; // revalidate banner state at most every 60 seconds

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Fetch session (for NavBar role) and banner state in parallel
  const [session, { data: settings, error: bannerError }] = await Promise.all([
    getSession(),
    adminClient
      .from("global_settings")
      .select("banner_message, is_banner_active")
      .eq("id", 1)
      .single(),
  ]);

  if (bannerError) {
    console.error("[portal/layout] global_settings fetch failed:", bannerError.message);
  }

  if (!session) redirect("/login");

  let businessName: string | null = null;
  if (session?.profileId) {
    const { data: profile } = await adminClient
      .from("profiles")
      .select("business_name")
      .eq("id", session.profileId)
      .single();
    businessName = profile?.business_name ?? null;
  }

  const showBanner =
    settings?.is_banner_active === true &&
    typeof settings.banner_message === "string" &&
    settings.banner_message.trim().length > 0;

  return (
    <div className="h-[100dvh] overflow-hidden flex flex-col bg-white">
      {/* Banner is flex-shrink-0 so it never compresses the content area */}
      {showBanner && <GlobalBanner message={settings!.banner_message!} />}
      {/* NavBar lives here — outside any overflow container, always visible */}
      <NavBar role={session?.role as AppRole | undefined} businessName={businessName} />
      {/* Content area fills remaining viewport height exactly */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {children}
      </div>
    </div>
  );
}
