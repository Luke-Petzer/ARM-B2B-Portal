import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import Image from "next/image";

const TOTAL_PAGES = 11;

const pages = Array.from({ length: TOTAL_PAGES }, (_, i) => {
  const n = String(i + 1).padStart(2, "0");
  return { src: `/catalogue/page-${n}.webp`, alt: `Catalogue page ${i + 1}` };
});

export default async function CataloguePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="flex-1 overflow-y-auto bg-white">
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
  );
}
