import Image from "next/image";
import Link from "next/link";

type ActiveItem = "services" | "catalogue" | "contact" | null;

interface PublicNavBarProps {
  activeItem?: ActiveItem;
}

export default function PublicNavBar({ activeItem = null }: PublicNavBarProps) {
  const baseLinkClass =
    "text-sm transition-colors duration-200 font-inter hidden md:block focus-visible:outline focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2 rounded-sm";

  const linkClass = (item: ActiveItem) =>
    activeItem === item
      ? `${baseLinkClass} text-white`
      : `${baseLinkClass} text-white/60 hover:text-white`;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-[#050d14]/80 backdrop-blur-md">
      <div className="max-w-[1400px] mx-auto px-6 md:px-16 lg:px-24 py-4 flex items-center justify-between">
        <Link
          href="/"
          className="flex-shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2 rounded-sm"
        >
          <Image
            src="/logo-dark.png"
            alt="AR Steel Manufacturing"
            height={42}
            width={105}
            className="object-contain border border-[#1a3a6e] rounded"
            priority
          />
        </Link>

        <div className="flex items-center gap-5 md:gap-8">
          <Link href="/#services" className={linkClass("services")}>
            Services
          </Link>
          <Link href="/catalogue" className={linkClass("catalogue")}>
            Catalogue
          </Link>
          <Link href="/#footer" className={linkClass("contact")}>
            Contact Us
          </Link>
          <Link
            href="/login"
            className="text-sm border border-white/30 hover:border-white text-white px-5 py-2 min-h-[44px] rounded-sm transition-all duration-200 font-bebas tracking-widest hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
          >
            Login
          </Link>
        </div>
      </div>
    </nav>
  );
}
