"use client";

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { PaginationBar } from "@/components/PaginationBar";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { canAccessConnectionsNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import type { ApiListMeta } from "@/lib/api-envelope";
import {
  apiConnectionAccept,
  apiConnectionCancel,
  apiCompanyClients,
  apiConnectionCreate,
  apiConnectionReject,
  apiConnectionsList,
  type CompanyClientOption,
  CONNECTION_SOURCE_TYPES,
  CONNECTION_TARGET_TYPES,
  type ConnectionCreateBody,
  type ConnectionRow,
} from "@/lib/connections-api";
import { useCallback, useEffect, useState } from "react";

function companyLabel(c: ConnectionRow): string {
  return c.company?.name ?? (c.company_id != null ? String(c.company_id) : "-");
}

function entityLabel(type: string | undefined, id: number | undefined): string {
  if (!type || id == null) return "-";
  return `${type} #${id}`;
}

export default function ConnectionsPage() {
  const { token, user } = useAdminAuth();
  const allowed = canAccessConnectionsNav(user);
  const isSuper = user?.is_super_admin === true;
  const canCreate =
    (user?.companies?.length ?? 0) > 0;

  const [rows, setRows] = useState<ConnectionRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [sourceTypeFilter, setSourceTypeFilter] = useState("");
  const [targetTypeFilter, setTargetTypeFilter] = useState("");
  const [companyIdFilter, setCompanyIdFilter] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [createBusy, setCreateBusy] = useState(false);
  const [clientsBusy, setClientsBusy] = useState(false);
  const [clientOptions, setClientOptions] = useState<CompanyClientOption[]>([]);
  const [clientQuery, setClientQuery] = useState("");
  const [clientLoadError, setClientLoadError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<ConnectionCreateBody>({
    source_type: "flight",
    source_id: 0,
    target_type: "hotel",
    target_id: 0,
    connection_type: "only",
    client_targeting: "all",
    selected_client_ids: [],
    notes: "",
  });
  const actorCompanyId = user?.companies?.[0]?.id ?? null;

  const companyIdNum =
    companyIdFilter.trim() === "" ? undefined : Number(companyIdFilter);
  const companyIdParam =
    isSuper && companyIdNum !== undefined && Number.isFinite(companyIdNum) && companyIdNum > 0
      ? companyIdNum
      : undefined;

  const load = useCallback(async () => {
    if (!token || !allowed) return;
    setErr(null);
    setForbidden(false);
    setLoading(true);
    try {
      const res = await apiConnectionsList(token, {
        page,
        per_page: 20,
        status: statusFilter || undefined,
        source_type: sourceTypeFilter || undefined,
        target_type: targetTypeFilter || undefined,
        company_id: companyIdParam,
      });
      setRows(res.data);
      setMeta(res.meta);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : "Failed to load connections");
    } finally {
      setLoading(false);
    }
  }, [token, allowed, page, statusFilter, sourceTypeFilter, targetTypeFilter, companyIdParam]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!token || !createOpen || !actorCompanyId) return;
    setClientsBusy(true);
    setClientLoadError(null);
    apiCompanyClients(token, actorCompanyId)
      .then((res) => setClientOptions(res.data ?? []))
      .catch((e) => {
        setClientLoadError(
          e instanceof ApiRequestError ? e.message : "Failed to load company clients"
        );
      })
      .finally(() => setClientsBusy(false));
  }, [token, createOpen, actorCompanyId]);

  const onAction = async (id: number, action: "accept" | "reject" | "cancel") => {
    if (!token) return;
    setBusyId(id);
    setErr(null);
    try {
      if (action === "accept") await apiConnectionAccept(token, id);
      else if (action === "reject") {
        const input = window.prompt("Notes (required for rejection):", "") ?? null;
        const notes = input?.trim() ? input.trim() : null;
        if (!notes) {
          setErr("Notes are required for rejection.");
          return;
        }
        await apiConnectionReject(token, id, notes);
      } else {
        const input = window.prompt("Notes (optional):", "") ?? null;
        const notes = input?.trim() ? input.trim() : undefined;
        try {
          await apiConnectionCancel(token, id, notes);
        } catch (e) {
          // If API requires notes for cancel (feature/config), re-prompt once.
          if (e instanceof ApiRequestError && e.status === 422 && e.message.toLowerCase().includes("notes")) {
            const retry = window.prompt("Notes (required to cancel):", "") ?? null;
            const retryNotes = retry?.trim() ? retry.trim() : null;
            if (!retryNotes) {
              setErr("Notes are required to cancel.");
              return;
            }
            await apiConnectionCancel(token, id, retryNotes);
          } else {
            throw e;
          }
        }
      }
      await load();
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : "Failed to update connection");
    } finally {
      setBusyId(null);
    }
  };

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setCreateBusy(true);
    setErr(null);
    const body: ConnectionCreateBody = {
      source_type: createForm.source_type,
      source_id: Number(createForm.source_id),
      target_type: createForm.target_type,
      target_id: Number(createForm.target_id),
      connection_type: createForm.connection_type,
      targeting: {
        mode: createForm.client_targeting ?? "all",
        client_ids:
          createForm.client_targeting === "selected"
            ? Array.from(new Set((createForm.selected_client_ids ?? []).filter((id) => id > 0)))
            : undefined,
      },
      notes: createForm.notes?.trim() ? createForm.notes.trim() : undefined,
    };
    if (body.targeting?.mode === "selected" && (body.targeting.client_ids?.length ?? 0) === 0) {
      setErr("When client targeting is selected, choose at least one client.");
      setCreateBusy(false);
      return;
    }
    try {
      await apiConnectionCreate(token, body);
      setCreateForm((f) => ({
        ...f,
        source_id: 0,
        target_id: 0,
        selected_client_ids: [],
        notes: "",
      }));
      setPage(1);
      await load();
    } catch (ce) {
      setErr(ce instanceof ApiRequestError ? ce.message : "Failed to create connection");
    } finally {
      setCreateBusy(false);
    }
  };

  if (!allowed) {
    return (
      <div>
        <h1 className="admin-page-title">Service connections</h1>
        <div className="mt-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  if (forbidden) {
    return (
      <div>
        <h1 className="admin-page-title">Service connections</h1>
        <div className="mt-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="admin-page-title">Service connections</h1>

      {canCreate && (
        <div className="mt-4 rounded border border-default bg-white p-4">
          <button
            type="button"
            onClick={() => setCreateOpen((o) => !o)}
            className="text-sm font-medium text-fg-t11 underline"
          >
            {createOpen ? "Hide create form" : "Create connection"}
          </button>
          {createOpen && (
            <form onSubmit={onCreate} className="mt-3 grid max-w-xl gap-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <label className="text-fg-t6">
                  Source type
                  <select
                    value={createForm.source_type}
                    onChange={(e) =>
                      setCreateForm((f) => ({ ...f, source_type: e.target.value }))
                    }
                    className="mt-1 w-full rounded border border-default px-2 py-1"
                  >
                    {CONNECTION_SOURCE_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-fg-t6">
                  Source ID
                  <input
                    type="number"
                    required
                    min={1}
                    value={createForm.source_id || ""}
                    onChange={(e) =>
                      setCreateForm((f) => ({ ...f, source_id: Number(e.target.value) }))
                    }
                    className="mt-1 w-full rounded border border-default px-2 py-1"
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-fg-t6">
                  Target type
                  <select
                    value={createForm.target_type}
                    onChange={(e) =>
                      setCreateForm((f) => ({ ...f, target_type: e.target.value }))
                    }
                    className="mt-1 w-full rounded border border-default px-2 py-1"
                  >
                    {CONNECTION_TARGET_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-fg-t6">
                  Target ID
                  <input
                    type="number"
                    required
                    min={1}
                    value={createForm.target_id || ""}
                    onChange={(e) =>
                      setCreateForm((f) => ({ ...f, target_id: Number(e.target.value) }))
                    }
                    className="mt-1 w-full rounded border border-default px-2 py-1"
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-fg-t6">
                  Connection type
                  <select
                    value={createForm.connection_type}
                    onChange={(e) =>
                      setCreateForm((f) => ({
                        ...f,
                        connection_type: e.target.value as ConnectionCreateBody["connection_type"],
                      }))
                    }
                    className="mt-1 w-full rounded border border-default px-2 py-1"
                  >
                    <option value="only">only</option>
                    <option value="both">both</option>
                  </select>
                </label>
                <label className="text-fg-t6">
                  Client targeting
                  <select
                    value={createForm.client_targeting ?? "all"}
                    onChange={(e) =>
                      setCreateForm((f) => ({
                        ...f,
                        client_targeting: e.target.value as "all" | "selected",
                        selected_client_ids:
                          e.target.value === "selected" ? f.selected_client_ids ?? [] : [],
                      }))
                    }
                    className="mt-1 w-full rounded border border-default px-2 py-1"
                  >
                    <option value="all">all</option>
                    <option value="selected">selected</option>
                  </select>
                </label>
              </div>
              {createForm.client_targeting === "selected" && (
                <div className="rounded border border-default p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-fg-t7">Selected clients</p>
                    <input
                      type="text"
                      placeholder="Search by name/email"
                      value={clientQuery}
                      onChange={(e) => setClientQuery(e.target.value)}
                      className="w-56 rounded border border-default px-2 py-1 text-xs"
                    />
                  </div>
                  {clientsBusy ? (
                    <p className="text-xs text-fg-t6">Loading clients...</p>
                  ) : clientLoadError ? (
                    <p className="text-xs text-error-600">{clientLoadError}</p>
                  ) : clientOptions.length === 0 ? (
                    <p className="text-xs text-fg-t6">No company clients found.</p>
                  ) : (
                    <div className="max-h-48 overflow-y-auto rounded border border-default p-2">
                      {clientOptions
                        .filter((c) => {
                          const q = clientQuery.trim().toLowerCase();
                          if (!q) return true;
                          return (
                            c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)
                          );
                        })
                        .map((c) => {
                          const checked = (createForm.selected_client_ids ?? []).includes(c.id);
                          return (
                            <label
                              key={c.id}
                              className="flex cursor-pointer items-center justify-between gap-3 py-1 text-xs"
                            >
                              <span className="truncate text-fg-t7">
                                {c.name} ({c.email})
                              </span>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) =>
                                  setCreateForm((f) => {
                                    const prev = new Set(f.selected_client_ids ?? []);
                                    if (e.target.checked) prev.add(c.id);
                                    else prev.delete(c.id);
                                    return { ...f, selected_client_ids: Array.from(prev) };
                                  })
                                }
                              />
                            </label>
                          );
                        })}
                    </div>
                  )}
                </div>
              )}
              <label className="text-fg-t6">
                Notes (optional)
                <input
                  type="text"
                  value={createForm.notes ?? ""}
                  onChange={(e) => setCreateForm((f) => ({ ...f, notes: e.target.value }))}
                  className="mt-1 w-full rounded border border-default px-2 py-1"
                />
              </label>
              <div>
                <button
                  type="submit"
                  disabled={createBusy}
                  className="admin-btn-primary"
                >
                  {createBusy ? "Creating..." : "Submit"}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-end gap-3 text-sm">
        <div className="flex flex-wrap gap-2">
          {(["", "pending", "accepted", "rejected", "canceled"] as const).map((s) => (
            <button
              key={s || "all"}
              type="button"
              onClick={() => {
                setPage(1);
                setStatusFilter(s);
              }}
              className={
                "rounded border px-2 py-1 " +
                (statusFilter === s ? "border-primary bg-primary text-white" : "border-default bg-white")
              }
            >
              {s === "" ? "All" : s}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            setPage(1);
            setStatusFilter("");
            setSourceTypeFilter("");
            setTargetTypeFilter("");
            setCompanyIdFilter("");
          }}
          className="rounded border border-default bg-white px-2 py-1"
        >
          Reset filters
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-4 text-sm">
        <label className="text-fg-t6">
          Source type
          <select
            value={sourceTypeFilter}
            onChange={(e) => {
              setPage(1);
              setSourceTypeFilter(e.target.value);
            }}
            className="ml-2 rounded border border-default px-2 py-1"
          >
            <option value="">All</option>
            {CONNECTION_SOURCE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="text-fg-t6">
          Target type
          <select
            value={targetTypeFilter}
            onChange={(e) => {
              setPage(1);
              setTargetTypeFilter(e.target.value);
            }}
            className="ml-2 rounded border border-default px-2 py-1"
          >
            <option value="">All</option>
            {CONNECTION_TARGET_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        {isSuper && (
          <label className="text-fg-t6">
            Company ID
            <input
              type="number"
              min={1}
              placeholder="optional"
              value={companyIdFilter}
              onChange={(e) => {
                setPage(1);
                setCompanyIdFilter(e.target.value);
              }}
              className="ml-2 w-28 rounded border border-default px-2 py-1"
            />
          </label>
        )}
      </div>

      {err && <p className="mt-2 text-sm text-error-600">{err}</p>}

      <div className="mt-4 overflow-x-auto rounded border border-default bg-white">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b border-default bg-figma-bg-1 text-xs uppercase text-fg-t7">
            <tr>
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">Source</th>
              <th className="px-3 py-2">Target</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Company</th>
              <th className="px-3 py-2">Client targeting</th>
              <th className="px-3 py-2">Created</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-fg-t7">
                  Loading...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-fg-t7">
                  No connections found
                </td>
              </tr>
            ) : (
              rows.map((c) => (
                <tr key={c.id} className="border-b border-default">
                  <td className="px-3 py-2 tabular-nums font-medium">{c.id}</td>
                  <td className="px-3 py-2">{entityLabel(c.source_type, c.source_id)}</td>
                  <td className="px-3 py-2">{entityLabel(c.target_type, c.target_id)}</td>
                  <td className="px-3 py-2">{c.connection_type ?? "-"}</td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        "rounded px-1.5 py-0.5 text-xs " +
                        (c.status === "pending"
                          ? "bg-warning-50 text-amber-900"
                          : c.status === "accepted"
                            ? "bg-emerald-100 text-emerald-900"
                            : c.status === "rejected"
                              ? "bg-error-50 text-error-800"
                              : "bg-figma-bg-1 text-fg-t7")
                      }
                    >
                      {c.status ?? "-"}
                    </span>
                  </td>
                  <td className="max-w-[160px] truncate px-3 py-2">{companyLabel(c)}</td>
                  <td className="px-3 py-2">{c.client_targeting === "selected" ? "selected" : "all"}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-fg-t7">
                    {c.created_at ? String(c.created_at).slice(0, 10) : "-"}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {c.status === "pending" && (
                        <>
                          <button
                            type="button"
                            disabled={busyId === c.id}
                            onClick={() => onAction(c.id, "accept")}
                            className="rounded border border-emerald-600 px-2 py-0.5 text-emerald-800 disabled:opacity-40"
                          >
                            Accept
                          </button>
                          <button
                            type="button"
                            disabled={busyId === c.id}
                            onClick={() => onAction(c.id, "reject")}
                            className="rounded border border-red-500 px-2 py-0.5 text-error-700 disabled:opacity-40"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {(c.status === "pending" || c.status === "accepted") && (
                        <button
                          type="button"
                          disabled={busyId === c.id}
                          onClick={() => onAction(c.id, "cancel")}
                          className="rounded border border-default px-2 py-0.5 text-fg-t7 disabled:opacity-40"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {meta && !loading && <PaginationBar meta={meta} onPage={setPage} />}

      <p className="mt-3 text-xs text-fg-t7">
        Filters mirror Blade admin: status, source_type, target_type. Super admins may narrow by{" "}
        <code className="text-[11px]">company_id</code>. Create assigns the actor&apos;s first company
        per API (<code className="text-[11px]">POST /api/connections</code>).
      </p>
    </div>
  );
}
