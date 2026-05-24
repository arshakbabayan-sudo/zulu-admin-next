"use client";

/**
 * File manager — v2 admin-redesign page (2026-05-24).
 * Mockup: docs/zulu-admin-v2.html page-view#files (lines 863-933).
 *
 * Layout:
 *   PageHeader (breadcrumb, title, subtitle, New folder + Upload actions)
 *   2-col grid (240px sidebar + 1fr main)
 *     Left  — Quick access (All files / Recent / Starred / Shared / Trash) +
 *             Tags (Important / Contracts / Invoices) + Storage card
 *     Right — Breadcrumb chip + Search + view toggle, Folders grid (3 cols),
 *             Files table (Name + Owner + Size + Modified + Actions)
 *
 * Data is static demo; Phase Ե wires real file storage API.
 */

import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentTitle } from "@/lib/use-document-title";
import { PageHeader, V2Card, V2Button, IconButton } from "@/components/ui/v2";

type FolderDemo = { name: string; files: number; sizeLabel: string };

const FOLDERS: FolderDemo[] = [
  { name: "Contracts", files: 24, sizeLabel: "156 MB" },
  { name: "Invoices 2026", files: 58, sizeLabel: "412 MB" },
  { name: "Hotel photos", files: 142, sizeLabel: "2.1 GB" },
];

type FileDemo = {
  name: string;
  type: "pdf" | "xls" | "img" | "doc";
  owner: { initials: string; tone: "purple" | "teal" | "amber" | "blue"; firstName: string };
  size: string;
  modified: string;
};

const FILES: FileDemo[] = [
  { name: "contract-marriott.pdf", type: "pdf", owner: { initials: "AM", tone: "purple", firstName: "Արշակ" }, size: "2.4 MB", modified: "May 20, 2026" },
  { name: "commissions-q2.xlsx", type: "xls", owner: { initials: "DH", tone: "amber", firstName: "Դավիթ" }, size: "486 KB", modified: "May 18, 2026" },
  { name: "athens-hotel-main.jpg", type: "img", owner: { initials: "NK", tone: "teal", firstName: "Նարե" }, size: "2.1 MB", modified: "May 15, 2026" },
  { name: "partnership-proposal.docx", type: "doc", owner: { initials: "AM", tone: "purple", firstName: "Արշակ" }, size: "94 KB", modified: "May 12, 2026" },
];

const QUICK_ACCESS = [
  { key: "all", label: "All files", count: 328, icon: "files", active: true },
  { key: "recent", label: "Recent", count: 12, icon: "clock" },
  { key: "starred", label: "Starred", count: 8, icon: "star" },
  { key: "shared", label: "Shared", count: 24, icon: "users" },
  { key: "trash", label: "Trash", icon: "trash" },
] as const;

const TAGS = [
  { color: "var(--admin-primary)", label: "Important" },
  { color: "var(--admin-success)", label: "Contracts" },
  { color: "var(--admin-warning)", label: "Invoices" },
];

function tx(t: (k: string) => string, key: string, fallback: string): string {
  const r = t(key);
  return r === key ? fallback : r;
}

