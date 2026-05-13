"use client";

/**
 * Header menu administration. Manages the items on zulu.am's top
 * navigation bar (Sprint 2 Step 2.3 of ZULU CMS roadmap).
 *
 * Pattern: full-replace sync — load all items, edit in-place, "Save all"
 * sends the whole list back. Reorder via up/down arrow buttons.
 * Nesting: any item can be marked as child of another via the parent
 * dropdown. Two-level depth supported (top-level + one child level).
 */

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import {
  apiAdminHeaderMenu,
  apiSyncHeaderMenu,
  type HeaderMenuAdminRow,
} from "@/lib/platform-admin-api";
import { useCallback, useEffect, useMemo, useState } from "react";

type EditRow = HeaderMenuAdminRow & { _tempId?: string };

function tempId(): string {
  return `new-${Math.random().toString(36).slice(2, 9)}`;
}

export default function PlatformHeaderMenuPage() {
  const { token, user } = useAdminAuth();
  const allowed = canAccessPlatformAdminNav(user);
  const [items, setItems] = useState<EditRow[]>([]);
  const [forbidden, setForbidden] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!token || !allowed) return;
    setErr(null);
    try {
      const res = await apiAdminHeaderMenu(token);
      setItems(res.data.items.map((it) => ({ ...it })));
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : "Failed to load");
    }
  }, [token, allowed]);

  useEffect(() => {
    void load();
  }, [load]);

  const topLevel = useMemo(
    () => items.filter((i) => i.parent_id == null).sort((a, b) => a.position - b.position),
    [items]
  );

  function updateRow(rowKey: number | string, patch: Partial<EditRow>) {
    setItems((prev) =>
      prev.map((r) => {
        const key = r.id || r._tempId;
        return key === rowKey ? { ...r, ...patch } : r;
      })
    );
  }

  function addRootItem() {
    setItems((prev) => [
      ...prev,
      {
        id: 0,
        _tempId: tempId(),
        parent_id: null,
        label_en: "",
        label_ru: null,
        label_hy: null,
        url: "/",
        position: prev.filter((i) => i.parent_id == null).length + 1,
        is_visible: true,
        icon: null,
        open_in_new_tab: false,
      },
    ]);
  }

  function addChild(parentKey: number | string) {
    setItems((prev) => {
      const parent = prev.find((p) => (p.id || p._tempId) === parentKey);
      if (!parent) return prev;
      const siblingCount = prev.filter((i) => i.parent_id === parent.id).length;
      return [
        ...prev,
        {
          id: 0,
          _tempId: tempId(),
          parent_id: parent.id || -999, // temp until backend assigns real id; controller handles negative parent linking when full sync
          label_en: "",
          label_ru: null,
          label_hy: null,
          url: "/",
          position: siblingCount + 1,
          is_visible: true,
          icon: null,
          open_in_new_tab: false,
        },
      ];
    });
  }

  function removeRow(rowKey: number | string) {
    setItems((prev) => prev.filter((r) => (r.id || r._tempId) !== rowKey));
  }

  function moveRow(rowKey: number | string, delta: -1 | 1) {
    setItems((prev) => {
      const target = prev.find((r) => (r.id || r._tempId) === rowKey);
      if (!target) return prev;
      const siblings = prev
        .filter((r) => r.parent_id === target.parent_id)
        .sort((a, b) => a.position - b.position);
      const idx = siblings.findIndex((r) => (r.id || r._tempId) === rowKey);
      const swapIdx = idx + delta;
      if (swapIdx < 0 || swapIdx >= siblings.length) return prev;
      const a = siblings[idx];
      const b = siblings[swapIdx];
      const tmp = a.position;
      return prev.map((r) => {
        const k = r.id || r._tempId;
        if (k === (a.id || a._tempId)) return { ...r, position: b.position };
        if (k === (b.id || b._tempId)) return { ...r, position: tmp };
        return r;
      });
    });
  }

  async function handleSave() {
    if (!token) return;
    setSaving(true);
    setErr(null);
    try {
      // Convert temp ids to negatives so backend can wire parent links
      const tempToNeg = new Map<string, number>();
      let counter = -1;
      for (const r of items) {
        if (r._tempId && !tempToNeg.has(r._tempId)) {
          tempToNeg.set(r._tempId, counter--);
        }
      }
      const payload = items.map((r) => {
        const realId = r.id && r.id > 0 ? r.id : (r._tempId ? tempToNeg.get(r._tempId)! : null);
        const parentId =
          r.parent_id == null
            ? null
            : r.parent_id > 0
              ? r.parent_id
              : // The placeholder we put when adding a child of a new parent:
                // when backend stores negative parent ids in our id map keyed by
                // payload "id" values, we just pass through to look up the temp.
                r.parent_id;
        return {
          id: realId,
          parent_id: parentId,
          label_en: r.label_en,
          label_ru: r.label_ru,
          label_hy: r.label_hy,
          url: r.url,
          position: r.position,
          is_visible: r.is_visible,
          icon: r.icon,
          open_in_new_tab: r.open_in_new_tab,
        };
      });
      const res = await apiSyncHeaderMenu(token, payload);
      setItems(res.data.items);
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
        <h1 className="admin-page-title">Header menu</h1>
        <div className="mt-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="admin-page-title">Header menu</h1>
        <button
          type="button"
          onClick={addRootItem}
          className="rounded border border-default bg-white px-3 py-1.5 text-sm hover:bg-figma-bg-1"
        >
          + Add item
        </button>
      </div>
      {err && <p className="mt-2 text-sm text-error-600">{err}</p>}
      {savedAt && <p className="mt-2 text-sm text-emerald-700">Saved.</p>}

      <div className="mt-4 flex flex-col gap-3">
        {topLevel.length === 0 && <p className="text-sm text-fg-t6">No items.</p>}
        {topLevel.map((parent, parentIdx) => {
          const key = parent.id || parent._tempId!;
          const children = items
            .filter((c) => c.parent_id === parent.id || c.parent_id === -999) // -999 placeholder while parent is new
            .sort((a, b) => a.position - b.position);
          return (
            <div key={key} className="rounded-lg border border-default bg-white p-3">
              <ItemEditor
                row={parent}
                rowKey={key}
                isFirst={parentIdx === 0}
                isLast={parentIdx === topLevel.length - 1}
                onChange={updateRow}
                onMove={moveRow}
                onRemove={removeRow}
              />

              {children.length > 0 && (
                <div className="mt-3 ml-6 border-l-2 border-violet-200 pl-3">
                  <p className="mb-2 text-xs font-medium text-fg-t6">Children</p>
                  {children.map((child, childIdx) => {
                    const childKey = child.id || child._tempId!;
                    return (
                      <ItemEditor
                        key={childKey}
                        row={child}
                        rowKey={childKey}
                        isFirst={childIdx === 0}
                        isLast={childIdx === children.length - 1}
                        onChange={updateRow}
                        onMove={moveRow}
                        onRemove={removeRow}
                        isChild
                      />
                    );
                  })}
                </div>
              )}

              <div className="mt-2 text-right">
                <button
                  type="button"
                  onClick={() => addChild(key)}
                  className="text-xs text-violet-700 underline"
                >
                  + Add child
                </button>
              </div>
            </div>
          );
        })}
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

function ItemEditor({
  row,
  rowKey,
  isFirst,
  isLast,
  onChange,
  onMove,
  onRemove,
  isChild,
}: {
  row: EditRow;
  rowKey: number | string;
  isFirst: boolean;
  isLast: boolean;
  onChange: (rowKey: number | string, patch: Partial<EditRow>) => void;
  onMove: (rowKey: number | string, delta: -1 | 1) => void;
  onRemove: (rowKey: number | string) => void;
  isChild?: boolean;
}) {
  return (
    <div className={isChild ? "mb-3 rounded border border-default bg-figma-bg-1 p-2" : ""}>
      <div className="grid gap-2 md:grid-cols-3">
        <label className="text-xs">
          <span className="text-fg-t6">Label (EN)</span>
          <input
            value={row.label_en}
            onChange={(e) => onChange(rowKey, { label_en: e.target.value })}
            className="mt-1 w-full rounded border border-default px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs">
          <span className="text-fg-t6">Label (RU)</span>
          <input
            value={row.label_ru ?? ""}
            onChange={(e) => onChange(rowKey, { label_ru: e.target.value === "" ? null : e.target.value })}
            className="mt-1 w-full rounded border border-default px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs">
          <span className="text-fg-t6">Label (HY)</span>
          <input
            value={row.label_hy ?? ""}
            onChange={(e) => onChange(rowKey, { label_hy: e.target.value === "" ? null : e.target.value })}
            className="mt-1 w-full rounded border border-default px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs md:col-span-2">
          <span className="text-fg-t6">URL</span>
          <input
            value={row.url}
            onChange={(e) => onChange(rowKey, { url: e.target.value })}
            placeholder="/about or https://..."
            className="mt-1 w-full rounded border border-default px-2 py-1.5 text-sm font-mono"
          />
        </label>
        <label className="text-xs">
          <span className="text-fg-t6">Icon (optional)</span>
          <input
            value={row.icon ?? ""}
            onChange={(e) => onChange(rowKey, { icon: e.target.value === "" ? null : e.target.value })}
            placeholder="lucide name (e.g. phone)"
            className="mt-1 w-full rounded border border-default px-2 py-1.5 text-sm font-mono"
          />
        </label>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <label className="inline-flex items-center gap-1.5 text-xs">
            <input
              type="checkbox"
              checked={row.is_visible}
              onChange={(e) => onChange(rowKey, { is_visible: e.target.checked })}
              className="h-3.5 w-3.5"
            />
            Visible
          </label>
          <label className="inline-flex items-center gap-1.5 text-xs">
            <input
              type="checkbox"
              checked={row.open_in_new_tab}
              onChange={(e) => onChange(rowKey, { open_in_new_tab: e.target.checked })}
              className="h-3.5 w-3.5"
            />
            New tab
          </label>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={isFirst}
            onClick={() => onMove(rowKey, -1)}
            className="rounded border border-default px-2 py-1 text-xs disabled:opacity-30"
            aria-label="Move up"
          >
            ↑
          </button>
          <button
            type="button"
            disabled={isLast}
            onClick={() => onMove(rowKey, 1)}
            className="rounded border border-default px-2 py-1 text-xs disabled:opacity-30"
            aria-label="Move down"
          >
            ↓
          </button>
          <button
            type="button"
            onClick={() => onRemove(rowKey)}
            className="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-error-700"
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}
