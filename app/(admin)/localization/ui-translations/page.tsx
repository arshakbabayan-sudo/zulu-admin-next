"use client";

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { ApiRequestError } from "@/lib/api-client";
import {
  apiAdminLanguages,
  apiUiTranslationsGetAdmin,
  apiUiTranslationsSave,
  type LocalizationLanguageRow,
  type UiTranslationRow,
} from "@/lib/localization-api";
import { useLanguage } from "@/contexts/LanguageContext";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const PER_PAGE = 50;

/* ── pagination builder ──────────────────────────────────── */
function buildPages(current: number, last: number): (number | "...")[] {
  if (last <= 10) return Array.from({ length: last }, (_, i) => i + 1);
  const pages: (number | "...")[] = [1];
  if (current > 4) pages.push("...");
  for (let p = Math.max(2, current - 2); p <= Math.min(last - 1, current + 2); p++) pages.push(p);
  if (current < last - 3) pages.push("...");
  pages.push(last);
  return pages;
}

export default function UiTranslationsPage() {
  const { t } = useLanguage();
  const { token, user } = useAdminAuth();
  const isSuperAdmin = user?.is_super_admin === true;
  const router = useRouter();
  const searchParams = useSearchParams();

  const [languages, setLanguages] = useState<LocalizationLanguageRow[]>([]);
  const [selectedLang, setSelectedLang] = useState<string>("");
  const [rows, setRows] = useState<UiTranslationRow[]>([]);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const editRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    if (!token) return;
    apiAdminLanguages(token)
      .then((res) => {
        setLanguages(res.data);
        const paramLang = searchParams.get("lang");
        const initial = (paramLang && res.data.find(l => l.code === paramLang))
          ? paramLang
          : res.data[0]?.code ?? "";
        setSelectedLang(initial);
      })
      .catch(() => setErr(t("admin.localization.err_load_languages")));
  }, [token, searchParams]);

  const loadTranslations = useCallback(async () => {
    if (!token || !selectedLang) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await apiUiTranslationsGetAdmin(token, { lang: selectedLang, page, per_page: PER_PAGE, search });
      setRows(res.data.data);
      setLastPage(res.data.last_page);
      setEdits({});
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : t("admin.localization.err_load"));
    } finally {
      setLoading(false);
    }
  }, [token, selectedLang, page, search]);

  useEffect(() => { loadTranslations(); }, [loadTranslations]);

  function handleEdit(key: string, value: string) {
    setEdits(prev => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (!token || !selectedLang || Object.keys(edits).length === 0) return;
    setSaving(true);
    setErr(null);
    setSuccessMsg(null);
    try {
      await apiUiTranslationsSave(token, { language_code: selectedLang, translations: edits });
      setSuccessMsg(
        t("admin.localization.saved_success").replace("{count}", String(Object.keys(edits).length))
      );
      await loadTranslations();
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : t("admin.localization.err_save"));
    } finally {
      setSaving(false);
    }
  }

  function handleSearch() {
    setPage(1);
    setSearch(searchInput);
  }

  if (!isSuperAdmin) {
    return (
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>{t("admin.localization.ui_title")}</h1>
        <ForbiddenNotice messageKey="admin.forbidden.ui_translations" />
      </div>
    );
  }

  const hasEdits = Object.keys(edits).length > 0;
  const pages = buildPages(page, lastPage);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <style>{`
        .zulu-tr-table table { border-collapse: collapse !important; background: transparent !important; border: none !important; box-shadow: none !important; border-radius: 0 !important; width: 100% !important; }
        .zulu-tr-table thead th { background-color: #7c3aed !important; color: #ffffff !important; border: none !important; border-top: none !important; font-size: 13px !important; font-weight: 600 !important; text-transform: uppercase !important; letter-spacing: 0.04em !important; }
        .zulu-tr-table tbody td { color: #1e293b !important; background-color: #ffffff !important; border-top: 1px solid #f1f5f9 !important; font-size: 14px !important; }
        .zulu-tr-table tbody tr:first-child td { border-top: none !important; }
        .zulu-tr-table input[type="text"] { color: #1e293b !important; background-color: #ffffff !important; border: 1px solid #e2e8f0 !important; border-radius: 6px !important; padding: 7px 10px !important; font-size: 14px !important; outline: none !important; box-shadow: none !important; }
        .zulu-tr-table input[type="text"]:focus { border-color: #7c3aed !important; }
        .zulu-tr-search input, .zulu-tr-search select { color: #1e293b !important; background-color: #ffffff !important; }
        .zulu-tr-search button { padding: 0 !important; border-radius: 0 !important; }
      `}</style>

      {/* ── Top bar: title + search + Go Back ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>{t("admin.localization.ui_title")}</h1>

        <div className="zulu-tr-search" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Language selector */}
          <select
            value={selectedLang}
            onChange={e => { setSelectedLang(e.target.value); setPage(1); setSearch(""); setSearchInput(""); setEdits({}); }}
            style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 12px", fontSize: 14, backgroundColor: "#fff", cursor: "pointer", color: "#1e293b" }}
          >
            {languages.map(l => (
              <option key={l.code} value={l.code}>{l.name_en ?? l.name} ({l.code})</option>
            ))}
          </select>

          {/* Search input */}
          <input
            type="text"
            placeholder={t("admin.localization.search_placeholder")}
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSearch()}
            style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 14px", fontSize: 14, width: 200, backgroundColor: "#fff", color: "#1e293b" }}
          />

          {/* Search icon button */}
          <button
            type="button"
            onClick={handleSearch}
            title={t("admin.localization.search_title")}
            style={{
              width: 38, height: 38, borderRadius: 8, border: "none",
              backgroundColor: "#7c3aed", cursor: "pointer",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>

          {/* Go Back button — exactly like Triprex */}
          <button
            type="button"
            onClick={() => router.push("/localization/languages")}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "8px 18px", borderRadius: 8, border: "none",
              backgroundColor: "#7c3aed", color: "#fff", fontSize: 14,
              fontWeight: 500, cursor: "pointer",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            {t("admin.localization.go_back")}
          </button>
        </div>
      </div>

      {err && <p style={{ color: "#ef4444", fontSize: 13, margin: 0 }}>{err}</p>}
      {successMsg && <p style={{ color: "#16a34a", fontSize: 13, margin: 0 }}>{successMsg}</p>}

      {/* ── Table ── */}
      <div className="zulu-tr-table" style={{ borderRadius: 12, overflow: "hidden", border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ backgroundColor: "#7c3aed" }}>
              <th style={{ width: 60, padding: "13px 16px", color: "#fff", fontWeight: 600, fontSize: 13, textAlign: "center" }}>{t("admin.localization.col_hash")}</th>
              <th style={{ width: "38%", padding: "13px 16px", color: "#fff", fontWeight: 600, fontSize: 13, textAlign: "center" }}>{t("admin.localization.col_key")}</th>
              <th style={{ padding: "13px 16px", color: "#fff", fontWeight: 600, fontSize: 13, textAlign: "center" }}>{t("admin.localization.col_value")}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={3} style={{ padding: "40px 16px", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>{t("admin.localization.loading")}</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={3} style={{ padding: "40px 16px", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
                  {t("admin.localization.empty")}
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr key={`${selectedLang}-${row.key}`} style={{ borderBottom: "1px solid #f1f5f9", backgroundColor: "#fff", color: "#1e293b" }}>
                  <td style={{ padding: "10px 16px", textAlign: "center", color: "#94a3b8", fontVariantNumeric: "tabular-nums" }}>
                    {(page - 1) * PER_PAGE + i + 1}
                  </td>
                  <td style={{ padding: "10px 16px" }}>
                    <span style={{ fontWeight: 600, color: "#1e293b" }}>{row.key}</span>
                  </td>
                  <td style={{ padding: "8px 16px" }}>
                    <input
                      ref={el => { editRefs.current[row.key] = el; }}
                      type="text"
                      defaultValue={row.value}
                      onChange={e => handleEdit(row.key, e.target.value)}
                      style={{
                        width: "100%", border: "1px solid #e2e8f0", borderRadius: 6,
                        padding: "7px 10px", fontSize: 14, outline: "none",
                        boxSizing: "border-box", backgroundColor: "#fff",
                        color: "#1e293b",
                      }}
                      onFocus={e => { e.target.style.borderColor = "#7c3aed"; }}
                      onBlur={e => { e.target.style.borderColor = "#e2e8f0"; }}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination + Save ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>

        {/* Pagination — Triprex style numbered circles */}
        {lastPage > 1 ? (
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {/* prev */}
            <button
              type="button"
              disabled={page === 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              style={{
                width: 34, height: 34, borderRadius: "50%", border: "1px solid #e2e8f0",
                backgroundColor: "#fff", cursor: page === 1 ? "not-allowed" : "pointer",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                opacity: page === 1 ? 0.4 : 1, fontSize: 14, color: "#475569",
              }}
            >‹</button>

            {pages.map((p, idx) =>
              p === "..." ? (
                <span key={`e${idx}`} style={{ width: 34, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>…</span>
              ) : (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p as number)}
                  style={{
                    width: 34, height: 34, borderRadius: "50%",
                    border: page === p ? "none" : "1px solid #e2e8f0",
                    backgroundColor: page === p ? "#7c3aed" : "#fff",
                    color: page === p ? "#fff" : "#475569",
                    fontWeight: page === p ? 600 : 400,
                    cursor: "pointer", fontSize: 13,
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                  }}
                >{p}</button>
              )
            )}

            {/* next */}
            <button
              type="button"
              disabled={page === lastPage}
              onClick={() => setPage(p => Math.min(lastPage, p + 1))}
              style={{
                width: 34, height: 34, borderRadius: "50%", border: "1px solid #e2e8f0",
                backgroundColor: "#fff", cursor: page === lastPage ? "not-allowed" : "pointer",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                opacity: page === lastPage ? 0.4 : 1, fontSize: 14, color: "#475569",
              }}
            >›</button>
          </div>
        ) : <div />}

        {/* Save — bottom-right, Triprex style */}
        <button
          type="button"
          disabled={saving || !hasEdits}
          onClick={handleSave}
          style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "9px 22px", borderRadius: 8, border: "none",
            backgroundColor: "#7c3aed", color: "#fff", fontSize: 14,
            fontWeight: 500, cursor: hasEdits ? "pointer" : "not-allowed",
            opacity: !hasEdits || saving ? 0.55 : 1,
            boxShadow: "0 2px 8px rgba(124,58,237,0.3)",
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
            <polyline points="17 21 17 13 7 13 7 21" />
            <polyline points="7 3 7 8 15 8" />
          </svg>
          {saving
            ? t("admin.localization.saving")
            : `${t("admin.localization.save")}${hasEdits ? ` (${Object.keys(edits).length})` : ""}`}
        </button>
      </div>

    </div>
  );
}