export default function AdminRedesignFilesPage() {
  const { t } = useLanguage();
  useDocumentTitle("File manager — ZULU Admin");

  return (
    <div>
      <PageHeader
        breadcrumb={[
          { label: "Home", href: "/dashboard" },
          { label: tx(t, "admin.nav.section.file_manager", "File manager") },
        ]}
        title={tx(t, "admin.nav.section.file_manager", "File manager")}
        subtitle={tx(t, "admin.files.subtitle", "Manage all platform files and folders")}
        actions={
          <>
            <V2Button icon={<FolderPlusIcon />}>
              {tx(t, "admin.files.new_folder", "New folder")}
            </V2Button>
            <V2Button variant="primary" icon={<UploadIcon />}>
              {tx(t, "admin.files.upload", "Upload files")}
            </V2Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[240px_1fr]">
        {/* Left sidebar */}
        <aside className="space-y-4">
          <V2Card className="p-3.5">
            <div className="px-3 pb-1.5 pt-1.5 text-[10px] font-semibold uppercase tracking-[0.5px]" style={{ color: "var(--admin-text-tertiary)" }}>
              Quick access
            </div>
            {QUICK_ACCESS.map((item) => (
              <button
                key={item.key}
                className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13px] transition"
                style={{
                  backgroundColor: "active" in item && item.active ? "var(--admin-primary-light)" : "transparent",
                  color: "active" in item && item.active ? "var(--admin-primary-dark)" : "var(--admin-text-secondary)",
                  fontWeight: "active" in item && item.active ? 500 : 400,
                }}
              >
                <QuickIcon name={item.icon} />
                <span className="flex-1">{item.label}</span>
                {"count" in item && item.count !== undefined ? (
                  <span className="text-[11px] opacity-60">{item.count}</span>
                ) : null}
              </button>
            ))}

            <div className="mt-4 border-t pt-3.5" style={{ borderColor: "var(--admin-border)" }}>
              <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.5px]" style={{ color: "var(--admin-text-tertiary)" }}>
                Tags
              </div>
              {TAGS.map((tag) => (
                <div
                  key={tag.label}
                  className="flex items-center gap-2.5 px-3 py-2 text-[13px]"
                  style={{ color: "var(--admin-text-secondary)" }}
                >
                  <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: tag.color }} />
                  {tag.label}
                </div>
              ))}
            </div>
          </V2Card>

          {/* Storage card */}
          <V2Card className="p-3.5" >
            <div className="text-[12px] font-medium">Storage</div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: "var(--admin-bg-tertiary)" }}>
              <div className="h-full rounded-full" style={{ width: "68%", backgroundColor: "var(--admin-primary)" }} />
            </div>
            <div className="mt-2 text-[11px]" style={{ color: "var(--admin-text-secondary)" }}>
              6.8 GB of 10 GB used
            </div>
            <V2Button variant="primary" size="xs" className="mt-3 w-full">
              Upgrade
            </V2Button>
          </V2Card>
        </aside>

        {/* Main */}
        <div>
          {/* Breadcrumb chip + search + view toggle */}
          <V2Card className="mb-4">
            <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5">
              <div className="flex items-center gap-1.5 text-[12px]" style={{ color: "var(--admin-text-secondary)" }}>
                <FolderIcon />
                <a href="#" className="hover:text-[color:var(--admin-primary)]">My files</a>
                <ChevronRightSmall />
                <span className="font-medium" style={{ color: "var(--admin-text-primary)" }}>Documents</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <SearchSmall />
                  <input
                    type="search"
                    placeholder="Search files..."
                    className="h-[30px] w-[200px] rounded-md border bg-white pl-9 pr-3 text-[12px] outline-none"
                    style={{ borderColor: "var(--admin-border)" }}
                  />
                </div>
                <V2Button size="sm" aria-label="Grid view">
                  <GridIcon />
                </V2Button>
                <V2Button size="sm" className="!bg-[color:var(--admin-primary-light)]" aria-label="List view">
                  <ListIcon />
                </V2Button>
              </div>
            </div>
          </V2Card>

          {/* Folders */}
          <div className="mb-4">
            <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.5px]" style={{ color: "var(--admin-text-secondary)" }}>
              Folders ({FOLDERS.length})
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FOLDERS.map((f) => (
                <V2Card key={f.name} className="cursor-pointer p-4">
                  <FolderLargeIcon />
                  <div className="mt-3 font-medium">{f.name}</div>
                  <div className="text-[11px]" style={{ color: "var(--admin-text-secondary)" }}>
                    {f.files} files · {f.sizeLabel}
                  </div>
                </V2Card>
              ))}
            </div>
          </div>

          {/* Files */}
          <V2Card>
            <div
              className="border-b px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.5px]"
              style={{ borderColor: "var(--admin-border)", color: "var(--admin-text-secondary)" }}
            >
              Files ({FILES.length})
            </div>
            <table className="w-full border-collapse text-[13px]">
              <thead style={{ backgroundColor: "var(--admin-bg-secondary)" }}>
                <tr>
                  <th className="px-4 py-2.5 text-left" style={{ width: 32 }}>
                    <input type="checkbox" aria-label="Select all" />
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.5px]" style={{ color: "var(--admin-text-secondary)" }}>Name</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.5px]" style={{ color: "var(--admin-text-secondary)" }}>Owner</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.5px]" style={{ color: "var(--admin-text-secondary)" }}>Size</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.5px]" style={{ color: "var(--admin-text-secondary)" }}>Modified</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {FILES.map((file) => (
                  <tr
                    key={file.name}
                    className="border-t transition hover:bg-[color:var(--admin-bg-secondary)]"
                    style={{ borderColor: "var(--admin-border)" }}
                  >
                    <td className="px-4 py-3 align-middle">
                      <input type="checkbox" aria-label={`Select ${file.name}`} />
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <div className="flex items-center gap-3">
                        <FileTypeIcon type={file.type} />
                        <span className="font-medium">{file.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold"
                          style={ownerStyle(file.owner.tone)}
                        >
                          {file.owner.initials}
                        </span>
                        <span className="text-[12px]">{file.owner.firstName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-middle" style={{ color: "var(--admin-text-secondary)" }}>
                      {file.size}
                    </td>
                    <td className="px-4 py-3 align-middle" style={{ color: "var(--admin-text-secondary)" }}>
                      {file.modified}
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <div className="flex justify-end gap-1">
                        <IconButton aria-label="Download"><DownloadSmall /></IconButton>
                        <IconButton aria-label="Share"><ShareIcon /></IconButton>
                        <IconButton aria-label="More"><DotsVerticalIcon /></IconButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </V2Card>

          <p className="mt-3 text-[12px]" style={{ color: "var(--admin-text-secondary)" }}>
            🚧 <strong>Placeholder data</strong> — file storage backend Փուլ Ե-ում։
          </p>
        </div>
      </div>
    </div>
  );
}

function ownerStyle(tone: "purple" | "teal" | "amber" | "blue"): React.CSSProperties {
  const map: Record<"purple" | "teal" | "amber" | "blue", React.CSSProperties> = {
    purple: { backgroundColor: "var(--admin-primary-light)", color: "var(--admin-primary-dark)" },
    teal: { backgroundColor: "var(--admin-success-light)", color: "var(--admin-success-dark)" },
    amber: { backgroundColor: "var(--admin-warning-light)", color: "var(--admin-warning-dark)" },
    blue: { backgroundColor: "var(--admin-info-light)", color: "var(--admin-info-dark)" },
  };
  return map[tone];
}

/* ─── icons ────────────────────────────────────────────────────────────── */

function QuickIcon({ name }: { name: string }) {
  const stroke = "1.8";
  switch (name) {
    case "files":
      return (
        <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      );
    case "clock":
      return (
        <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx={12} cy={12} r={10} />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      );
    case "star":
      return (
        <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      );
    case "users":
      return (
        <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx={9} cy={7} r={4} />
        </svg>
      );
    case "trash":
      return (
        <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
      );
    default:
      return null;
  }
}
function FolderIcon() {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  );
}
function FolderLargeIcon() {
  return (
    <svg viewBox="0 0 24 24" width={28} height={28} fill="currentColor" style={{ color: "var(--admin-warning)" }} aria-hidden>
      <path d="M10 4H4c-1.11 0-2 .89-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8z" />
    </svg>
  );
}
function ChevronRightSmall() {
  return (
    <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
function SearchSmall() {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--admin-text-tertiary)" }} aria-hidden>
      <circle cx={11} cy={11} r={7} />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}
function GridIcon() {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x={3} y={3} width={7} height={7} />
      <rect x={14} y={3} width={7} height={7} />
      <rect x={3} y={14} width={7} height={7} />
      <rect x={14} y={14} width={7} height={7} />
    </svg>
  );
}
function ListIcon() {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1={8} y1={6} x2={21} y2={6} />
      <line x1={8} y1={12} x2={21} y2={12} />
      <line x1={8} y1={18} x2={21} y2={18} />
      <line x1={3} y1={6} x2={3.01} y2={6} />
      <line x1={3} y1={12} x2={3.01} y2={12} />
      <line x1={3} y1={18} x2={3.01} y2={18} />
    </svg>
  );
}
function FileTypeIcon({ type }: { type: "pdf" | "xls" | "img" | "doc" }) {
  const color =
    type === "pdf" ? "var(--admin-danger)" :
    type === "xls" ? "var(--admin-success)" :
    type === "img" ? "var(--admin-info)" :
    "var(--admin-primary)";
  return (
    <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}
function FolderPlusIcon() {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      <line x1={12} y1={11} x2={12} y2={17} />
      <line x1={9} y1={14} x2={15} y2={14} />
    </svg>
  );
}
function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1={12} y1={3} x2={12} y2={15} />
    </svg>
  );
}
function DownloadSmall() {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1={12} y1={15} x2={12} y2={3} />
    </svg>
  );
}
function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx={18} cy={5} r={3} />
      <circle cx={6} cy={12} r={3} />
      <circle cx={18} cy={19} r={3} />
      <line x1={8.59} y1={13.51} x2={15.42} y2={17.49} />
      <line x1={15.41} y1={6.51} x2={8.59} y2={10.49} />
    </svg>
  );
}
function DotsVerticalIcon() {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} fill="currentColor" aria-hidden>
      <circle cx={12} cy={5} r={1.5} />
      <circle cx={12} cy={12} r={1.5} />
      <circle cx={12} cy={19} r={1.5} />
    </svg>
  );
}
