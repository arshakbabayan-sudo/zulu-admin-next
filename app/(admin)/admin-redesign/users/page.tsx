"use client";

/**
 * Users — v2 admin-redesign page (2026-05-24).
 * Mockup: docs/zulu-admin-v2.html page-view#users (lines 751-794).
 *
 * Layout:
 *   PageHeader (breadcrumb + title + actions)
 *   4 stat cards (Total / Active today / New (7d) / Pending verification)
 *   FilterCard (Search + Type select + Search button)
 *   Card → Table (checkbox + ID + Name+avatar + Email + Status + Companies + Actions)
 *
 * Data wiring is Phase Ե follow-up — for now uses static demo rows so the
 * layout/spacing/component composition can be validated end-to-end against
 * the mockup. Real /api/admin/users wiring will replace the demoRows array.
 */

import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentTitle } from "@/lib/use-document-title";
import {
  PageHeader,
  StatCard,
  StatGrid,
  FilterCard,
  FilterField,
  V2Card,
  V2Button,
  IconButton,
} from "@/components/ui/v2";

type DemoUser = {
  id: string;
  initials: string;
  initialsTone: "purple" | "teal" | "amber" | "blue";
  name: string;
  email: string;
  status: "active" | "pending" | "suspended";
  companies: { label: string; tone: "primary" | "gray" }[];
};

const DEMO_ROWS: DemoUser[] = [
  {
    id: "#10284",
    initials: "AM",
    initialsTone: "purple",
    name: "Արշակ Մարտիրոսյան",
    email: "arshak@zulu.am",
    status: "active",
    companies: [
      { label: "ZULU Platform", tone: "primary" },
      { label: "Admin", tone: "gray" },
    ],
  },
  {
    id: "#10283",
    initials: "NK",
    initialsTone: "teal",
    name: "Նարե Կարապետյան",
    email: "nare@zulu.am",
    status: "active",
    companies: [
      { label: "ZULU Platform", tone: "primary" },
      { label: "Finance", tone: "gray" },
    ],
  },
  {
    id: "#10282",
    initials: "DH",
    initialsTone: "amber",
    name: "Դավիթ Հակոբյան",
    email: "davit@zulu.am",
    status: "pending",
    companies: [{ label: "Customer", tone: "gray" }],
  },
  {
    id: "#10281",
    initials: "LP",
    initialsTone: "blue",
    name: "Լուսինե Պետրոսյան",
    email: "lusine@zulu.am",
    status: "active",
    companies: [
      { label: "Acme Travels", tone: "primary" },
      { label: "Agent", tone: "gray" },
    ],
  },
  {
    id: "#10280",
    initials: "SG",
    initialsTone: "purple",
    name: "Սերգեյ Գրիգորյան",
    email: "sergey@zulu.am",
    status: "suspended",
    companies: [{ label: "Customer", tone: "gray" }],
  },
];

const STATUS_LABEL: Record<DemoUser["status"], { label: string; color: string }> = {
  active: { label: "Active", color: "var(--admin-success)" },
  pending: { label: "Pending", color: "var(--admin-warning)" },
  suspended: { label: "Suspended", color: "var(--admin-danger)" },
};

function tx(t: (k: string) => string, key: string, fallback: string): string {
  const r = t(key);
  return r === key ? fallback : r;
}

