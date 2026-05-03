"use client";

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { PaginationBar } from "@/components/PaginationBar";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import type { ApiListMeta } from "@/lib/api-envelope";
import {
  apiAdminPages,
  apiCreateAdminPage,
  apiDeleteAdminPage,
  apiPatchAdminPageStatus,
  type AdminPageRow,
} from "@/lib/pages-api";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function formatDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
}

function statusBadge(isActive: boolean): string {
  return isActive
    ? "inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700"
    : "inline-flex items-center rounded-full bg-figma-bg-1 px-2 py-0.5 text-xs font-medium text-fg-t7";
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={checked ? "Set page inactive" : "Set page active"}
      disabled={disabled}
      onClick={onChange}
      className={`relative h-6 w-11 rounded-full transition ${
        checked ? "bg-violet-600" : "bg-slate-300"
      } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
          checked ? "left-[22px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

function AddPageModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (pageName: string, pageSlug: string) => Promise<void>;
}) {
  const [pageName, setPageName] = useState("");
  const [pageSlug, setPageSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!slugTouched) {
      setPageSlug(slugify(pageName));
    }
  }, [pageName, slugTouched]);

  async function submit() {
    const cleanName = pageName.trim();
    const cleanSlug = pageSlug.trim();
    if (!cleanName || !cleanSlug) {
      setErr("Page name and slug are required.");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      await onSubmit(cleanName, cleanSlug);
      onClose();
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : "Failed to create page");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-page-modal-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded border border-default bg-white p-5 shadow-xl">
        <h2 id="add-page-modal-title" className="text-base font-semibold text-fg-t11">
          Add New Page
        </h2>
        {err ? <p className="mt-2 text-sm text-error-600">{err}</p> : null}
        <div className="mt-4 space-y-3">
          <label className="block text-sm text-fg-t7">
            Page Name
            <input
              value={pageName}
              onChange={(e) => setPageName(e.target.value)}
              placeholder="Home Page"
              className="mt-1 w-full rounded border border-default px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm text-fg-t7">
            Slug
            <input
              value={pageSlug}
              onChange={(e) => {
                setSlugTouched(true);
                setPageSlug(slugify(e.target.value));
              }}
              placeholder="home-page"
              className="mt-1 w-full rounded border border-default px-3 py-2 font-mono text-sm"
            />
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-default bg-white px-3 py-1.5 text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void submit()}
            className="rounded bg-violet-600 px-3 py-1.5 text-sm text-white disabled:opacity-60"
          >
            {saving ? "Saving..." : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminPagesListPage() {
  const { token, user } = useAdminAuth();
  const allowed = canAccessPlatformAdminNav(user);

  const [rows, setRows] = useState<AdminPageRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  const snStart = useMemo(() => {
    if (!meta) return 0;
    return (meta.current_page - 1) * meta.per_page;
  }, [meta]);

  const load = useCallback(async () => {
    if (!token || !allowed) return;
    setErr(null);
    setForbidden(false);
    setIsLoading(true);
    try {
      const res = await apiAdminPages(token, { page });
      setRows(res.data);
      setMeta(res.meta);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : "Failed to load pages");
      setRows([]);
      setMeta(null);
    } finally {
      setIsLoading(false);
    }
  }, [token, allowed, page]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleAdd(pageName: string, pageSlug: string) {
    if (!token) return;
    await apiCreateAdminPage(token, { page_name: pageName, page_slug: pageSlug });
    setPage(1);
    await load();
  }

  async function handleToggleStatus(row: AdminPageRow) {
    if (!token) return;
    setBusyId(row.id);
    try {
      await apiPatchAdminPageStatus(token, {
        page_id: row.id,
        status: row.status === 1 ? 0 : 1,
      });
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : "Failed to update status");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(row: AdminPageRow) {
    if (!token) return;
    if (!window.confirm(`Delete page "${row.page_name}"?`)) return;
    setBusyId(row.id);
    try {
      await apiDeleteAdminPage(token, row.id);
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : "Failed to delete page");
    } finally {
      setBusyId(null);
    }
  }

  if (!allowed || forbidden) {
    return (
      <div>
        <h1 className="text-xl font-semibold">Pages</h1>
        <div className="mt-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div>
      {showAddModal ? (
        <AddPageModal onClose={() => setShowAddModal(false)} onSubmit={handleAdd} />
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Pages</h1>
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="rounded bg-violet-600 px-3 py-1.5 text-sm font-medium text-white"
        >
          Add New Page
        </button>
      </div>

      {err ? <p className="mt-2 text-sm text-error-600">{err}</p> : null}

      <div
        className={`mt-4 overflow-x-auto rounded border border-default bg-white transition-opacity ${
          isLoading ? "pointer-events-none opacity-60" : "opacity-100"
        }`}
      >
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="border-b border-default bg-figma-bg-1 text-xs uppercase text-fg-t7">
            <tr>
              <th className="px-3 py-2">S.N</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Published</th>
              <th className="px-3 py-2">Created</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-sm text-fg-t6">
                  No pages found.
                </td>
              </tr>
            ) : (
              rows.map((row, index) => {
                const isActive = row.status === 1;
                return (
                  <tr key={row.id} className="border-b border-default">
                    <td className="px-3 py-2 tabular-nums">{snStart + index + 1}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-fg-t11">{row.page_name}</div>
                      <div className="text-xs text-fg-t6">/{row.page_slug}</div>
                    </td>
                    <td className="px-3 py-2">
                      <span className={statusBadge(isActive)}>{isActive ? "Active" : "Inactive"}</span>
                    </td>
                    <td className="px-3 py-2">
                      <Toggle
                        checked={isActive}
                        disabled={busyId === row.id}
                        onChange={() => void handleToggleStatus(row)}
                      />
                    </td>
                    <td className="px-3 py-2 text-fg-t7">{formatDate(row.created_at)}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-3 text-xs">
                        <Link
                          href={`/pages/${row.id}/edit?mode=view`}
                          className="text-info-700 underline"
                        >
                          View
                        </Link>
                        <Link href={`/pages/${row.id}/edit`} className="text-violet-700 underline">
                          Edit
                        </Link>
                        <button
                          type="button"
                          disabled={busyId === row.id}
                          onClick={() => void handleDelete(row)}
                          className="text-error-700 underline disabled:opacity-40"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {meta ? <PaginationBar meta={meta} onPage={setPage} /> : null}
    </div>
  );
}
