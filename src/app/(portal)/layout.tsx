import { adminClient } from "@/lib/supabase/admin";
import GlobalBanner from "@/components/portal/GlobalBanner";

export const revalidate = 60; // revalidate banner state at most every 60 seconds

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Fetch banner state — adminClient bypasses RLS; data is non-sensitive
  const { data: settings, error: bannerError } = await adminClient
    .from("global_settings")
    .select("banner_message, is_banner_active")
    .eq("id", 1)
    .single();

  if (bannerError) {
    console.error("[portal/layout] global_settings fetch failed:", bannerError.message);
  }

  const showBanner =
    settings?.is_banner_active === true &&
    typeof settings.banner_message === "string" &&
    settings.banner_message.trim().length > 0;

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-white">
      {/* Banner is flex-shrink-0 so it never compresses the content area */}
      {showBanner && <GlobalBanner message={settings!.banner_message!} />}
      {/* Content area fills remaining viewport height exactly */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {children}
      </div>
    </div>
  );
}
