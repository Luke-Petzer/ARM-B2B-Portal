import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function CataloguePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const pdfUrl = process.env.NEXT_PUBLIC_CATALOGUE_PDF_URL ?? null;

  return (
    <div className="flex-1 overflow-hidden flex flex-col bg-white">
      {pdfUrl ? (
        <object
          data={pdfUrl}
          type="application/pdf"
          className="flex-1 w-full border-0"
          style={{ height: "100%" }}
          aria-label="Product Catalogue PDF"
        >
          <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-500">
            <p className="text-sm">Your browser cannot display PDFs inline.</p>
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-primary underline"
            >
              Download Catalogue PDF
            </a>
          </div>
        </object>
      ) : (
        <div className="flex flex-col items-center justify-center flex-1 gap-2 text-gray-400">
          <p className="text-sm font-medium">Catalogue PDF not configured.</p>
          <p className="text-xs">
            Set{" "}
            <code className="bg-gray-100 px-1 rounded">
              NEXT_PUBLIC_CATALOGUE_PDF_URL
            </code>{" "}
            in your environment.
          </p>
        </div>
      )}
    </div>
  );
}
