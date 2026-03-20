"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, MoreHorizontal, ChevronRight } from "lucide-react";
import ClientDrawer, {
  type ClientForDrawer,
} from "@/components/admin/ClientDrawer";

interface ClientsTableProps {
  clients: ClientForDrawer[];
  totalCount: number;
  page: number;
  pageSize: number;
  search: string;
}

function RoleBadge({ role }: { role: "buyer_default" | "buyer_30_day" }) {
  if (role === "buyer_30_day") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
        30-Day
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
      Default
    </span>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  if (active) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
        Active
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
      Inactive
    </span>
  );
}

export default function ClientsTable({
  clients,
  totalCount,
  page,
  pageSize,
  search,
}: ClientsTableProps) {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editClient, setEditClient] = useState<ClientForDrawer | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const totalPages = Math.ceil(totalCount / pageSize);

  const handleSaved = () => {
    router.refresh();
  };

  const handleOpenCreate = () => {
    setEditClient(null);
    setDrawerOpen(true);
  };

  const handleOpenEdit = (client: ClientForDrawer) => {
    setEditClient(client);
    setDrawerOpen(true);
    setOpenMenuId(null);
  };

  const buildPageUrl = (p: number) => {
    const params = new URLSearchParams();
    params.set("page", String(p));
    if (search) params.set("search", search);
    return `?${params.toString()}`;
  };

  return (
    <>
      {/* Action bar */}
      <div className="flex flex-wrap items-center justify-between mb-6 gap-4">
        <form method="GET" className="flex flex-wrap items-center gap-4">
          <input
            type="text"
            name="search"
            defaultValue={search}
            placeholder="Search by name, account no., contact…"
            className="h-9 w-full md:w-72 px-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all"
          />
          <button
            type="submit"
            className="h-9 px-4 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors"
          >
            Search
          </button>
          {search && (
            <a
              href="/admin/clients"
              className="h-9 px-4 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors flex items-center"
            >
              Clear
            </a>
          )}
        </form>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="h-10 px-5 bg-slate-900 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors shadow-sm w-full md:w-auto"
        >
          <Plus className="w-4 h-4" />
          Add Client
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm w-full max-w-full overflow-x-auto">
        <table className="w-full min-w-[800px] text-left">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="px-6 py-4 text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                Account No.
              </th>
              <th className="px-6 py-4 text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                Business Name
              </th>
              <th className="px-6 py-4 text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                Contact Person
              </th>
              <th className="px-6 py-4 text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                Role
              </th>
              <th className="px-6 py-4 text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-4 text-right" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {clients.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-6 py-16 text-center text-sm text-slate-400"
                >
                  {search
                    ? "No clients match your search."
                    : "No clients yet. Click \"Add Client\" to get started."}
                </td>
              </tr>
            ) : (
              clients.map((client) => (
                <tr
                  key={client.id}
                  className="hover:bg-slate-50/50 transition-colors"
                >
                  <td className="px-6 py-4 text-sm font-mono text-slate-900">
                    {client.account_number ?? "—"}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-900">
                    {client.business_name}
                    {client.trading_name && (
                      <span className="block text-[11px] text-slate-400 font-normal">
                        t/a {client.trading_name}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {client.contact_name}
                    {client.email && (
                      <span className="block text-[11px] text-slate-400">
                        {client.email}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <RoleBadge role={client.role} />
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge active={client.is_active} />
                  </td>
                  <td className="px-6 py-4 text-right relative">
                    <button
                      type="button"
                      onClick={() =>
                        setOpenMenuId(
                          openMenuId === client.id ? null : client.id
                        )
                      }
                      className="text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      <MoreHorizontal className="w-5 h-5" />
                    </button>
                    {openMenuId === client.id && (
                      <div className="absolute right-6 top-full mt-1 w-32 bg-white rounded-lg border border-slate-200 shadow-lg z-10 py-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(client)}
                          className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2"
                        >
                          <ChevronRight className="w-3 h-3" />
                          Edit
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-50 flex items-center justify-between bg-slate-50/30">
            <p className="text-xs text-slate-400 font-medium">
              Showing{" "}
              {Math.min((page - 1) * pageSize + 1, totalCount)}–
              {Math.min(page * pageSize, totalCount)} of {totalCount} clients
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

      <ClientDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSaved={handleSaved}
        client={editClient}
      />
    </>
  );
}
