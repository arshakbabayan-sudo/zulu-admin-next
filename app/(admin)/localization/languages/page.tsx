"use client";

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { canAccessLocalizationLanguagesNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import {
  apiAdminLanguages,
  apiLocalizationToggleLanguage,
  apiLocalizationCreateLanguage,
  apiLocalizationDeleteLanguage,
  apiSetDefaultLanguage,
  apiEditLanguage,
  type LocalizationLanguageRow,
} from "@/lib/localization-api";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

/* ── flag image via flagcdn.com ──────────────────────────── */
const LANG_TO_COUNTRY: Record<string, string> = {
  en: "gb", ru: "ru", hy: "am", ar: "sa", fr: "fr",
  de: "de", es: "es", it: "it", pt: "pt", zh: "cn",
  ja: "jp", ko: "kr", tr: "tr", pl: "pl", nl: "nl",
  uk: "ua", he: "il", fa: "ir", hi: "in", bn: "bd",
};
function FlagImg({ code }: { code: string }) {
  const country = LANG_TO_COUNTRY[code.toLowerCase()] ?? code.toLowerCase().slice(0, 2);
  return (
    <img
      src={`https://flagcdn.com/20x15/${country}.png`}
      srcSet={`https://flagcdn.com/40x30/${country}.png 2x`}
      width={20}
      height={15}
      alt={code}
      className="inline-block rounded-sm object-cover"
      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
    />
  );
}

/* ── iOS-style toggle ────────────────────────────────────── */
function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      style={{
        width: 44,
        height: 24,
        borderRadius: 12,
        backgroundColor: checked ? "#7c3aed" : "#d1d5db",
        border: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        position: "relative",
        transition: "background-color 0.2s",
        flexShrink: 0,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 3,
          left: checked ? 23 : 3,
          width: 18,
          height: 18,
          borderRadius: "50%",
          backgroundColor: "#fff",
          boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
          transition: "left 0.2s",
          display: "block",
        }}
      />
    </button>
  );
}

