"use client";

/**
 * Footer administration. Manages footer_columns + footer_links
 * (Sprint 2 Step 2.4 of ZULU CMS roadmap).
 *
 * Up/down reorder buttons within each column; columns reorderable too.
 * Full-replace sync on Save: any row not in the payload is deleted.
 */

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import {
  apiAdminFooter,
  apiSyncFooter,
  type FooterColumnAdminRow,
  type FooterLinkAdminRow,
} from "@/lib/platform-admin-api";
import { useCallback, useEffect, useState } from "react";

type EditLink = FooterLinkAdminRow & { _tempId?: string };
type EditCol = Omit<FooterColumnAdminRow, "links"> & { links: EditLink[]; _tempId?: string };

function tempId(): string {
  return `new-${Math.random().toString(36).slice(2, 9)}`;
}

export default function PlatformFooterPage() {
  const { token, user } = useAdminAuth();
  const allowed = canAccessPlatformAdminNav(user);
  const [columns, setColumns] = useState<EditCol[]>([]);
  const [forbidden, setForbidden] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!token || !allowed) return;
    setErr(null);
    try {
      const res = await apiAdminFooter(token);
      setColumns(res.data.columns.map((c) => ({ ...c, links: c.links.map((l) => ({ ...l })) })));
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : "Failed to load");
    }
  }, [token, allowed]);

  useEffect(() => {
    void load();
  }, [load]);

  function updateColumn(idx: number, patch: Partial<EditCol>) {
    setColumns((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  }

  function updateLink(colIdx: number, linkIdx: number, patch: Partial<EditLink>) {
    setColumns((prev) =>
      prev.map((c, i) =>
        i === colIdx
          ? {
              ...c,
              links: c.links.map((l, j) => (j === linkIdx ? { ...l, ...patch } : l)),
            }
          : c
      )
    );
  }

  function addColumn() {
    setColumns((prev) => [
      ...prev,
      {
        id: 0,
        _tempId: tempId(),
        slug: "",
        title_en: "",
        title_ru: null,
        title_hy: null,
        position: prev.length + 1,
        is_visible: true,
        links: [],
      },
    ]);
  }

  function removeColumn(idx: number) {
    setColumns((prev) => prev.filter((_, i) => i !== idx));
  }

  function moveColumn(idx: number, delta: -1 | 1) {
    setColumns((prev) => {
      const newIdx = idx + delta;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const copy = [...prev];
      const tmp = copy[idx];
      copy[idx] = copy[newIdx];
      copy[newIdx] = tmp;
      return copy.map((c, i) => ({ ...c, position: i + 1 }));
    });
  }

  function addLink(colIdx: number) {
    setColumns((prev) =>
      prev.map((c, i) =>
        i === colIdx
          ? {
              ...c,
              links: [
                ...c.links,
                {
                  id: 0,
                  _tempId: tempId(),
                  column_id: c.id,
                  label_en: "",
                  label_ru: null,
                  label_hy: null,
                  url: "/",
                  position: c.links.length + 1,
                  is_visible: true,
                  open_in_new_tab: false,
                },
              ],
            }
          : c
      )
    );
  }

  function removeLink(colIdx: number, linkIdx: number) {
    setColumns((prev) =>
      prev.map((c, i) =>
        i === colIdx ? { ...c, links: c.links.filter((_, j) => j !== linkIdx) } : c
      )
    );
  }

  function moveLink(colIdx: number, linkIdx: number, delta: -1 | 1) {
    setColumns((prev) =>
      prev.map((c, i) => {
        if (i !== colIdx) return c;
        const newIdx = linkIdx + delta;
        if (newIdx < 0 || newIdx >= c.links.length) return c;
        const copy = [...c.links];
        const tmp = copy[linkIdx];
        copy[linkIdx] = copy[newIdx];
        copy[newIdx] = tmp;
        return { ...c, links: copy.map((l, k) => ({ ...l, position: k + 1 })) };
      })
    );
  }

  async function handleSave() {
    if (!token) return;
    setSaving(true);
    setErr(null);
    try {
      const payload = columns.map((c) => ({
        id: c.id && c.id > 0 ? c.id : null,
        slug: c.slug || null,
        title_en: c.title_en,
        title_ru: c.title_ru,
        title_hy: c.title_hy,
        position: c.position,
        is_visible: c.is_visible,
        links: c.links.map((l) => ({
          id: l.id && l.id > 0 ? l.id : null,
          label_en: l.label_en,
          label_ru: l.label_ru,
          label_hy: l.label_hy,
          url: l.url,
          position: l.position,
          is_visible: l.is_visible,
          open_in_new_tab: l.open_in_new_tab,
        })),
      }));
      const res = await apiSyncFooter(token, payload);
      setColumns(res.data.columns.map((c) => ({ ...c, links: c.links.map((l) => ({ ...l })) })));
      setSavedAt(Date.now());
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (!allowed || forbidden) {
    return (
      <div>
        <h1 className="admin-page-title">Footer</h1>
        <div className="mt-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="admin-page-title">Footer columns</h1>
        <button
          type="button"
          onClick={addColumn}
          className="rounded border border-default bg-white px-3 py-1.5 text-sm hover:bg-figma-bg-1"
        >
          + Add column
        </button>
      </div>
      {err && <p className="mt-2 text-sm text-error-600">{err}</p>}
      {savedAt && <p className="mt-2 text-sm text-emerald-700">Saved.</p>}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {columns.map((col, colIdx) => (
          <div key={col.id || col._tempId} className="rounded-lg border border-default bg-white p-3">
            <div className="grid gap-2 md:grid-cols-3">
              <label className="text-xs">
                <span className="text-fg-t6">Title (EN)</span>
                <input
                  value={col.title_en}
                  onChange={(e) => updateColumn(colIdx, { title_en: e.target.value })}
                  className="mt-1 w-full rounded border border-default px-2 py-1.5 text-sm"
                />
              </label>
              <label className="text-xs">
                <span className="text-fg-t6">Title (RU)</span>
                <input
                  value={col.title_ru ?? ""}
                  onChange={(e) => updateColumn(colIdx, { title_ru: e.target.value === "" ? null : e.target.value })}
                  className="mt-1 w-full rounded border border-default px-2 py-1.5 text-sm"
                />
              </label>
              <label className="text-xs">
                <span className="text-fg-t6">Title (HY)</span>
                <input
                  value={col.title_hy ?? ""}
                  onChange={(e) => updateColumn(colIdx, { title_hy: e.target.value === "" ? null : e.target.value })}
                  className="mt-1 w-full rounded border border-default px-2 py-1.5 text-sm"
                />
              </label>
              <label className="text-xs">
                <span className="text-fg-t6">Slug (optional)</span>
                <input
                  value={col.slug ?? ""}
                  onChange={(e) => updateColumn(colIdx, { slug: e.target.value })}
                  className="mt-1 w-full rounded border border-default px-2 py-1.5 text-sm font-mono"
                />
              </label>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <label className="inline-flex items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={col.is_visible}
                  onChange={(e) => updateColumn(colIdx, { is_visible: e.target.checked })}
                  className="h-3.5 w-3.5"
                />
                Visible
              </label>
              <div className="flex items-center gap-1">
                <button type="button" disabled={colIdx === 0} onClick={() => moveColumn(colIdx, -1)} className="rounded border border-default px-2 py-1 text-xs disabled:opacity-30">↑ col</button>
                <button type="button" disabled={colIdx === columns.length - 1} onClick={() => moveColumn(colIdx, 1)} className="rounded border border-default px-2 py-1 text-xs disabled:opacity-30">↓ col</button>
                <button type="button" onClick={() => removeColumn(colIdx)} className="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-error-700">Remove column</button>
              </div>
            </div>

            <div className="mt-3 border-t border-default pt-3">
              <div className="flex items-baseline justify-between">
                <p className="text-xs font-semibold text-fg-t7">Links</p>
                <button type="button" onClick={() => addLink(colIdx)} className="text-xs text-violet-700 underline">
                  + Add link
                </button>
              </div>
              <div className="mt-2 flex flex-col gap-2">
                {col.links.map((link, linkIdx) => (
                  <div key={link.id || link._tempId} className="rounded border border-default bg-figma-bg-1 p-2">
                    <div className="grid gap-2 md:grid-cols-3">
                      <label className="text-xs">
                        <span className="text-fg-t6">Label (EN)</span>
                        <input
                          value={link.label_en}
                          onChange={(e) => updateLink(colIdx, linkIdx, { label_en: e.target.value })}
                          className="mt-1 w-full rounded border border-default px-2 py-1.5 text-sm"
                        />
                      </label>
                      <label className="text-xs">
                        <span className="text-fg-t6">Label (RU)</span>
                        <input
                          value={link.label_ru ?? ""}
                          onChange={(e) => updateLink(colIdx, linkIdx, { label_ru: e.target.value === "" ? null : e.target.value })}
                          className="mt-1 w-full rounded border border-default px-2 py-1.5 text-sm"
                        />
                      </label>
                      <label className="text-xs">
                        <span className="text-fg-t6">Label (HY)</span>
                        <input
                          value={link.label_hy ?? ""}
                          onChange={(e) => updateLink(colIdx, linkIdx, { label_hy: e.target.value === "" ? null : e.target.value })}
                          className="mt-1 w-full rounded border border-default px-2 py-1.5 text-sm"
                        />
                      </label>
                      <label className="text-xs md:col-span-2">
                        <span className="text-fg-t6">URL</span>
                        <input
                          value={link.url}
                          onChange={(e) => updateLink(colIdx, linkIdx, { url: e.target.value })}
                          className="mt-1 w-full rounded border border-default px-2 py-1.5 text-sm font-mono"
                        />
                      </label>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <label className="inline-flex items-center gap-1.5 text-xs">
                          <input
                            type="checkbox"
                            checked={link.is_visible}
                            onChange={(e) => updateLink(colIdx, linkIdx, { is_visible: e.target.checked })}
                            className="h-3.5 w-3.5"
                          />
                          Visible
                        </label>
                        <label className="inline-flex items-center gap-1.5 text-xs">
                          <input
                            type="checkbox"
                            checked={link.open_in_new_tab}
                            onChange={(e) => updateLink(colIdx, linkIdx, { open_in_new_tab: e.target.checked })}
                            className="h-3.5 w-3.5"
                          />
                          New tab
                        </label>
                      </div>
                      <div className="flex items-center gap-1">
                        <button type="button" disabled={linkIdx === 0} onClick={() => moveLink(colIdx, linkIdx, -1)} className="rounded border border-default px-2 py-1 text-xs disabled:opacity-30">↑</button>
                        <button type="button" disabled={linkIdx === col.links.length - 1} onClick={() => moveLink(colIdx, linkIdx, 1)} className="rounded border border-default px-2 py-1 text-xs disabled:opacity-30">↓</button>
                        <button type="button" onClick={() => removeLink(colIdx, linkIdx)} className="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-error-700">Remove</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="sticky bottom-0 mt-6 flex justify-end gap-2 border-t border-default bg-white py-3">
        <button
          type="button"
          disabled={saving}
          onClick={() => void handleSave()}
          className="admin-btn-primary"
        >
          {saving ? "Saving…" : "Save all"}
        </button>
      </div>
    </div>
  );
}