export default function AdminRedesignUsersPage() {
  const { t } = useLanguage();
  useDocumentTitle("Users — ZULU Admin");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const allSelected = selectedIds.size === DEMO_ROWS.length;
  const toggleAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(DEMO_ROWS.map((r) => r.id)));
  };
  const toggleRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[
          { label: "Home", href: "/dashboard" },
          { label: tx(t, "admin.nav.section.users_v2", "Users") },
        ]}
        title={tx(t, "admin.nav.section.users_v2", "Users")}
        subtitle={tx(t, "admin.users.subtitle", "Manage platform users across all roles")}
        actions={
          <>
            <V2Button
              icon={<DownloadIcon />}
            >
              {tx(t, "admin.dashboard.export", "Export")}
            </V2Button>
            <V2Button variant="primary" icon={<PlusIcon />}>
              {tx(t, "admin.users.add", "Add user")}
            </V2Button>
          </>
        }
      />

      <StatGrid cols={4} className="mb-4">
        <StatCard
          value="1,284"
          label={tx(t, "admin.users.stat.total", "Total users")}
        />
        <StatCard
          value={<span style={{ color: "var(--admin-success)" }}>892</span>}
          label={tx(t, "admin.users.stat.active_today", "Active today")}
        />
        <StatCard
          value="+47"
          label={tx(t, "admin.users.stat.new_7d", "New (7d)")}
        />
        <StatCard
          value={<span style={{ color: "var(--admin-warning)" }}>12</span>}
          label={tx(t, "admin.users.stat.pending", "Pending verification")}
        />
      </StatGrid>

      <FilterCard>
        <FilterField label={tx(t, "common.search", "Search")} minWidth={240}>
          <input
            type="search"
            placeholder={tx(t, "admin.users.search_placeholder", "Name, email, ID...")}
            className="h-[34px] rounded-md border bg-white px-3 text-[12px] outline-none transition focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
            style={{ borderColor: "var(--admin-border)" }}
          />
        </FilterField>
        <FilterField label={tx(t, "admin.users.type", "Type")}>
          <select
            className="h-[34px] rounded-md border bg-white px-3 text-[12px] outline-none transition focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
            style={{ borderColor: "var(--admin-border)" }}
          >
            <option>{tx(t, "common.all", "All")}</option>
            <option>{tx(t, "admin.users.type_customer", "Customers")}</option>
            <option>{tx(t, "admin.users.type_staff", "Staff")}</option>
            <option>{tx(t, "admin.users.type_unverified", "Unverified")}</option>
          </select>
        </FilterField>
        <V2Button variant="primary" size="sm">
          {tx(t, "common.search", "Search")}
        </V2Button>
      </FilterCard>

      <V2Card>
        <table className="w-full border-collapse text-[13px]">
          <thead style={{ backgroundColor: "var(--admin-bg-secondary)" }}>
            <tr>
              <th className="px-4 py-2.5 text-left" style={{ width: 32 }}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Select all"
                />
              </th>
              {[
                { label: "ID", key: "id" },
                { label: "Name", key: "name" },
                { label: "Email", key: "email" },
                { label: "Status", key: "status" },
                { label: "Companies", key: "companies" },
              ].map((col) => (
                <th
                  key={col.key}
                  className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.5px]"
                  style={{ color: "var(--admin-text-secondary)" }}
                >
                  {col.label}
                </th>
              ))}
              <th
                className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-[0.5px]"
                style={{ color: "var(--admin-text-secondary)" }}
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {DEMO_ROWS.map((u) => {
              const statusInfo = STATUS_LABEL[u.status];
              return (
                <tr
                  key={u.id}
                  className="border-t transition hover:bg-[color:var(--admin-bg-secondary)]"
                  style={{ borderColor: "var(--admin-border)" }}
                >
                  <td className="px-4 py-3 align-middle">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(u.id)}
                      onChange={() => toggleRow(u.id)}
                      aria-label={`Select ${u.name}`}
                    />
                  </td>
                  <td
                    className="px-4 py-3 align-middle font-mono text-[12px]"
                    style={{ color: "var(--admin-text-secondary)" }}
                  >
                    {u.id}
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <div className="flex items-center gap-3">
                      <Avatar initials={u.initials} tone={u.initialsTone} />
                      <span className="font-medium">{u.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 align-middle">{u.email}</td>
                  <td className="px-4 py-3 align-middle">
                    <span className="inline-flex items-center gap-1.5 text-[12px]">
                      <span
                        aria-hidden
                        className="inline-block h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: statusInfo.color }}
                      />
                      {statusInfo.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <div className="flex flex-wrap items-center gap-1">
                      {u.companies.map((c, idx) => (
                        <span
                          key={`${u.id}-co-${idx}`}
                          className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.3px]"
                          style={{
                            backgroundColor:
                              c.tone === "primary"
                                ? "var(--admin-primary-light)"
                                : "var(--admin-bg-tertiary)",
                            color:
                              c.tone === "primary"
                                ? "var(--admin-primary-dark)"
                                : "var(--admin-text-secondary)",
                          }}
                        >
                          {c.label}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <div className="flex justify-end gap-1">
                      <IconButton aria-label="Edit">
                        <PencilIcon />
                      </IconButton>
                      <IconButton aria-label="More actions">
                        <DotsVerticalIcon />
                      </IconButton>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </V2Card>

      <p className="mt-3 text-[12px]" style={{ color: "var(--admin-text-secondary)" }}>
        🚧 <strong>Placeholder data</strong> — այս էջը ցույց է տալիս v2 layout-ը demo
        տողերով։ Իրական /api/admin/users-ի wiring-ը կատարվում է Փուլ Ե-ում
        (project_admin_redesign_v2.md)։
      </p>
    </div>
  );
}

function Avatar({
  initials,
  tone,
}: {
  initials: string;
  tone: "purple" | "teal" | "amber" | "blue";
}) {
  const styles: Record<string, React.CSSProperties> = {
    purple: { backgroundColor: "var(--admin-primary-light)", color: "var(--admin-primary-dark)" },
    teal: { backgroundColor: "var(--admin-success-light)", color: "var(--admin-success-dark)" },
    amber: { backgroundColor: "var(--admin-warning-light)", color: "var(--admin-warning-dark)" },
    blue: { backgroundColor: "var(--admin-info-light)", color: "var(--admin-info-dark)" },
  };
  return (
    <span
      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-semibold"
      style={styles[tone]}
    >
      {initials}
    </span>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  );
}

function DotsVerticalIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
      <circle cx="12" cy="5" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="12" cy="19" r="1.5" />
    </svg>
  );
}