/* ── icon buttons — exactly like Triprex ────────────────── */
function BtnInfo({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  const { t } = useLanguage();
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={t("admin.languages.btn_view_translations")}
      style={{
        width: 34, height: 34, borderRadius: 6,
        backgroundColor: "#10b981", border: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
    </button>
  );
}
function BtnEdit({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  const { t } = useLanguage();
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={t("admin.languages.btn_edit")}
      style={{
        width: 34, height: 34, borderRadius: 6,
        backgroundColor: "#7c3aed", border: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z" />
      </svg>
    </button>
  );
}
function BtnDelete({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  const { t } = useLanguage();
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={t("admin.languages.btn_delete")}
      style={{
        width: 34, height: 34, borderRadius: 6,
        backgroundColor: "#ef4444", border: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
        <path d="M10 11v6M14 11v6" />
        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      </svg>
    </button>
  );
}

/* ── Edit modal ──────────────────────────────────────────── */
function EditModal({ row, onClose, onSave }: {
  row: LocalizationLanguageRow;
  onClose: () => void;
  onSave: (name: string, nameEn: string, rtl: boolean) => Promise<void>;
}) {
  const { t } = useLanguage();
  const [name, setName] = useState(row.name);
  const [nameEn, setNameEn] = useState(row.name_en ?? "");
  const [rtl, setRtl] = useState(row.rtl ?? false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!name || !nameEn) { setErr(t("admin.languages.fields_required")); return; }
    setSaving(true);
    try { await onSave(name, nameEn, rtl); onClose(); }
    catch (e) { setErr(e instanceof ApiRequestError ? e.message : t("admin.languages.err_save")); }
    finally { setSaving(false); }
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.45)", padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 440, backgroundColor: "#fff", borderRadius: 12, padding: 24, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>{t("admin.languages.edit_title").replace("{code}", row.code.toUpperCase())}</h2>
        {err && <p style={{ color: "#ef4444", fontSize: 12, marginBottom: 12 }}>{err}</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 500, color: "#64748b", marginBottom: 4 }}>{t("admin.languages.label_native_name")}</label>
            <input value={name} onChange={e => setName(e.target.value)} style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: 6, padding: "7px 10px", fontSize: 14, boxSizing: "border-box", color: "#1e293b", backgroundColor: "#fff" }} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 500, color: "#64748b", marginBottom: 4 }}>{t("admin.languages.label_name_en")}</label>
            <input value={nameEn} onChange={e => setNameEn(e.target.value)} style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: 6, padding: "7px 10px", fontSize: 14, boxSizing: "border-box", color: "#1e293b", backgroundColor: "#fff" }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Toggle checked={rtl} onChange={() => setRtl(v => !v)} />
            <span style={{ fontSize: 14, color: "#374151" }}>{t("admin.languages.label_rtl")}</span>
          </div>
        </div>
        <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button type="button" onClick={onClose} style={{ padding: "7px 18px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 14, cursor: "pointer", backgroundColor: "#fff" }}>{t("common.cancel")}</button>
          <button type="button" disabled={saving} onClick={submit} style={{ padding: "7px 18px", borderRadius: 6, border: "none", fontSize: 14, cursor: "pointer", backgroundColor: "#7c3aed", color: "#fff", opacity: saving ? 0.6 : 1 }}>
            {saving ? t("admin.localization.saving") : t("common.save")}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Add modal ───────────────────────────────────────────── */
function AddModal({ onClose, onAdd }: {
  onClose: () => void;
  onAdd: (code: string, name: string, nameEn: string) => Promise<void>;
}) {
  const { t } = useLanguage();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [adding, setAdding] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!code || !name || !nameEn) { setErr(t("admin.languages.fields_required")); return; }
    setAdding(true);
    try { await onAdd(code, name, nameEn); onClose(); }
    catch (e) { setErr(e instanceof ApiRequestError ? e.message : t("admin.languages.err_failed")); }
    finally { setAdding(false); }
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.45)", padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 440, backgroundColor: "#fff", borderRadius: 12, padding: 24, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>{t("admin.languages.add_title")}</h2>
        {err && <p style={{ color: "#ef4444", fontSize: 12, marginBottom: 12 }}>{err}</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 500, color: "#64748b", marginBottom: 4 }}>{t("admin.languages.label_code")}</label>
            <input value={code} onChange={e => setCode(e.target.value.toLowerCase())} placeholder={t("admin.languages.placeholder_code")} style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: 6, padding: "7px 10px", fontSize: 14, fontFamily: "monospace", boxSizing: "border-box", color: "#1e293b", backgroundColor: "#fff" }} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 500, color: "#64748b", marginBottom: 4 }}>{t("admin.languages.label_native_name")}</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder={t("admin.languages.placeholder_native")} style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: 6, padding: "7px 10px", fontSize: 14, boxSizing: "border-box", color: "#1e293b", backgroundColor: "#fff" }} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 500, color: "#64748b", marginBottom: 4 }}>{t("admin.languages.label_name_en")}</label>
            <input value={nameEn} onChange={e => setNameEn(e.target.value)} placeholder={t("admin.languages.placeholder_name_en")} style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: 6, padding: "7px 10px", fontSize: 14, boxSizing: "border-box", color: "#1e293b", backgroundColor: "#fff" }} />
          </div>
        </div>
        <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button type="button" onClick={onClose} style={{ padding: "7px 18px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 14, cursor: "pointer", backgroundColor: "#fff" }}>{t("common.cancel")}</button>
          <button type="button" disabled={adding} onClick={submit} style={{ padding: "7px 18px", borderRadius: 6, border: "none", fontSize: 14, cursor: "pointer", backgroundColor: "#7c3aed", color: "#fff", opacity: adding ? 0.6 : 1 }}>
            {adding ? t("admin.languages.adding") : t("admin.languages.add_language")}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── main page ───────────────────────────────────────────── */
export default function LocalizationLanguagesPage() {
  const { t } = useLanguage();
  const { token, user } = useAdminAuth();
  const allowed = canAccessLocalizationLanguagesNav(user);

  const [rows, setRows] = useState<LocalizationLanguageRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editRow, setEditRow] = useState<LocalizationLanguageRow | null>(null);

  const load = useCallback(async () => {
    if (!token || !allowed) return;
    try {
      const res = await apiAdminLanguages(token);
      setRows(res.data);
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : t("admin.languages.err_load"));
    }
  }, [token, allowed, t]);

  useEffect(() => { load(); }, [load]);

  async function handleToggleEnabled(row: LocalizationLanguageRow) {
    if (!token) return;
    setBusyId(row.id);
    try { await apiLocalizationToggleLanguage(token, row.id); await load(); }
    catch (e) { alert(e instanceof ApiRequestError ? e.message : t("admin.languages.err_toggle")); }
    finally { setBusyId(null); }
  }

  async function handleSetDefault(row: LocalizationLanguageRow) {
    if (!token || row.is_default) return;
    setBusyId(row.id);
    try { await apiSetDefaultLanguage(token, row.id); await load(); }
    catch (e) { alert(e instanceof ApiRequestError ? e.message : t("admin.languages.err_failed")); }
    finally { setBusyId(null); }
  }

  async function handleDelete(row: LocalizationLanguageRow) {
    if (!token) return;
    if (!confirm(`Delete "${row.name_en ?? row.name}" (${row.code})?`)) return;
    setBusyId(row.id);
    try { await apiLocalizationDeleteLanguage(token, row.id); await load(); }
    catch (e) { alert(e instanceof ApiRequestError ? e.message : t("admin.languages.err_delete")); }
    finally { setBusyId(null); }
  }

  async function handleEdit(name: string, nameEn: string, rtl: boolean) {
    if (!token || !editRow) return;
    await apiEditLanguage(token, editRow.id, { name, name_en: nameEn, rtl });
    await load();
  }

  async function handleAdd(code: string, name: string, nameEn: string) {
    if (!token) return;
    await apiLocalizationCreateLanguage(token, { code, name, name_en: nameEn });
    await load();
  }

  if (!allowed) {
    return (
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>{t("admin.languages.title")}</h1>
        <ForbiddenNotice messageKey="admin.forbidden.languages" />
      </div>
    );
  }

  return (
    <div>
      <style>{`
        .zulu-lang-table table { border-collapse: collapse !important; background: transparent !important; border: none !important; box-shadow: none !important; border-radius: 0 !important; width: 100% !important; }
        .zulu-lang-table thead th { background-color: #7c3aed !important; color: #ffffff !important; border: none !important; border-top: none !important; font-size: 13px !important; font-weight: 600 !important; letter-spacing: 0.04em !important; text-transform: uppercase !important; }
        .zulu-lang-table tbody td { color: #1e293b !important; background-color: #ffffff !important; border-top: 1px solid #f1f5f9 !important; font-size: 14px !important; }
        .zulu-lang-table tbody tr:first-child td { border-top: none !important; }
        .zulu-lang-table input { color: #1e293b !important; background-color: #ffffff !important; }
        .zulu-lang-table select { color: #1e293b !important; background-color: #ffffff !important; }
        .zulu-lang-table button { padding: 0 !important; border-radius: 0 !important; font-size: inherit !important; }
      `}</style>
      {showAdd && <AddModal onClose={() => setShowAdd(false)} onAdd={handleAdd} />}
      {editRow && <EditModal row={editRow} onClose={() => setEditRow(null)} onSave={handleEdit} />}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600 }}>{t("admin.languages.title")}</h1>
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "9px 18px", borderRadius: 8, border: "none",
            backgroundColor: "#7c3aed", color: "#fff", fontSize: 14,
            fontWeight: 500, cursor: "pointer",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          {t("admin.languages.add_new")}
        </button>
      </div>

      {err && <p style={{ color: "#ef4444", fontSize: 13, marginBottom: 12 }}>{err}</p>}

      <div className="zulu-lang-table" style={{ borderRadius: 12, overflow: "hidden", border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ backgroundColor: "#7c3aed" }}>
              {[t("admin.languages.table_sn"), t("admin.languages.table_name"), t("admin.languages.table_code"), t("admin.languages.table_rtl"), t("admin.languages.table_default"), t("admin.languages.table_option")].map((h, i) => (
                <th key={`${h}-${i}`} style={{
                  padding: "13px 16px", color: "#fff", fontWeight: 600,
                  fontSize: 13, letterSpacing: "0.04em",
                  textAlign: i === 0 || i >= 3 ? "center" : "left",
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: "32px 16px", textAlign: "center", color: "#64748b", fontSize: 13 }}>{t("admin.languages.no_rows")}</td>
              </tr>
            )}
            {rows.map((row, i) => (
              <tr key={row.id} style={{ borderBottom: "1px solid #f1f5f9", backgroundColor: "#fff", color: "#1e293b" }}>
                <td style={{ padding: "14px 16px", textAlign: "center", color: "#94a3b8" }}>{i + 1}</td>
                <td style={{ padding: "14px 16px", fontWeight: 500, color: "#1e293b" }}>{row.name}</td>
                <td style={{ padding: "14px 16px", color: "#1e293b" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "monospace", color: "#1e293b" }}>
                    <FlagImg code={row.code} />
                    {row.code}
                  </span>
                </td>
                <td style={{ padding: "14px 16px", textAlign: "center" }}>
                  <div style={{ display: "flex", justifyContent: "center" }}>
                    <Toggle
                      checked={row.rtl ?? false}
                      disabled={busyId === row.id}
                      onChange={async () => {
                        if (!token) return;
                        setBusyId(row.id);
                        try {
                          await apiEditLanguage(token, row.id, { name: row.name, name_en: row.name_en ?? row.name, rtl: !(row.rtl ?? false) });
                          await load();
                        } finally { setBusyId(null); }
                      }}
                    />
                  </div>
                </td>
                <td style={{ padding: "14px 16px", textAlign: "center" }}>
                  <div style={{ display: "flex", justifyContent: "center" }}>
                    <Toggle
                      checked={row.is_default}
                      disabled={busyId === row.id || row.is_default}
                      onChange={() => handleSetDefault(row)}
                    />
                  </div>
                </td>
                <td style={{ padding: "14px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                    <Link href={`/localization/ui-translations?lang=${row.code}`}>
                      <BtnInfo onClick={() => {}} />
                    </Link>
                    <BtnEdit onClick={() => setEditRow(row)} disabled={busyId === row.id} />
                    <BtnDelete onClick={() => handleDelete(row)} disabled={busyId === row.id || row.is_default} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
