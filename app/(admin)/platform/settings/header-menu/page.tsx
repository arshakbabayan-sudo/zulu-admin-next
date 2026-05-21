"use client";

/**
 * Header menu administration.
 * Phase-2 migration to shared @/components/ui primitives.
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
import { Button, Checkbox, FormField, Input, PageHeader } from "@/components/ui";

type EditRow = HeaderMenuAdminRow & { _tempId?: string };

function tempId(): string { return `new-${Math.random().toString(36).slice(2, 9)}`; }

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

  useEffect(() => { void load(); }, [load]);

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
        id: 0, _tempId: tempId(), parent_id: null, label_en: "", label_ru: null, label_hy: null,
        url: "/", position: prev.filter((i) => i.parent_id == null).length + 1,
        is_visible: true, icon: null, open_in_new_tab: false,
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
          id: 0, _tempId: tempId(), parent_id: parent.id || -999,
          label_en: "", label_ru: null, label_hy: null, url: "/",
          position: siblingCount + 1, is_visible: true, icon: null, open_in_new_tab: false,
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
      if (!a || !b) return prev;
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
      const tempToNeg = new Map<string, number>();
      let counter = -1;
      for (const r of items) {
        if (r._tempId && !tempToNeg.has(r._tempId)) tempToNeg.set(r._tempId, counter--);
      }
      const payload = items.map((r) => {
        const realId = r.id && r.id > 0 ? r.id : (r._tempId ? tempToNeg.get(r._tempId)! : null);
        const parentId = r.parent_id == null ? null : r.parent_id > 0 ? r.parent_id : r.parent_id;
        return {
          id: realId, parent_id: parentId,
          label_en: r.label_en, label_ru: r.label_ru, label_hy: r.label_hy,
          url: r.url, position: r.position, is_visible: r.is_visible,
          icon: r.icon, open_in_new_tab: r.open_in_new_tab,
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
      <div className="space-y-4">
        <h1 className="admin-page-title">Header menu</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        title="Header menu"
        actions={<Button variant="outline" size="sm" onClick={addRootItem}>+ Add item</Button>}
      />

      {err && <div className="rounded-zulu border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">{err}</div>}
      {savedAt && <div className="rounded-zulu border border-success-100 bg-success-50 px-4 py-2 text-sm text-success-700">Saved.</div>}

      <div className="flex flex-col gap-3">
        {topLevel.length === 0 && <p className="text-sm text-fg-t6">No items.</p>}
        {topLevel.map((parent, parentIdx) => {
          const key = parent.id || parent._tempId!;
          const children = items
            .filter((c) => c.parent_id === parent.id || c.parent_id === -999)
            .sort((a, b) => a.position - b.position);
          return (
            <div key={key} className="admin-card p-3">
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
                <div className="mt-3 ml-6 border-l-2 border-primary-200 pl-3">
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
                  className="text-xs text-primary-500 underline hover:text-primary-700"
                >
                  + Add child
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="sticky bottom-0 flex justify-end gap-2 border-t border-default bg-white py-3 -mx-4 px-4">
        <Button size="sm" disabled={saving} onClick={() => void handleSave()}>
          {saving ? "Saving…" : "Save all"}
        </Button>
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
    <div className={isChild ? "mb-3 rounded-zulu border border-default bg-figma-bg-1 p-2" : ""}>
      <div className="grid gap-2 md:grid-cols-3">
        <FormField label="Label (EN)" htmlFor={`hm-en-${rowKey}`}>
          <Input id={`hm-en-${rowKey}`} value={row.label_en} onChange={(e) => onChange(rowKey, { label_en: e.target.value })} />
        </FormField>
        <FormField label="Label (RU)" htmlFor={`hm-ru-${rowKey}`}>
          <Input id={`hm-ru-${rowKey}`} value={row.label_ru ?? ""} onChange={(e) => onChange(rowKey, { label_ru: e.target.value === "" ? null : e.target.value })} />
        </FormField>
        <FormField label="Label (HY)" htmlFor={`hm-hy-${rowKey}`}>
          <Input id={`hm-hy-${rowKey}`} value={row.label_hy ?? ""} onChange={(e) => onChange(rowKey, { label_hy: e.target.value === "" ? null : e.target.value })} />
        </FormField>
        <FormField label="URL" htmlFor={`hm-url-${rowKey}`} className="md:col-span-2">
          <Input id={`hm-url-${rowKey}`} value={row.url} onChange={(e) => onChange(rowKey, { url: e.target.value })} placeholder="/about or https://..." className="font-mono" />
        </FormField>
        <FormField label="Icon (optional)" htmlFor={`hm-icon-${rowKey}`}>
          <Input id={`hm-icon-${rowKey}`} value={row.icon ?? ""} onChange={(e) => onChange(rowKey, { icon: e.target.value === "" ? null : e.target.value })} placeholder="lucide name (e.g. phone)" className="font-mono" />
        </FormField>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          <Checkbox
            checked={row.is_visible}
            onChange={(e) => onChange(rowKey, { is_visible: e.target.checked })}
            label="Visible"
          />
          <Checkbox
            checked={row.open_in_new_tab}
            onChange={(e) => onChange(rowKey, { open_in_new_tab: e.target.checked })}
            label="New tab"
          />
        </div>
        <div className="flex items-center gap-1">
          <button type="button" disabled={isFirst} onClick={() => onMove(rowKey, -1)} className="rounded-zulu border border-default px-2 py-1 text-xs disabled:opacity-30 hover:bg-figma-bg-1" aria-label="Move up">↑</button>
          <button type="button" disabled={isLast} onClick={() => onMove(rowKey, 1)} className="rounded-zulu border border-default px-2 py-1 text-xs disabled:opacity-30 hover:bg-figma-bg-1" aria-label="Move down">↓</button>
          <button type="button" onClick={() => onRemove(rowKey)} className="rounded-zulu border border-error-200 bg-error-50 px-2 py-1 text-xs text-error-700 hover:bg-error-100">Remove</button>
        </div>
      </div>
    </div>
  );
}
