"use client";

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { PaginationBar } from "@/components/PaginationBar";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import type { ApiListMeta } from "@/lib/api-envelope";
import { apiModerateReview, apiPlatformReviews, type PlatformReviewRow } from "@/lib/platform-admin-api";
import { useCallback, useEffect, useState } from "react";

const MOD_STATUSES = ["published", "hidden", "rejected"] as const;

export default function PlatformReviewsPage() {
  const { token, user } = useAdminAuth();
  const allowed = canAccessPlatformAdminNav(user);
  const [rows, setRows] = useState<PlatformReviewRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!token || !allowed) return;
    setErr(null);
    setForbidden(false);
    try {
      const res = await apiPlatformReviews(token, {
        page,
        per_page: 20,
        status: statusFilter || undefined,
      });
      setRows(res.data);
      setMeta(res.meta);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : "Failed to load reviews");
    }
  }, [token, allowed, page, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  async function moderate(id: number, status: (typeof MOD_STATUSES)[number]) {
    if (!token) return;
    const notes = window.prompt("Optional moderation notes") ?? "";
    setBusyId(id);
    try {
      await apiModerateReview(token, id, {
        status,
        notes: notes.trim() || null,
      });
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : "Moderation failed");
    } finally {
      setBusyId(null);
    }
  }

  if (!allowed) {
    return (
      <div>
        <h1 className="text-xl font-semibold">Reviews</h1>
        <div className="mt-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  if (forbidden) {
    return (
      <div>
        <h1 className="text-xl font-semibold">Reviews</h1>
        <div className="mt-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-semibold">Reviews moderation</h1>
      <p className="mt-1 text-sm text-zinc-500">
        GET /api/platform-admin/reviews · POST /api/platform-admin/reviews/{"{id}"}/moderate
      </p>
      <div className="mt-4">
        <label className="text-sm text-zinc-600">
          Status filter
          <select
            value={statusFilter}
            onChange={(e) => {
              setPage(1);
              setStatusFilter(e.target.value);
            }}
            className="ml-2 rounded border border-zinc-300 px-2 py-1 text-sm"
          >
            <option value="">All</option>
            <option value="pending">pending</option>
            <option value="published">published</option>
            <option value="hidden">hidden</option>
            <option value="rejected">rejected</option>
          </select>
        </label>
      </div>
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      <div className="mt-4 overflow-x-auto rounded border border-zinc-200 bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">Rating</th>
              <th className="px-3 py-2">Text</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Target</th>
              <th className="px-3 py-2">User</th>
              <th className="px-3 py-2">Moderate</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-zinc-100 align-top">
                <td className="px-3 py-2 tabular-nums">{r.id}</td>
                <td className="px-3 py-2">{r.rating}</td>
                <td className="max-w-xs px-3 py-2 text-xs text-zinc-700">
                  {(r.review_text ?? "").slice(0, 200)}
                  {(r.review_text?.length ?? 0) > 200 ? "…" : ""}
                </td>
                <td className="px-3 py-2">{r.status}</td>
                <td className="px-3 py-2 text-xs">
                  {r.target_entity_type} #{r.target_entity_id}
                </td>
                <td className="px-3 py-2 text-xs">{r.user?.name ?? "—"}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-col gap-1">
                    {MOD_STATUSES.map((s) => (
                      <button
                        key={s}
                        type="button"
                        disabled={busyId === r.id}
                        onClick={() => moderate(r.id, s)}
                        className="text-left text-xs text-zinc-700 underline disabled:opacity-40"
                      >
                        Set {s}
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {meta && <PaginationBar meta={meta} onPage={setPage} />}
    </div>
  );
}
