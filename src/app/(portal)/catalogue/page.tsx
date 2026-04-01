import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";

const PDF_PATH = "/catalogue.pdf#toolbar=0&navpanes=0&scrollbar=0";

export default async function CataloguePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="flex-1 overflow-hidden flex flex-col bg-white">
      <iframe
        src={PDF_PATH}
        className="flex-1 w-full border-0"
        style={{ height: "100%" }}
        title="AR Steel Product Catalogue"
      />
    </div>
  );
}
