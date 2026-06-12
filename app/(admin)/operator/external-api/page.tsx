"use client";

/**
 * Roadmap §4 — External API page, now REAL (was a Phase 9 placeholder).
 *
 * Operators connect their company to an external inventory base that
 * implements the ZULU supplier-connector contract (ping + paged inventory,
 * HTTP basic auth). Test pings the live base, Import lands DRAFT offers
 * (hotel / car / transfer) with a per-item skip report, Disconnect removes
 * the connection but never the imported inventory. A built-in demo base
 * ships with the backend so the flow can be tried without a real supplier.
 */

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useConfirm } from "@/contexts/ConfirmDialogContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { canAccessOperatorToolsNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import {
  apiCreateSupplierConnection,
  apiDeleteSupplierConnection,
  apiImportSupplierConnection,
  apiSupplierConnections,
  apiTestSupplierConnection,
  type SupplierConnectionRow,
  type SupplierImportSummary,
} from "@/lib/supplier-connections-api";
import { Button, FormField, Input } from "@/components/ui";
import { PageHeader as V2PageHeader } from "@/components/ui/v2";
import { useCallback, useEffect, useState } from "react";

const K = "admin.crud.external_api";

function fmtWhen(iso: string | null): string {
  if (!iso) return "—";
  return iso.slice(0, 16).replace("T", " ");
}

