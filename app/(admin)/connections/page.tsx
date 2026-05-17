"use client";

/** Phase-2 migration to shared @/components/ui primitives. */

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
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Button,
  Checkbox,
  FormField,
  Input,
  PageHeader,
  Select,
  StatusPill,
  Table,
  TBody,
  TD,
  TEmpty,
  TH,
  THead,
  TR,
} from "@/components/ui";
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
  const { t } = useLanguage();
  const allowed = canAccessConnectionsNav(user);
  const isSuper = user?.is_super_admin === true;
  const canCreate = (user?.companies?.length ?? 0) > 0;

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
      else setErr(e instanceof ApiRequestError ? e.message : t("admin.connections.err_load"));
    } finally {
      setLoading(false);
    }
  }, [token, allowed, page, statusFilter, sourceTypeFilter, targetTypeFilter, companyIdParam, t]);

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
          e instanceof ApiRequestError ? e.message : t("admin.connections.err_load_clients")
        );
      })
      .finally(() => setClientsBusy(false));
  }, [token, createOpen, actorCompanyId, t]);

  const onAction = async (id: number, action: "accept" | "reject" | "cancel") => {
    if (!token) return;
    setBusyId(id);
    setErr(null);
    try {
      if (action === "accept") await apiConnectionAccept(token, id);
      else if (action === "reject") {
        const input = window.prompt(t("admin.connections.prompt_notes_required_reject"), "") ?? null;
        const notes = input?.trim() ? input.trim() : null;
        if (!notes) {
          setErr(t("admin.connections.err_notes_required_reject"));
          return;
        }
        await apiConnectionReject(token, id, notes);
      } else {
        const input = window.prompt(t("admin.connections.prompt_notes_optional"), "") ?? null;
        const notes = input?.trim() ? input.trim() : undefined;
        try {
          await apiConnectionCancel(token, id, notes);
        } catch (e) {
          if (
            e instanceof ApiRequestError &&
            e.status === 422 &&
            e.message.toLowerCase().includes("notes")
          ) {
            const retry =
              window.prompt(t("admin.connections.prompt_notes_required_cancel"), "") ?? null;
            const retryNotes = retry?.trim() ? retry.trim() : null;
            if (!retryNotes) {
              setErr(t("admin.connections.err_notes_required_cancel"));
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
      setErr(e instanceof ApiRequestError ? e.message : t("admin.connections.err_update"));
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
      setErr(t("admin.connections.err_select_client_required"));
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
      setErr(ce instanceof ApiRequestError ? ce.message : t("admin.connections.err_create"));
    } finally {
      setCreateBusy(false);
    }
  };

  if (!allowed || forbidden) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">{t("admin.connections.title")}</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  const statusOptions = ["", "pending", "accepted", "rejected", "canceled"] as const;

  return (
    <div className="space-y-6">
      <PageHeader title={t("admin.connections.title")} />

      {canCreate && (
        <section className="admin-card p-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCreateOpen((o) => !o)}
          >
            {createOpen
              ? t("admin.connections.hide_create_form")
              : t("admin.connections.create_connection")}
          </Button>

          {createOpen && (
            <form onSubmit={onCreate} className="mt-3 grid max-w-xl gap-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <FormField label={t("admin.connections.source_type")} htmlFor="conn-st">
                  <Select
                    id="conn-st"
                    fieldSize="sm"
                    value={createForm.source_type}
                    onChange={(e) =>
                      setCreateForm((f) => ({ ...f, source_type: e.target.value }))
                    }
                  >
                    {CONNECTION_SOURCE_TYPES.map((tt) => (
                      <option key={tt} value={tt}>
                        {tt}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField label={t("admin.connections.source_id")} htmlFor="conn-sid">
                  <Input
                    id="conn-sid"
                    type="number"
                    required
                    min={1}
                    value={createForm.source_id || ""}
                    onChange={(e) =>
                      setCreateForm((f) => ({ ...f, source_id: Number(e.target.value) }))
                    }
                  />
                </FormField>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField label={t("admin.connections.target_type")} htmlFor="conn-tt">
                  <Select
                    id="conn-tt"
                    fieldSize="sm"
                    value={createForm.target_type}
                    onChange={(e) =>
                      setCreateForm((f) => ({ ...f, target_type: e.target.value }))
                    }
                  >
                    {CONNECTION_TARGET_TYPES.map((tt) => (
                      <option key={tt} value={tt}>
                        {tt}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField label={t("admin.connections.target_id")} htmlFor="conn-tid">
                  <Input
                    id="conn-tid"
                    type="number"
                    required
                    min={1}
                    value={createForm.target_id || ""}
                    onChange={(e) =>
                      setCreateForm((f) => ({ ...f, target_id: Number(e.target.value) }))
                    }
                  />
                </FormField>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField label={t("admin.connections.connection_type")} htmlFor="conn-ct">
                  <Select
                    id="conn-ct"
                    fieldSize="sm"
                    value={createForm.connection_type}
                    onChange={(e) =>
                      setCreateForm((f) => ({
                        ...f,
                        connection_type: e.target
                          .value as ConnectionCreateBody["connection_type"],
                      }))
                    }
                  >
                    <option value="only">{t("admin.connections.connection_type_only")}</option>
                    <option value="both">{t("admin.connections.connection_type_both")}</option>
                  </Select>
                </FormField>
                <FormField label={t("admin.connections.client_targeting")} htmlFor="conn-tg">
                  <Select
                    id="conn-tg"
                    fieldSize="sm"
                    value={createForm.client_targeting ?? "all"}
                    onChange={(e) =>
                      setCreateForm((f) => ({
                        ...f,
                        client_targeting: e.target.value as "all" | "selected",
                        selected_client_ids:
                          e.target.value === "selected" ? f.selected_client_ids ?? [] : [],
                      }))
                    }
                  >
                    <option value="all">{t("admin.connections.targeting_all")}</option>
                    <option value="selected">{t("admin.connections.targeting_selected")}</option>
                  </Select>
                </FormField>
              </div>
              {createForm.client_targeting === "selected" && (
                <div className="rounded-zulu border border-default p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-xs text-fg-t7">
                      {t("admin.connections.selected_clients")}
                    </p>
                    <Input
                      placeholder={t("admin.connections.search_clients_placeholder")}
                      value={clientQuery}
                      onChange={(e) => setClientQuery(e.target.value)}
                      className="w-56"
                    />
                  </div>
                  {clientsBusy ? (
                    <p className="text-xs text-fg-t6">
                      {t("admin.connections.loading_clients")}
                    </p>
                  ) : clientLoadError ? (
                    <p className="text-xs text-error-600">{clientLoadError}</p>
                  ) : clientOptions.length === 0 ? (
                    <p className="text-xs text-fg-t6">
                      {t("admin.connections.empty_company_clients")}
                    </p>
                  ) : (
                    <div className="max-h-48 overflow-y-auto rounded-zulu border border-default p-2">
                      {clientOptions
                        .filter((c) => {
                          const q = clientQuery.trim().toLowerCase();
                          if (!q) return true;
                          return (
                            c.name.toLowerCase().includes(q) ||
                            c.email.toLowerCase().includes(q)
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
                              <Checkbox
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
              <FormField label={t("admin.connections.notes_optional")} htmlFor="conn-notes">
                <Input
                  id="conn-notes"
                  value={createForm.notes ?? ""}
                  onChange={(e) => setCreateForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </FormField>
              <div>
                <Button type="submit" size="sm" disabled={createBusy}>
                  {createBusy
                    ? t("admin.connections.creating")
                    : t("admin.connections.submit")}
                </Button>
              </div>
            </form>
          )}
        </section>
      )}

      <div className="admin-card p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {statusOptions.map((s) => (
            <Button
              key={s || "all"}
              size="sm"
              variant={statusFilter === s ? "primary" : "outline"}
              onClick={() => {
                setPage(1);
                setStatusFilter(s);
              }}
            >
              {s === "" ? t("common.all") : t(`admin.connections.status_${s}`)}
            </Button>
          ))}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setPage(1);
              setStatusFilter("");
              setSourceTypeFilter("");
              setTargetTypeFilter("");
              setCompanyIdFilter("");
            }}
          >
            {t("admin.connections.reset_filters")}
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <FormField label={t("admin.connections.source_type")} htmlFor="conn-fst">
            <Select
              id="conn-fst"
              fieldSize="sm"
              value={sourceTypeFilter}
              onChange={(e) => {
                setPage(1);
                setSourceTypeFilter(e.target.value);
              }}
            >
              <option value="">{t("common.all")}</option>
              {CONNECTION_SOURCE_TYPES.map((tt) => (
                <option key={tt} value={tt}>
                  {tt}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label={t("admin.connections.target_type")} htmlFor="conn-ftt">
            <Select
              id="conn-ftt"
              fieldSize="sm"
              value={targetTypeFilter}
              onChange={(e) => {
                setPage(1);
                setTargetTypeFilter(e.target.value);
              }}
            >
              <option value="">{t("common.all")}</option>
              {CONNECTION_TARGET_TYPES.map((tt) => (
                <option key={tt} value={tt}>
                  {tt}
                </option>
              ))}
            </Select>
          </FormField>
          {isSuper && (
            <FormField label={t("admin.connections.company_id")} htmlFor="conn-fco">
              <Input
                id="conn-fco"
                type="number"
                min={1}
                placeholder={t("admin.connections.optional")}
                value={companyIdFilter}
                onChange={(e) => {
                  setPage(1);
                  setCompanyIdFilter(e.target.value);
                }}
              />
            </FormField>
          )}
        </div>
      </div>

      {err && (
        <div className="rounded-zulu border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">
          {err}
        </div>
      )}

      <Table>
        <THead>
          <TR>
            <TH>{t("admin.crud.common.id")}</TH>
            <TH>{t("admin.connections.source")}</TH>
            <TH>{t("admin.connections.target")}</TH>
            <TH>{t("admin.connections.type")}</TH>
            <TH>{t("admin.connections.status")}</TH>
            <TH>{t("admin.connections.company")}</TH>
            <TH>{t("admin.connections.client_targeting")}</TH>
            <TH>{t("admin.connections.created")}</TH>
            <TH>{t("admin.connections.actions")}</TH>
          </TR>
        </THead>
        <TBody>
          {loading ? (
            <TEmpty colSpan={9}>{t("admin.connections.loading")}</TEmpty>
          ) : rows.length === 0 ? (
            <TEmpty colSpan={9}>{t("admin.connections.empty")}</TEmpty>
          ) : (
            rows.map((c) => (
              <TR key={c.id}>
                <TD className="tabular-nums font-medium">{c.id}</TD>
                <TD>{entityLabel(c.source_type, c.source_id)}</TD>
                <TD>{entityLabel(c.target_type, c.target_id)}</TD>
                <TD>{c.connection_type ?? "-"}</TD>
                <TD>
                  <StatusPill status={c.status ?? ""}>{c.status ?? "-"}</StatusPill>
                </TD>
                <TD className="max-w-[160px] truncate">{companyLabel(c)}</TD>
                <TD className="text-xs">
                  {c.client_targeting === "selected"
                    ? t("admin.connections.targeting_selected")
                    : t("admin.connections.targeting_all")}
                </TD>
                <TD className="text-xs whitespace-nowrap">
                  {c.created_at ? String(c.created_at).slice(0, 10) : "-"}
                </TD>
                <TD>
                  <div className="flex flex-wrap gap-1">
                    {c.status === "pending" && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busyId === c.id}
                          onClick={() => onAction(c.id, "accept")}
                        >
                          {t("admin.connections.accept")}
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={busyId === c.id}
                          onClick={() => onAction(c.id, "reject")}
                        >
                          {t("admin.connections.reject")}
                        </Button>
                      </>
                    )}
                    {(c.status === "pending" || c.status === "accepted") && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busyId === c.id}
                        onClick={() => onAction(c.id, "cancel")}
                      >
                        {t("admin.connections.cancel")}
                      </Button>
                    )}
                  </div>
                </TD>
              </TR>
            ))
          )}
        </TBody>
      </Table>

      {meta && !loading && <PaginationBar meta={meta} onPage={setPage} />}

      <p className="text-xs text-fg-t7">
        {t("admin.connections.footer_help_prefix")}{" "}
        <code className="text-[11px]">company_id</code>.{" "}
        {t("admin.connections.footer_help_suffix")}{" "}
        (<code className="text-[11px]">POST /api/connections</code>).
      </p>
    </div>
  );
}
