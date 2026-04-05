"use client";

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { getApiPublicOrigin } from "@/lib/api-base";
import { ApiRequestError } from "@/lib/api-client";
import {
  apiCreatePlatformBanner,
  apiDeletePlatformBanner,
  apiPlatformBanners,
  apiUpdatePlatformBanner,
  type PlatformBannerRow,
} from "@/lib/platform-admin-api";
import { useCallback, useEffect, useState } from "react";

function resolveBannerImageSrc(row: PlatformBannerRow): string | null {
  const u = row.image_url;
  if (!u) return null;
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  const origin = getApiPublicOrigin().replace(/\/$/, "");
  return u.startsWith("/") ? `${origin}${u}` : `${origin}/${u}`;
}

export default function PlatformBannersPage() {
  const { token, user } = useAdminAuth();
  const allowed = canAccessPlatformAdminNav(user);
  const [rows, setRows] = useState<PlatformBannerRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [editing, setEditing] = useState<PlatformBannerRow | null>(null);

  const [createFile, setCreateFile] = useState<File | null>(null);
  const [createTitleEn, setCreateTitleEn] = useState("");
  const [createTitleRu, setCreateTitleRu] = useState("");
  const [createTitleHy, setCreateTitleHy] = useState("");
  const [createLink, setCreateLink] = useState("");
  const [createSort, setCreateSort] = useState("0");

  const [editFile, setEditFile] = useState<File | null>(null);
  const [editTitleEn, setEditTitleEn] = useState("");
  const [editTitleRu, setEditTitleRu] = useState("");
  const [editTitleHy, setEditTitleHy] = useState("");
  const [editLink, setEditLink] = useState("");
  const [editSort, setEditSort] = useState("0");

  const load = useCallback(async () => {
    if (!token || !allowed) return;
    setErr(null);
    setForbidden(false);
    try {
      const res = await apiPlatformBanners(token);
      setRows(res.data);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : "Failed to load banners");
    }
  }, [token, allowed]);

  useEffect(() => {
    load();
  }, [load]);

  function openEdit(row: PlatformBannerRow) {
    setEditing(row);
    setEditFile(null);
    setEditTitleEn(row.title_en ?? "");
    setEditTitleRu(row.title_ru ?? "");
    setEditTitleHy(row.title_hy ?? "");
    setEditLink(row.link_url ?? "");
    setEditSort(String(row.sort_order ?? 0));
  }

  async function submitCreate() {
    if (!token || !createFile) {
      alert("Image file is required.");
      return;
    }
    const fd = new FormData();
    fd.append("image", createFile);
    fd.append("title_en", createTitleEn);
    fd.append("title_ru", createTitleRu);
    fd.append("title_hy", createTitleHy);
    if (createLink.trim()) fd.append("link_url", createLink.trim());
    fd.append("sort_order", String(parseInt(createSort, 10) || 0));
    setBusyId(-1);
    try {
      await apiCreatePlatformBanner(token, fd);
      setCreateFile(null);
      setCreateTitleEn("");
      setCreateTitleRu("");
      setCreateTitleHy("");
      setCreateLink("");
      setCreateSort("0");
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : "Create failed");
    } finally {
      setBusyId(null);
    }
  }

  async function submitEdit() {
    if (!token || !editing) return;
    const fd = new FormData();
    if (editFile) fd.append("image", editFile);
    fd.append("title_en", editTitleEn);
    fd.append("title_ru", editTitleRu);
    fd.append("title_hy", editTitleHy);
    if (editLink.trim()) fd.append("link_url", editLink.trim());
    fd.append("sort_order", String(parseInt(editSort, 10) || 0));
    setBusyId(editing.id);
    try {
      await apiUpdatePlatformBanner(token, editing.id, fd);
      setEditing(null);
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : "Update failed");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: number) {
    if (!token) return;
    if (!window.confirm("Delete this banner?")) return;
    setBusyId(id);
    try {
      await apiDeletePlatformBanner(token, id);
      if (editing?.id === id) setEditing(null);
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : "Delete failed");
    } finally {
      setBusyId(null);
    }
  }

  if (!allowed || forbidden) {
    return (
      <div>
        <h1 className="text-xl font-semibold">Banners</h1>
        <div className="mt-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-semibold">Banner CMS</h1>
      <p className="mt-1 text-sm text-slate-700">
        GET|POST|PATCH|DELETE /api/platform-admin/banners* | multipart image on create / optional on update
      </p>
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}

      <section className="mt-6 rounded border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold">Create banner</h2>
        <div className="mt-3 grid max-w-xl gap-2 text-sm">
          <label className="block">
            Image (required)
            <input
              type="file"
              accept="image/jpeg,image/png,image/jpg,image/webp"
              onChange={(e) => setCreateFile(e.target.files?.[0] ?? null)}
              className="mt-1 block w-full text-xs"
            />
          </label>
          <label>
            title_en
            <input
              value={createTitleEn}
              onChange={(e) => setCreateTitleEn(e.target.value)}
              className="ml-2 w-full max-w-md rounded border border-slate-300 px-2 py-1"
            />
          </label>
          <label>
            title_ru
            <input
              value={createTitleRu}
              onChange={(e) => setCreateTitleRu(e.target.value)}
              className="ml-2 w-full max-w-md rounded border border-slate-300 px-2 py-1"
            />
          </label>
          <label>
            title_hy
            <input
              value={createTitleHy}
              onChange={(e) => setCreateTitleHy(e.target.value)}
              className="ml-2 w-full max-w-md rounded border border-slate-300 px-2 py-1"
            />
          </label>
          <label>
            link_url
            <input
              value={createLink}
              onChange={(e) => setCreateLink(e.target.value)}
              className="ml-2 w-full max-w-md rounded border border-slate-300 px-2 py-1"
            />
          </label>
          <label>
            sort_order
            <input
              value={createSort}
              onChange={(e) => setCreateSort(e.target.value)}
              className="ml-2 w-24 rounded border border-slate-300 px-2 py-1 tabular-nums"
            />
          </label>
          <button
            type="button"
            disabled={busyId !== null}
            onClick={() => submitCreate()}
            className="w-fit rounded border border-slate-300 bg-slate-100 px-3 py-1 text-sm disabled:opacity-40"
          >
            Create
          </button>
        </div>
      </section>

      {editing && (
        <section className="mt-6 rounded border border-amber-200 bg-amber-50/50 p-4">
          <h2 className="text-sm font-semibold">Edit banner #{editing.id}</h2>
          <div className="mt-3 grid max-w-xl gap-2 text-sm">
            <label className="block">
              New image (optional)
              <input
                type="file"
                accept="image/jpeg,image/png,image/jpg,image/webp"
                onChange={(e) => setEditFile(e.target.files?.[0] ?? null)}
                className="mt-1 block w-full text-xs"
              />
            </label>
            <label>
              title_en
              <input
                value={editTitleEn}
                onChange={(e) => setEditTitleEn(e.target.value)}
                className="ml-2 w-full max-w-md rounded border border-slate-300 px-2 py-1"
              />
            </label>
            <label>
              title_ru
              <input
                value={editTitleRu}
                onChange={(e) => setEditTitleRu(e.target.value)}
                className="ml-2 w-full max-w-md rounded border border-slate-300 px-2 py-1"
              />
            </label>
            <label>
              title_hy
              <input
                value={editTitleHy}
                onChange={(e) => setEditTitleHy(e.target.value)}
                className="ml-2 w-full max-w-md rounded border border-slate-300 px-2 py-1"
              />
            </label>
            <label>
              link_url
              <input
                value={editLink}
                onChange={(e) => setEditLink(e.target.value)}
                className="ml-2 w-full max-w-md rounded border border-slate-300 px-2 py-1"
              />
            </label>
            <label>
              sort_order
              <input
                value={editSort}
                onChange={(e) => setEditSort(e.target.value)}
                className="ml-2 w-24 rounded border border-slate-300 px-2 py-1 tabular-nums"
              />
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busyId !== null}
                onClick={() => submitEdit()}
                className="rounded border border-slate-300 bg-white px-3 py-1 text-sm disabled:opacity-40"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded border border-slate-300 bg-white px-3 py-1 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </section>
      )}

      <div className="mt-6 overflow-x-auto rounded border border-slate-200 bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-100 text-xs uppercase text-slate-700">
            <tr>
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">Preview</th>
              <th className="px-3 py-2">Titles</th>
              <th className="px-3 py-2">Link</th>
              <th className="px-3 py-2">Sort</th>
              <th className="px-3 py-2">Active</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const src = resolveBannerImageSrc(r);
              return (
                <tr key={r.id} className="border-b border-slate-100 align-top">
                  <td className="px-3 py-2 tabular-nums">{r.id}</td>
                  <td className="px-3 py-2">
                    {src ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={src} alt="" className="h-14 w-28 object-cover" />
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="max-w-xs px-3 py-2 text-xs text-slate-700">
                    en: {r.title_en ?? "-"}
                    <br />
                    ru: {r.title_ru ?? "-"}
                    <br />
                    hy: {r.title_hy ?? "-"}
                  </td>
                  <td className="max-w-[140px] truncate px-3 py-2 text-xs">
                    {r.link_url ?? "-"}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{r.sort_order}</td>
                  <td className="px-3 py-2">{r.is_active ? "yes" : "no"}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-col gap-1">
                      <button
                        type="button"
                        disabled={busyId !== null}
                        onClick={() => openEdit(r)}
                        className="text-left text-xs text-slate-700 underline disabled:opacity-40"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        onClick={() => remove(r.id)}
                        className="text-left text-xs text-red-700 underline disabled:opacity-40"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
