import { adminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import type { Route } from "next";

const PAGE_SIZE = 50;

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

function ActionBadge({ action }: { action: "INSERT" | "UPDATE" | "DELETE" }) {
  const styles = {
    INSERT:
      "bg-emerald-50 text-emerald-700 border border-emerald-200",
    UPDATE:
      "bg-blue-50 text-blue-700 border border-blue-200",
    DELETE:
      "bg-red-50 text-red-700 border border-red-200",
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${styles[action]}`}
    >
      {action}
    </span>
  );
}

export default async function AdminAuditPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session?.isAdmin) redirect("/admin/login" as Route);

  const { page: pageStr } = await searchParams;
  const page = Math.max(1, parseInt(pageStr ?? "1", 10));

  const [{ data: logs, count }, { data: profiles }] = await Promise.all([
    adminClient
      .from("audit_log")
      .select("*", { count: "exact" })
      .order("changed_at", { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    adminClient
      .from("profiles")
      .select("id, contact_name, email")
      .eq("role", "admin"),
  ]);

  const totalCount = count ?? 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // Build a lookup map: profile id → display name
  const actorMap = new Map<string, { name: string; email: string | null }>();
  for (const p of profiles ?? []) {
    actorMap.set(p.id, { name: p.contact_name, email: p.email });
  }

  const buildPageUrl = (p: number) => `?page=${p}`;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
          Audit Log
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Immutable record of all data changes in the portal.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 w-full max-w-full overflow-x-auto shadow-sm">
        <table className="w-full min-w-[700px] text-left">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50">
              <th className="px-6 py-4 text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                Timestamp
              </th>
              <th className="px-6 py-4 text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                Admin User
              </th>
              <th className="px-6 py-4 text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                Action
              </th>
              <th className="px-6 py-4 text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                Record Type
              </th>
              <th className="px-6 py-4 text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                Record ID
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {(logs ?? []).length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-6 py-16 text-center text-sm text-slate-400"
                >
                  No audit entries yet.
                </td>
              </tr>
            ) : (
              (logs ?? []).map((entry) => {
                const actor = entry.actor_id
                  ? actorMap.get(entry.actor_id)
                  : null;
                const ts = new Date(entry.changed_at);

                return (
                  <tr
                    key={entry.id}
                    className="hover:bg-slate-50/50 transition-colors"
                  >
                    {/* Timestamp */}
                    <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap">
                      <span className="font-mono text-slate-900">
                        {ts.toLocaleDateString("en-ZA", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                      <span className="block text-[11px] text-slate-400">
                        {ts.toLocaleTimeString("en-ZA", {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </span>
                    </td>

                    {/* Admin User */}
                    <td className="px-6 py-4 text-sm text-slate-700">
                      {actor ? (
                        <>
                          <span className="font-medium">{actor.name}</span>
                          {actor.email && (
                            <span className="block text-[11px] text-slate-400">
                              {actor.email}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-slate-400 font-mono text-xs">
                          {entry.actor_id ?? "system"}
                        </span>
                      )}
                    </td>

                    {/* Action badge */}
                    <td className="px-6 py-4">
                      <ActionBadge action={entry.action} />
                    </td>

                    {/* Table / Record Type */}
                    <td className="px-6 py-4 text-sm font-mono text-slate-600">
                      {entry.table_name}
                    </td>

                    {/* Record ID */}
                    <td className="px-6 py-4 text-[11px] font-mono text-slate-400 max-w-[200px] truncate">
                      {entry.record_id ?? "—"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-50 flex items-center justify-between bg-slate-50/30">
            <p className="text-xs text-slate-400 font-medium">
              Showing{" "}
              {Math.min((page - 1) * PAGE_SIZE + 1, totalCount)}–
              {Math.min(page * PAGE_SIZE, totalCount)} of {totalCount} entries
            </p>
            <div className="flex items-center gap-2">
              {page > 1 && (
                <a
                  href={buildPageUrl(page - 1)}
                  className="h-8 px-3 text-xs font-medium text-slate-600 hover:bg-white rounded-md border border-slate-200 transition-colors flex items-center"
                >
                  Previous
                </a>
              )}
              {page < totalPages && (
                <a
                  href={buildPageUrl(page + 1)}
                  className="h-8 px-3 text-xs font-medium text-slate-600 hover:bg-white rounded-md border border-slate-200 transition-colors flex items-center"
                >
                  Next
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
