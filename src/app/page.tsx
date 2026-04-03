import Link from "next/link";
import Image from "next/image";
import { adminClient } from "@/lib/supabase/admin";

export const revalidate = 3600; // revalidate branding every hour

export default async function LandingPage() {
  const { data: config } = await adminClient
    .from("tenant_config")
    .select("business_name, trading_name")
    .eq("id", 1)
    .single();

  const displayName = config?.trading_name ?? config?.business_name ?? "AR Steel";

  return (
    <div className="min-h-screen bg-[#0d1117] text-white flex flex-col">
      {/* Navbar */}
      <header className="border-b border-white/10 bg-[#0d1117]/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-[72px] flex items-center justify-between">
          <div className="relative h-[52px] w-[115px]">
            <Image
              src="/logo.png"
              alt={displayName}
              fill
              className="object-contain"
              priority
            />
          </div>
          <nav className="flex items-center gap-6">
            <Link
              href="/catalogue"
              className="text-sm text-white/70 hover:text-white transition-colors"
            >
              Catalogue
            </Link>
            <Link
              href="/login"
              className="text-sm text-white/70 hover:text-white transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="text-sm bg-white text-black px-4 py-2 rounded-md font-medium hover:bg-white/90 transition-colors"
            >
              Get Started
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-4 py-24 gap-8">
        <h1 className="text-5xl sm:text-6xl font-bold tracking-tight max-w-3xl">
          {displayName}
        </h1>
        <p className="text-lg text-white/60 max-w-xl">
          Access our product catalogue and place orders online. Register for an
          account to get started.
        </p>
        <div className="flex items-center gap-4">
          <Link
            href="/register"
            className="bg-white text-black px-6 py-3 rounded-md font-semibold hover:bg-white/90 transition-colors"
          >
            Create Account
          </Link>
          <Link
            href="/login"
            className="border border-white/20 text-white px-6 py-3 rounded-md font-semibold hover:bg-white/10 transition-colors"
          >
            Sign In
          </Link>
        </div>
        <p className="text-sm text-white/40">
          Browse our{" "}
          <Link href="/catalogue" className="underline hover:text-white/70">
            product catalogue
          </Link>{" "}
          — no account required.
        </p>
      </main>
    </div>
  );
}
