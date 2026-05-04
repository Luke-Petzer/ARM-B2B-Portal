import Image from "next/image";
import CatalogueNavBar from "@/components/catalogue/CatalogueNavBar";

export const revalidate = 86400;

const TOTAL_PAGES = 11;

const pages = Array.from({ length: TOTAL_PAGES }, (_, i) => {
  const n = String(i + 1).padStart(2, "0");
  return { src: `/catalogue/page-${n}.webp`, alt: `Catalogue page ${i + 1}` };
});

export default function CataloguePage() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <CatalogueNavBar />
      <div className="flex-1">
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
