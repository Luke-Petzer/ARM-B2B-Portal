import Image from "next/image";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import NavBar from "@/components/portal/NavBar";
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
        <nav className="h-[72px] border-b border-gray-100 bg-white/80 backdrop-blur-md flex items-center justify-between px-8 flex-shrink-0 sticky top-0 z-50">
          <Link href="/" className="flex items-center">
            <Image
              src="/logo.png"
              alt="AR Steel Manufacturing"
              height={52}
              width={115}
              priority
              className="object-contain"
            />
          </Link>
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors hidden md:block"
            >
              Home
            </Link>
            <Link
              href="/login"
              className="text-sm font-semibold px-5 py-2 border border-gray-200 rounded text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Login
            </Link>
          </div>
        </nav>
      )}

      <div className="flex-1">
        <div className="max-w-4xl mx-auto">
          {pages.map((page) => (
            <Image
              key={page.src}
              src={page.src}
              alt={page.alt}
              width={1240}
              height={1754}
              className="w-full h-auto block"
              priority={page.src.includes("page-01")}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
