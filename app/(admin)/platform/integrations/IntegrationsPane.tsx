"use client";

/**
 * IntegrationsPane — the body of the Integrations page, extracted so it can be
 * rendered IN-PAGE inside the Settings System cluster (2026-07-01). Previously
 * Integrations was a standalone route with its own chrome, so opening it from
 * Settings navigated out and swapped chrome (the page "jumped"). Now SettingsPage
 * renders this pane directly and /platform/integrations renders SettingsPage.
 *
 * One card per integration; today only Google Drive. Company context is
 * per-company: a single-company admin uses its company; a super-admin gets a
 * company <select>. Google Drive status / connect / disconnect endpoints live at
 * the /api ROOT (auth:sanctum) — see lib/google-drive-api.ts.
 *
 * i18n is a LOCAL trilingual dict (integrations-i18n.ts) — no t() fallbacks.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { apiCompaniesList, type CompanyListRow } from "@/lib/inventory-crud-api";
import {
  apiGoogleDriveStatus,
  apiGoogleDriveDisconnect,
  apiGoogleDriveAuthUrl,
  isDriveConnected,
  driveConnectedEmail,
  type GoogleDriveStatus,
} from "@/lib/google-drive-api";
import { integrationsStrings } from "./integrations-i18n";

export function IntegrationsPane({ token, lang }: { token: string | null; lang: string }) {
  const { user } = useAdminAuth();
  const s = useMemo(() => integrationsStrings(lang), [lang]);
  const allowed = canAccessPlatformAdminNav(user);
  const isSuper = !!user?.is_super_admin;

  // Company context. Non-super users: pin their first company. Super-admins:
  // load the company list and let them pick.
  const ownCompanyId = user?.companies?.[0]?.id ?? null;
  const [companies, setCompanies] = useState<CompanyListRow[]>([]);
  const [companyId, setCompanyId] = useState<number | null>(ownCompanyId);

  const [status, setStatus] = useState<GoogleDriveStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Super-admins load the company picker list; default to the first company.
  useEffect(() => {
    if (!allowed || !isSuper || !token) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiCompaniesList(token);
        if (cancelled) return;
        setCompanies(res.data);
        setCompanyId((prev) => prev ?? res.data[0]?.id ?? null);
      } catch {
        /* picker is best-effort — a manual company-id input stays available */
      }
    })();
    return () => { cancelled = true; };
  }, [allowed, isSuper, token]);

  const loadStatus = useCallback(async () => {
    if (!token || companyId == null) {
      setStatus(null);
      return;
    }
    setLoading(true);
    try {
      const res = await apiGoogleDriveStatus(token, companyId);
      setStatus(res.data);
      setErr(null);
    } catch (e) {
      setStatus(null);
      setErr(e instanceof Error ? e.message : s.errStatus);
    } finally {
      setLoading(false);
    }
  }, [token, companyId, s]);

  useEffect(() => {
    if (!allowed) return;
    void loadStatus();
  }, [allowed, loadStatus]);

  const connect = async () => {
    if (!token || companyId == null) return;
    setBusy(true);
    try {
      // Fetch the Google OAuth URL WITH the Bearer header (token never touches
      // the URL), then navigate the whole page to Google's consent screen.
      const authUrl = await apiGoogleDriveAuthUrl(token, companyId);
      window.location.href = authUrl;
    } catch (e) {
      setErr(e instanceof Error ? e.message : s.errConnect);
      setBusy(false);
    }
  };

  const disconnect = async () => {
    if (!token || companyId == null) return;
    if (!window.confirm(s.confirmDisconnect)) return;
    setBusy(true);
    try {
      await apiGoogleDriveDisconnect(token, companyId);
      setErr(null);
      await loadStatus();
    } catch (e) {
      setErr(e instanceof Error ? e.message : s.errDisconnect);
    } finally {
      setBusy(false);
    }
  };

  const connected = isDriveConnected(status);
  const connectedEmail = driveConnectedEmail(status);

  if (!allowed) {
    return (
      <div className="empty-state">
        <div className="es-icon"><i className="ti ti-lock" /></div>
        <div className="es-title">{s.forbidden}</div>
      </div>
    );
  }

  return (
    <div className="page-pane active">
      {err && (
        <div className="badge badge-danger" style={{ marginBottom: 12, display: "inline-flex" }}>
          <i className="ti ti-alert-triangle" /> {err}
        </div>
      )}

      {/* Company context selector */}
      {isSuper ? (
        <div className="card">
          <div className="card-body">
            <div className="fld" style={{ maxWidth: 360 }}>
              <span className="fld-label">{s.companyLabel}</span>
              {companies.length > 0 ? (
                <select
                  value={companyId ?? ""}
                  onChange={(e) => setCompanyId(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">{s.companyPickPh}</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.name ?? `#${c.id}`}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="number"
                  placeholder={s.companyIdLabel}
                  value={companyId ?? ""}
                  onChange={(e) => setCompanyId(e.target.value ? Number(e.target.value) : null)}
                />
              )}
            </div>
          </div>
        </div>
      ) : ownCompanyId == null ? (
        <div className="empty-state">
          <div className="es-icon"><i className="ti ti-building" /></div>
          <div className="es-title">{s.noCompany}</div>
        </div>
      ) : null}

      {/* Google Drive card */}
      {companyId != null && (
        <div className="card">
          <div className="card-header">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <i className="ti ti-brand-google-drive" style={{ fontSize: 22 }} />
              <div>
                <div className="card-title">{s.gdriveTitle}</div>
                <div className="card-subtitle">{s.gdriveDesc}</div>
              </div>
            </div>
            {connected ? (
              <span className="badge badge-success"><i className="ti ti-circle-check" /> {s.statusConnected}</span>
            ) : (
              <span className="badge badge-gray">{s.statusNotConnected}</span>
            )}
          </div>
          <div className="card-body">
            {loading ? (
              <div className="cell-muted">{s.loading}</div>
            ) : connected ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {connectedEmail && (
                  <div>
                    <span className="cell-muted">{s.connectedAs}: </span>
                    <span className="font-semibold">{connectedEmail}</span>
                  </div>
                )}
                {status?.connected_at && (
                  <div className="cell-muted">{s.connectedAt}: {String(status.connected_at)}</div>
                )}
              </div>
            ) : (
              <div className="cell-muted">{s.statusNotConnected}</div>
            )}
          </div>
          <div className="card-foot">
            {connected ? (
              <button className="btn btn-danger" onClick={() => void disconnect()} disabled={busy}>
                <i className="ti ti-plug-connected-x" /> {s.disconnect}
              </button>
            ) : (
              <button className="btn btn-primary" onClick={() => void connect()} disabled={busy || companyId == null}>
                <i className="ti ti-brand-google-drive" /> {s.connect}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
