"use client";

/** Phase-2 migration to shared @/components/ui primitives. */

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { PaginationBar } from "@/components/PaginationBar";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { canAccessConnectionsNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import { exportRowsAsCsv } from "@/lib/export-csv";
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
import { usePrompt } from "@/contexts/PromptDialogContext";
import {
  Badge,
  type BadgeTone,
  Button,
  Checkbox,
  FormField,
  Input,
  Select,
  Table,
  TBody,
  TD,
  TEmpty,
  TH,
  THead,
  TR,
} from "@/components/ui";
import {
  PageHeader as V2PageHeader,

  V2Button,
  V2Card,
} from "@/components/ui/v2";
import { SettingsSubgroupTabs } from "@/components/settings/SettingsSubgroupTabs";
import { Download, Plus } from "lucide-react";
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
  const prompt = usePrompt();
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
    void load();
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
        const notes = await prompt({
          title: t("admin.connections.action.reject"),
          placeholder: t("admin.connections.prompt_notes_required_reject"),
          required: true,
          minLength: 3,
          variant: "danger",
        });
        if (notes === null) {
          setBusyId(null);
          return;
        }
        await apiConnectionReject(token, id, notes);
      } else {
        const notes = await prompt({
          title: t("admin.connections.action.cancel"),
          placeholder: t("admin.connections.prompt_notes_optional"),
        });
        if (notes === null) {
          setBusyId(null);
          return;
        }
        try {
          await apiConnectionCancel(token, id, notes || undefined);
        } catch (e) {
          if (
            e instanceof ApiRequestError &&
            e.status === 422 &&
            e.message.toLowerCase().includes("notes")
          ) {
            const retryNotes = await prompt({
              title: t("admin.connections.action.cancel"),
              placeholder: t("admin.connections.prompt_notes_required_cancel"),
              required: true,
              minLength: 3,
              variant: "danger",
            });
            if (retryNotes === null) {
              setBusyId(null);
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
    <div>
      <V2PageHeader
        breadcrumb={[
          { label: "Home", href: "/dashboard" },
          { label: "Settings", href: "/settings/pricing-rules" },
          { label: t("admin.connections.title") },
        ]}
        title={t("admin.connections.title")}
        actions={
          <>
            <V2Button
              icon={<Download className="h-4 w-4" />}
              disabled={rows.length === 0}
              onClick={() =>
                exportRowsAsCsv("connections", rows, [
                  ["id", (r) => r.id],
                  ["source_type", (r) => r.source_type],
                  ["source_id", (r) => r.source_id],
                  ["target_type", (r) => r.target_type],
                  ["target_id", (r) => r.target_id],
                  ["connection_type", (r) => r.connection_type],
                  ["status", (r) => r.status],
                  ["client_targeting", (r) => r.client_targeting ?? ""],
                ])
              }
            >
              Export
            </V2Button>
            {canCreate ? (
              <V2Button
                variant="primary"
                icon={<Plus className="h-4 w-4" />}
                onClick={() => setCreateOpen((o) => !o)}
              >
                {t("admin.connections.create_connection")}
              </V2Button>
            ) : null}
          </>
        }
      />

      <SettingsSubgroupTabs activeHref="/connections" />

      <div className="space-y-6">
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

      <V2Card>
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
            <TH align="right">{t("admin.connections.actions")}</TH>
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
                <TD className="tabular-nums text-fg-t7 font-mono text-xs">#{c.id}</TD>
                <TD className="font-mono text-xs">{entityLabel(c.source_type, c.source_id)}</TD>
                <TD className="font-mono text-xs">{entityLabel(c.target_type, c.target_id)}</TD>
                <TD>
                  {c.connection_type ? (
                    <span
                      className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.3px]"
                      style={{
                        backgroundColor: "var(--admin-bg-tertiary)",
                        color: "var(--admin-text-secondary)",
                      }}
                    >
                      {c.connection_type}
                    </span>
                  ) : (
                    <span className="text-fg-t6">—</span>
                  )}
                </TD>
                <TD>
                  {c.status ? (
                    <Badge tone={connectionStatusTone(c.status)}>{c.status}</Badge>
                  ) : (
                    <span className="text-fg-t6">—</span>
                  )}
                </TD>
                <TD className="max-w-[160px] truncate text-xs text-fg-t7">{companyLabel(c)}</TD>
                <TD className="text-xs text-fg-t6">
                  {c.client_targeting === "selected"
                    ? t("admin.connections.targeting_selected")
                    : t("admin.connections.targeting_all")}
                </TD>
                <TD className="text-xs text-fg-t6" title={c.created_at ?? undefined}>
                  {formatRelativeTime(c.created_at)}
                </TD>
                <TD align="right">
                  <div className="flex flex-wrap justify-end gap-1">
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
      </V2Card>

      {meta && !loading && <PaginationBar meta={meta} onPage={setPage} />}

      <p className="text-xs text-fg-t7">
        {t("admin.connections.footer_help_prefix")}{" "}
        <code className="text-[11px]">company_id</code>.{" "}
        {t("admin.connections.footer_help_suffix")}{" "}
        (<code className="text-[11px]">POST /api/connections</code>).
      </p>
      </div>
    </div>
  );
}

function connectionStatusTone(status: string): BadgeTone {
  switch (status) {
    case "accepted":
      return "success";
    case "pending":
      return "warning";
    case "rejected":
    case "canceled":
      return "danger";
    default:
      return "gray";
  }
}

function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const diff = Date.now() - t;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString();
}
