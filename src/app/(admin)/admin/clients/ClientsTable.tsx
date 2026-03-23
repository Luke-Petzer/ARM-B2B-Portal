"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import ClientDrawer, {
  type ClientForDrawer,
} from "@/components/admin/ClientDrawer";

export interface UnpaidOrder {
  id: string;
  reference_number: string;
  created_at: string;
  total_amount: number;
}

interface ClientsTableProps {
  clients: ClientForDrawer[];
  unpaidOrdersByClientId: Record<string, UnpaidOrder[]>;
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
  unpaidOrdersByClientId,
}: ClientsTableProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editClient, setEditClient] = useState<ClientForDrawer | null>(null);

  const filteredClients = searchTerm.trim()
    ? clients.filter((c) => {
        const q = searchTerm.toLowerCase();
        return (
          c.business_name.toLowerCase().includes(q) ||
          (c.account_number ?? "").toLowerCase().includes(q) ||
          c.contact_name.toLowerCase().includes(q) ||
          (c.email ?? "").toLowerCase().includes(q)
        );
      })
    : clients;

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
  };

  return (
    <>
      {/* Action bar */}
      <div className="flex flex-wrap items-center justify-between mb-6 gap-4">
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, account no., contact…"
            className="h-9 w-full pl-9 pr-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <p className="text-sm text-slate-400 hidden md:block">
            {filteredClients.length}
            {searchTerm.trim() ? ` of ${clients.length}` : ""} client
            {filteredClients.length !== 1 ? "s" : ""}
          </p>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="h-10 px-5 bg-slate-900 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors shadow-sm w-full md:w-auto"
          >
            <Plus className="w-4 h-4" />
            Add Client
          </button>
        </div>
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
            {filteredClients.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-6 py-16 text-center text-sm text-slate-400"
                >
                  {searchTerm.trim()
                    ? `No clients found for "${searchTerm}".`
                    : "No clients yet. Click \"Add Client\" to get started."}
                </td>
              </tr>
            ) : (
              filteredClients.map((client) => (
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
                  <td className="px-6 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(client)}
                      className="h-8 px-3 text-xs font-medium border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ClientDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSaved={handleSaved}
        client={editClient}
        unpaidOrders={editClient ? (unpaidOrdersByClientId[editClient.id] ?? []) : []}
      />
    </>
  );
}
