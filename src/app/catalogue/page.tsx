import Image from "next/image";
import { getSession } from "@/lib/auth/session";
import NavBar from "@/components/portal/NavBar";
import PublicNavBar from "@/components/PublicNavBar";
import { adminClient } from "@/lib/supabase/admin";
import type { AppRole } from "@/lib/supabase/types";

const TOTAL_PAGES = 11;

const pages = Array.from({ length: TOTAL_PAGES }, (_, i) => {
  const n = String(i + 1).padStart(2, "0");
  return { src: `/catalogue/page-${n}.webp`, alt: `Catalogue page ${i + 1}` };
});

export default async function CataloguePage() {
  const session = await getSession();

  let businessName: string | null = null;
  if (session?.profileId) {
    const { data: profile } = await adminClient
      .from("profiles")
      .select("business_name")
      .eq("id", session.profileId)
      .single();
    businessName = profile?.business_name ?? null;
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {session ? (
        <NavBar
          role={session.role as AppRole | undefined}
          businessName={businessName}
        />
      ) : (
        <PublicNavBar activeItem="catalogue" />
      )}

      <div className={`flex-1 ${!session ? "pt-[72px]" : ""}`}>
        <div className="max-w-4xl mx-auto">
          {pages.map((page, i) => (
            <Image
              key={page.src}
              src={page.src}
              alt={page.alt}
              width={1240}
              height={1754}
              className="w-full h-auto block"
              sizes="(max-width: 896px) 100vw, 896px"
              priority={i === 0}
              loading={i === 0 ? undefined : "eager"}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
