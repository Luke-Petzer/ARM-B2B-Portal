import Image from "next/image";
import Link from "next/link";

const TOTAL_PAGES = 11;

const pages = Array.from({ length: TOTAL_PAGES }, (_, i) => {
  const n = String(i + 1).padStart(2, "0");
  return { src: `/catalogue/page-${n}.webp`, alt: `Catalogue page ${i + 1}` };
});

export default function CataloguePage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
          <Link
            href="/"
            className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
          >
            &larr; Back
          </Link>
          <Link
            href="/login"
            className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
          >
            Login
          </Link>
        </div>
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
  );
}
