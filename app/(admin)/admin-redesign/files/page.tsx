"use client";

/**
 * File manager — v2 admin-redesign page (2026-05-25, Phase Ե wired).
 *
 * Replaces the mockup (FOLDERS / FILES hardcoded arrays) with real /api/files
 * calls. Storage is Laravel's default disk (FILESYSTEM_DISK; default `local`);
 * S3 migration later = just an env var swap.
 *
 * Layout:
 *   PageHeader (breadcrumb + New folder + Upload actions)
 *   2-col grid (240px sidebar + 1fr main)
 *     Left  — Quick access (My files / Recent / Trash) + Storage card
 *     Right — Folder breadcrumb chip + Search, Folders grid, Files table
 *
 * Click a folder → enter it. Click a file → download. Hover row → Delete.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentTitle } from "@/lib/use-document-title";
import { ApiRequestError } from "@/lib/api-client";
import {
  apiFilesList,
  apiFilesUpload,
  apiFilesDownload,
  apiFilesCreateFolder,
  apiFilesDelete,
  apiFilesStorageStats,
  formatBytes,
  mimeBucket,
  mimeLabel,
  type FileAssetRow,
  type FolderSummary,
  type StorageStats,
  type FileVisibility,
} from "@/lib/file-assets-api";
import { PageHeader, V2Card, V2Button, IconButton } from "@/components/ui/v2";

function tx(t: (k: string) => string, key: string, fallback: string): string {
  const r = t(key);
  return r === key ? fallback : r;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function ownerInitials(uploadedBy: number, selfId: number | undefined): string {
  if (selfId && uploadedBy === selfId) return "You";
  return `#${uploadedBy}`;
}

type QuickKey = "all" | "recent" | "trash";

export default function AdminRedesignFilesPage() {
  const { t } = useLanguage();
  const { token, user } = useAdminAuth();
  useDocumentTitle("File manager — ZULU Admin");

  const [folder, setFolder] = useState<string>("/");
  const [files, setFiles] = useState<FileAssetRow[]>([]);
  const [subfolders, setSubfolders] = useState<FolderSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [err, setErr] = useState<string | null>(null);
  const [search, setSearch] = useState<string>("");
  const [quick, setQuick] = useState<QuickKey>("all");
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadFolder = useCallback(
    async (target: string) => {
      if (!token) return;
      setLoading(true);
      setErr(null);
      try {
        const res = await apiFilesList(token, { folder: target });
        setFiles(res.data.files);
        setSubfolders(res.data.subfolders);
      } catch (e) {
        setErr(
          e instanceof ApiRequestError
            ? e.message
            : tx(t, "admin.files.err_list", "Failed to load files")
        );
        setFiles([]);
        setSubfolders([]);
      } finally {
        setLoading(false);
      }
    },
    [token, t]
  );

  const loadStats = useCallback(async () => {
    if (!token) return;
    try {
      const res = await apiFilesStorageStats(token);
      setStats(res.data);
    } catch {
      // non-fatal
    }
  }, [token]);

  useEffect(() => {
    void loadFolder(folder);
  }, [folder, loadFolder]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  // Derived list — handles search + quick-access filter.
  const visibleFiles = useMemo(() => {
    let arr = files;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      arr = arr.filter((f) => f.filename.toLowerCase().includes(q));
    }
    if (quick === "recent") {
      arr = [...arr]
        .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
        .slice(0, 20);
    }
    return arr;
  }, [files, search, quick]);

  const handleUpload = async (selected: FileList | null) => {
    if (!selected || selected.length === 0 || !token) return;
    setUploading(true);
    setErr(null);
    setActionMsg(null);
    try {
      let count = 0;
      for (const file of Array.from(selected)) {
        await apiFilesUpload(token, file, {
          folder,
          visibility: "private" as FileVisibility,
        });
        count++;
      }
      setActionMsg(
        count === 1
          ? tx(t, "admin.files.upload_done", "File uploaded")
          : `${count} ${tx(t, "admin.files.upload_done_n", "files uploaded")}`
      );
      window.setTimeout(() => setActionMsg(null), 3000);
      await loadFolder(folder);
      await loadStats();
    } catch (e) {
      setErr(
        e instanceof ApiRequestError
          ? e.message
          : tx(t, "admin.files.err_upload", "Upload failed")
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleNewFolder = async () => {
    if (!token) return;
    const name = window.prompt(tx(t, "admin.files.new_folder_prompt", "Folder name"));
    if (!name) return;
    const safe = name.trim().replace(/[/\\]/g, "_").replace(/^\.+/, "");
    if (!safe) return;
    const target = folder === "/" ? `/${safe}` : `${folder}/${safe}`;
    setErr(null);
    try {
      await apiFilesCreateFolder(token, target, { visibility: "private" });
      setActionMsg(tx(t, "admin.files.folder_created", "Folder created"));
      window.setTimeout(() => setActionMsg(null), 3000);
      await loadFolder(folder);
    } catch (e) {
      setErr(
        e instanceof ApiRequestError
          ? e.message
          : tx(t, "admin.files.err_folder", "Could not create folder")
      );
    }
  };

  const handleDownload = async (asset: FileAssetRow) => {
    if (!token) return;
    try {
      await apiFilesDownload(token, asset);
    } catch (e) {
      setErr(
        e instanceof ApiRequestError
          ? e.message
          : tx(t, "admin.files.err_download", "Download failed")
      );
    }
  };

  const handleDelete = async (asset: FileAssetRow) => {
    if (!token) return;
    const ok = window.confirm(
      `${tx(t, "admin.files.delete_confirm", "Delete this file?")}\n\n${asset.filename}`
    );
    if (!ok) return;
    try {
      await apiFilesDelete(token, asset.id);
      setActionMsg(tx(t, "admin.files.deleted", "File deleted"));
      window.setTimeout(() => setActionMsg(null), 3000);
      await loadFolder(folder);
      await loadStats();
    } catch (e) {
      setErr(
        e instanceof ApiRequestError
          ? e.message
          : tx(t, "admin.files.err_delete", "Could not delete")
      );
    }
  };

  // Breadcrumb chip — split current folder into clickable segments.
  const folderCrumbs = useMemo(() => {
    if (folder === "/") return [{ label: "My files", path: "/" }];
    const segs = folder.split("/").filter(Boolean);
    return [
      { label: "My files", path: "/" },
      ...segs.map((s, i) => ({ label: s, path: "/" + segs.slice(0, i + 1).join("/") })),
    ];
  }, [folder]);

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
            <V2Button icon={<FolderPlusIcon />} onClick={() => void handleNewFolder()}>
              {tx(t, "admin.files.new_folder", "New folder")}
            </V2Button>
            <V2Button
              variant="primary"
              icon={<UploadIcon />}
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading
                ? tx(t, "admin.files.uploading", "Uploading…")
                : tx(t, "admin.files.upload", "Upload files")}
            </V2Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              hidden
              onChange={(e) => void handleUpload(e.target.files)}
            />
          </>
        }
      />

      {/* Status messages */}
      {err ? (
        <div className="mb-3 rounded-md border border-error-100 bg-error-50 px-3 py-2 text-xs text-error-700">
          {err}
        </div>
      ) : null}
      {actionMsg ? (
        <div
          className="mb-3 rounded-md px-3 py-2 text-xs"
          style={{
            backgroundColor: "var(--admin-success-light)",
            color: "var(--admin-success-dark)",
          }}
        >
          {actionMsg}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[240px_1fr]">
        {/* Left sidebar */}
        <aside className="space-y-4">
          <V2Card className="p-3.5">
            <div
              className="px-3 pb-1.5 pt-1.5 text-[10px] font-semibold uppercase tracking-[0.5px]"
              style={{ color: "var(--admin-text-tertiary)" }}
            >
              {tx(t, "admin.files.quick", "Quick access")}
            </div>
            <QuickItem
              icon="files"
              label={tx(t, "admin.files.q.all", "My files")}
              active={quick === "all"}
              onClick={() => {
                setQuick("all");
                setFolder("/");
              }}
              count={stats?.total_count}
            />
            <QuickItem
              icon="clock"
              label={tx(t, "admin.files.q.recent", "Recent")}
              active={quick === "recent"}
              onClick={() => setQuick("recent")}
            />
            <QuickItem
              icon="trash"
              label={tx(t, "admin.files.q.trash", "Trash")}
              active={quick === "trash"}
              onClick={() => setQuick("trash")}
            />
          </V2Card>

          {/* Storage card — real numbers */}
          <V2Card className="p-3.5">
            <div className="text-[12px] font-medium">
              {tx(t, "admin.files.storage", "Storage")}
            </div>
            <StorageMeter stats={stats} />
            {stats ? (
              <div
                className="mt-2 text-[11px]"
                style={{ color: "var(--admin-text-secondary)" }}
              >
                {formatBytes(stats.total_bytes)} {tx(t, "admin.files.of", "of")}{" "}
                {formatBytes(stats.quota_bytes)}{" "}
                {tx(t, "admin.files.used", "used")}
              </div>
            ) : (
              <div
                className="mt-2 text-[11px]"
                style={{ color: "var(--admin-text-tertiary)" }}
              >
                {tx(t, "common.loading", "Loading…")}
              </div>
            )}
          </V2Card>
        </aside>

        {/* Main */}
        <div>
          {/* Breadcrumb chip + search + view toggle */}
          <V2Card className="mb-4">
            <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5">
              <div
                className="flex flex-wrap items-center gap-1.5 text-[12px]"
                style={{ color: "var(--admin-text-secondary)" }}
              >
                <FolderIcon />
                {folderCrumbs.map((c, i) => {
                  const isLast = i === folderCrumbs.length - 1;
                  return (
                    <span key={c.path} className="flex items-center gap-1.5">
                      {i > 0 ? <ChevronRightSmall /> : null}
                      <button
                        type="button"
                        onClick={() => setFolder(c.path)}
                        className={
                          isLast
                            ? "font-medium"
                            : "hover:text-[color:var(--admin-primary)]"
                        }
                        style={
                          isLast ? { color: "var(--admin-text-primary)" } : undefined
                        }
                      >
                        {c.label}
                      </button>
                    </span>
                  );
                })}
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <SearchSmall />
                  <input
                    type="search"
                    placeholder={tx(t, "admin.files.search_placeholder", "Search files...")}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-[30px] w-[220px] rounded-md border bg-white pl-9 pr-3 text-[12px] outline-none"
                    style={{ borderColor: "var(--admin-border)" }}
                  />
                </div>
              </div>
            </div>
          </V2Card>

          {/* Folders */}
          {quick === "all" && subfolders.length > 0 ? (
            <div className="mb-4">
              <div
                className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.5px]"
                style={{ color: "var(--admin-text-secondary)" }}
              >
                {tx(t, "admin.files.folders", "Folders")} ({subfolders.length})
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {subfolders.map((f) => (
                  <button
                    key={f.folder}
                    type="button"
                    onClick={() => setFolder(f.folder)}
                    className="text-left"
                  >
                    <V2Card className="cursor-pointer p-4 transition hover:shadow-md">
                      <FolderLargeIcon />
                      <div className="mt-3 font-medium">{f.name}</div>
                      <div
                        className="text-[11px]"
                        style={{ color: "var(--admin-text-secondary)" }}
                      >
                        {f.file_count} {tx(t, "admin.files.files", "files")} ·{" "}
                        {formatBytes(f.total_bytes)}
                      </div>
                    </V2Card>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {/* Files */}
          <V2Card>
            <div
              className="border-b px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.5px]"
              style={{
                borderColor: "var(--admin-border)",
                color: "var(--admin-text-secondary)",
              }}
            >
              {tx(t, "admin.files.files", "Files")} ({visibleFiles.length})
            </div>

            {quick === "trash" ? (
              <div className="px-4 py-10 text-center">
                <div
                  className="text-[13px] font-medium"
                  style={{ color: "var(--admin-text-primary)" }}
                >
                  {tx(t, "admin.files.trash_title", "Trash is empty")}
                </div>
                <div
                  className="mt-1 text-[11px]"
                  style={{ color: "var(--admin-text-secondary)" }}
                >
                  {tx(
                    t,
                    "admin.files.trash_hint",
                    "Deleted files stay recoverable for 30 days via super-admin."
                  )}
                </div>
              </div>
            ) : loading ? (
              <div
                className="px-4 py-10 text-center text-[12px]"
                style={{ color: "var(--admin-text-secondary)" }}
              >
                {tx(t, "common.loading", "Loading…")}
              </div>
            ) : visibleFiles.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <div
                  className="text-[13px] font-medium"
                  style={{ color: "var(--admin-text-primary)" }}
                >
                  {tx(t, "admin.files.empty", "No files in this folder")}
                </div>
                <div
                  className="mt-1 text-[11px]"
                  style={{ color: "var(--admin-text-secondary)" }}
                >
                  {tx(
                    t,
                    "admin.files.empty_hint",
                    "Click Upload files to add the first one."
                  )}
                </div>
              </div>
            ) : (
              <table className="w-full border-collapse text-[13px]">
                <thead style={{ backgroundColor: "var(--admin-bg-secondary)" }}>
                  <tr>
                    <th
                      className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.5px]"
                      style={{ color: "var(--admin-text-secondary)" }}
                    >
                      {tx(t, "admin.files.col.name", "Name")}
                    </th>
                    <th
                      className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.5px]"
                      style={{ color: "var(--admin-text-secondary)" }}
                    >
                      {tx(t, "admin.files.col.owner", "Owner")}
                    </th>
                    <th
                      className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.5px]"
                      style={{ color: "var(--admin-text-secondary)" }}
                    >
                      {tx(t, "admin.files.col.size", "Size")}
                    </th>
                    <th
                      className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.5px]"
                      style={{ color: "var(--admin-text-secondary)" }}
                    >
                      {tx(t, "admin.files.col.modified", "Modified")}
                    </th>
                    <th className="px-4 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {visibleFiles.map((file) => (
                    <tr
                      key={file.id}
                      className="group border-t transition hover:bg-[color:var(--admin-bg-secondary)]"
                      style={{ borderColor: "var(--admin-border)" }}
                    >
                      <td className="px-4 py-3 align-middle">
                        <button
                          type="button"
                          onClick={() => void handleDownload(file)}
                          className="flex items-center gap-3 text-left"
                        >
                          <FileTypeIcon mime={file.mime_type} />
                          <div>
                            <div className="font-medium">{file.filename}</div>
                            <div
                              className="text-[10px] uppercase tracking-[0.3px]"
                              style={{ color: "var(--admin-text-tertiary)" }}
                            >
                              {mimeLabel(file.mime_type)} · {file.visibility}
                            </div>
                          </div>
                        </button>
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold"
                            style={{
                              backgroundColor: "var(--admin-primary-light)",
                              color: "var(--admin-primary-dark)",
                            }}
                          >
                            {ownerInitials(file.uploaded_by, user?.id).slice(0, 2)}
                          </span>
                          <span className="text-[12px]">
                            {ownerInitials(file.uploaded_by, user?.id)}
                          </span>
                        </div>
                      </td>
                      <td
                        className="px-4 py-3 align-middle"
                        style={{ color: "var(--admin-text-secondary)" }}
                      >
                        {formatBytes(file.size_bytes)}
                      </td>
                      <td
                        className="px-4 py-3 align-middle"
                        style={{ color: "var(--admin-text-secondary)" }}
                      >
                        {formatDate(file.created_at)}
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <div className="flex justify-end gap-1 opacity-60 transition group-hover:opacity-100">
                          <IconButton
                            aria-label="Download"
                            onClick={() => void handleDownload(file)}
                          >
                            <DownloadSmall />
                          </IconButton>
                          <IconButton
                            aria-label="Delete"
                            onClick={() => void handleDelete(file)}
                          >
                            <TrashSmall />
                          </IconButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </V2Card>
        </div>
      </div>
    </div>
  );
}

/* ─── small render helpers ─────────────────────────────────────────────── */

function StorageMeter({ stats }: { stats: StorageStats | null }) {
  const pct =
    stats && stats.quota_bytes > 0
      ? Math.min(100, Math.round((stats.total_bytes / stats.quota_bytes) * 100))
      : 0;
  return (
    <div
      className="mt-2 h-1.5 overflow-hidden rounded-full"
      style={{ backgroundColor: "var(--admin-bg-tertiary)" }}
    >
      <div
        className="h-full rounded-full"
        style={{ width: `${pct}%`, backgroundColor: "var(--admin-primary)" }}
      />
    </div>
  );
}

function QuickItem({
  icon,
  label,
  active,
  onClick,
  count,
}: {
  icon: "files" | "clock" | "trash";
  label: string;
  active: boolean;
  onClick: () => void;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13px] transition"
      style={{
        backgroundColor: active ? "var(--admin-primary-light)" : "transparent",
        color: active ? "var(--admin-primary-dark)" : "var(--admin-text-secondary)",
        fontWeight: active ? 500 : 400,
      }}
    >
      <QuickIcon name={icon} />
      <span className="flex-1">{label}</span>
      {count != null ? <span className="text-[11px] opacity-60">{count}</span> : null}
    </button>
  );
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
function FileTypeIcon({ mime }: { mime: string }) {
  const bucket = mimeBucket(mime);
  const color =
    mime === "application/pdf"
      ? "var(--admin-danger)"
      : bucket === "image"
        ? "var(--admin-info)"
        : bucket === "video"
          ? "var(--admin-info-dark)"
          : bucket === "audio"
            ? "var(--admin-success)"
            : bucket === "text"
              ? "var(--admin-text-secondary)"
              : "var(--admin-primary)";
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
function TrashSmall() {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}