export default function OperatorExternalApiPage() {
  const { user, token } = useAdminAuth();
  const { t } = useLanguage();
  const confirm = useConfirm();
  const allowed = canAccessOperatorToolsNav(user);

  const [rows, setRows] = useState<SupplierConnectionRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [formErr, setFormErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [actionBusyId, setActionBusyId] = useState<number | null>(null);
  const [summaries, setSummaries] = useState<Record<number, SupplierImportSummary>>({});

  const load = useCallback(async () => {
    if (!token) return;
    setErr(null);
    try {
      const res = await apiSupplierConnections(token);
      setRows(res.data ?? []);
    } catch (e) {
      setRows([]);
      setErr(e instanceof ApiRequestError ? e.message : t(`${K}.err_load`));
    }
  }, [token, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleAdd() {
    if (!token) return;
    if (!baseUrl.trim() || !login.trim() || !password.trim()) {
      setFormErr(t(`${K}.fill_required`));
      return;
    }
    setBusy(true);
    setFormErr(null);
    try {
      await apiCreateSupplierConnection(token, {
        name: name.trim() || undefined,
        base_url: baseUrl.trim(),
        login: login.trim(),
        password,
      });
      setName("");
      setBaseUrl("");
      setLogin("");
      setPassword("");
      await load();
    } catch (e) {
      setFormErr(e instanceof ApiRequestError ? e.message : t(`${K}.err_save`));
    } finally {
      setBusy(false);
    }
  }

  async function handleTest(id: number) {
    if (!token) return;
    setActionBusyId(id);
    try {
      await apiTestSupplierConnection(token, id);
      await load();
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : t(`${K}.err_action`));
    } finally {
      setActionBusyId(null);
    }
  }

  async function handleImport(id: number) {
    if (!token) return;
    setActionBusyId(id);
    try {
      const res = await apiImportSupplierConnection(token, id);
      setSummaries((p) => ({ ...p, [id]: res.data.summary }));
      await load();
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : t(`${K}.err_action`));
    } finally {
      setActionBusyId(null);
    }
  }

  async function handleDisconnect(id: number) {
    if (!token) return;
    const ok = await confirm({ messageKey: `${K}.disconnect_confirm`, variant: "danger" });
    if (!ok) return;
    setActionBusyId(id);
    try {
      await apiDeleteSupplierConnection(token, id);
      setSummaries((p) => {
        const next = { ...p };
        delete next[id];
        return next;
      });
      await load();
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : t(`${K}.err_action`));
    } finally {
      setActionBusyId(null);
    }
  }

  function statusBadge(s: SupplierConnectionRow["status"]) {
    const map: Record<SupplierConnectionRow["status"], { label: string; cls: string }> = {
      untested: { label: t(`${K}.status_untested`), cls: "bg-figma-bg-1 text-fg-t6" },
      ok: { label: t(`${K}.status_ok`), cls: "bg-success-50 text-success-700" },
      failed: { label: t(`${K}.status_failed`), cls: "bg-error-50 text-error-700" },
    };
    const m = map[s];
    return (
      <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${m.cls}`}>
        {m.label}
      </span>
    );
  }

  if (!allowed) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">{t(`${K}.title`)}</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <V2PageHeader
        breadcrumb={[
          { label: t("admin.nav.dashboard"), href: "/dashboard" },
          { label: t(`${K}.title`) },
        ]}
        title={t(`${K}.title`)}
        subtitle={t(`${K}.subtitle`)}
      />

      <section className="admin-card p-4 space-y-3">
        <h2 className="text-base font-semibold">{t(`${K}.add_title`)}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label={t(`${K}.field_name`)} htmlFor="ext-name">
            <Input
              id="ext-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t(`${K}.field_name_ph`)}
            />
          </FormField>
          <FormField label={t(`${K}.field_base_url`)} htmlFor="ext-url" required>
            <Input
              id="ext-url"
              type="url"
              placeholder="https://api.partner.example.com"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
          </FormField>
          <FormField label={t(`${K}.field_login`)} htmlFor="ext-login" required>
            <Input
              id="ext-login"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              autoComplete="off"
            />
          </FormField>
          <FormField label={t(`${K}.field_password`)} htmlFor="ext-password" required>
            <Input
              id="ext-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </FormField>
        </div>
        <div className="flex items-center gap-3">
          <Button size="sm" disabled={busy} onClick={() => void handleAdd()}>
            {busy ? t("admin.crud.common.saving") : t(`${K}.add_btn`)}
          </Button>
          {formErr && <p className="text-xs text-error-700">{formErr}</p>}
        </div>
      </section>

      {err && (
        <div className="rounded-zulu border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">
          {err}
        </div>
      )}

      <section className="space-y-3">
        {rows === null && <p className="text-sm text-fg-t6">{t("common.loading")}</p>}
        {rows !== null && rows.length === 0 && (
          <div className="admin-card p-4 text-sm text-fg-t6">{t(`${K}.empty`)}</div>
        )}
        {(rows ?? []).map((row) => {
          const summary = summaries[row.id];
          const rowBusy = actionBusyId === row.id;
          return (
            <div key={row.id} className="admin-card p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{row.name}</span>
                    {statusBadge(row.status)}
                  </div>
                  <div className="text-xs text-fg-t6">
                    {row.base_url} · {t(`${K}.field_login`)}: {row.login}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" disabled={rowBusy} onClick={() => void handleTest(row.id)}>
                    {rowBusy ? t(`${K}.working`) : t(`${K}.test_btn`)}
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={rowBusy || row.status !== "ok"}
                    onClick={() => void handleImport(row.id)}
                  >
                    {rowBusy ? t(`${K}.working`) : t(`${K}.import_btn`)}
                  </Button>
                  <Button size="sm" variant="outline" disabled={rowBusy} onClick={() => void handleDisconnect(row.id)}>
                    {t(`${K}.disconnect_btn`)}
                  </Button>
                </div>
              </div>

              <div className="grid gap-2 text-xs text-fg-t7 sm:grid-cols-3">
                <div>
                  <span className="text-fg-t6">{t(`${K}.last_tested`)}:</span> {fmtWhen(row.last_tested_at)}
                </div>
                <div>
                  <span className="text-fg-t6">{t(`${K}.last_synced`)}:</span> {fmtWhen(row.last_synced_at)}
                </div>
                <div>
                  <span className="text-fg-t6">{t(`${K}.items_imported`)}:</span> {row.items_imported}
                </div>
              </div>

              {row.last_error && (
                <div className="rounded-md border border-error-100 bg-error-50 px-3 py-2 text-xs text-error-700">
                  {row.last_error}
                </div>
              )}

              {summary && (
                <div className="rounded-md border border-default bg-figma-bg-1 px-3 py-2 text-xs space-y-1">
                  <div className="font-medium">
                    {t(`${K}.import_done`)}: {t(`${K}.sum_created`)} {summary.created} ·{" "}
                    {t(`${K}.sum_updated`)} {summary.updated} · {t(`${K}.sum_skipped`)}{" "}
                    {summary.skipped.length}
                  </div>
                  {summary.skipped.length > 0 && (
                    <ul className="list-disc pl-4 space-y-0.5 text-fg-t7">
                      {summary.skipped.map((s, i) => (
                        <li key={i}>
                          <span className="font-medium">{s.external_id}</span> ({s.type}) — {s.reason}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </section>

      <section className="admin-card p-4 space-y-2">
        <h3 className="text-sm font-semibold text-fg-t8">{t(`${K}.demo_title`)}</h3>
        <p className="text-xs text-fg-t7 leading-relaxed">{t(`${K}.demo_text`)}</p>
        <ul className="list-disc pl-5 text-xs text-fg-t7 space-y-0.5">
          <li>
            {t(`${K}.field_base_url`)}: <code>https://api.zulu.am/api/connector-demo</code>
          </li>
          <li>
            {t(`${K}.field_login`)}: <code>zulu-demo</code>
          </li>
          <li>
            {t(`${K}.field_password`)}: <code>zulu-demo-2026</code>
          </li>
        </ul>
      </section>
    </div>
  );
}
