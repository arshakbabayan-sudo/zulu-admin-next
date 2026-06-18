"use client";

/**
 * admin — FAQ editor (route: /platform/faqs).
 *
 * Renders its OWN mgmt chrome (Sidebar/Header/management.css, off-canvas mobile
 * nav) exactly like Chat / Inventory / Settings. A single unified page: a table
 * of FAQs + a "New FAQ" button + a right-side edit drawer with the category,
 * three question inputs (hy/ru/en), three answer textareas (hy/ru/en),
 * sort_order and an is_active toggle. Writes go through lib/faq-admin-api.ts
 * (POST / PATCH / DELETE on /platform-admin/faqs).
 *
 * i18n is a LOCAL trilingual dict (faqs-i18n.ts) — no t() fallbacks — so the
 * language toggle swaps the dictionary instantly.
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import "../management/management.css";
import { Sidebar, Header } from "../management/MgmtPage";
import { useMgmtMobileNav } from "@/lib/use-mgmt-mobile-nav";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { canAccessPlatformAdminNav, canAccessNotificationsNav } from "@/lib/access";
import { apiNotificationsUnreadCount } from "@/lib/notifications-api";
import { apiFaqs, apiFaqCreate, apiFaqUpdate, apiFaqDelete, type Faq, type FaqPayload } from "@/lib/faq-admin-api";
import { faqStrings, type FaqKey } from "./faqs-i18n";

const CATEGORIES: Array<{ value: string; labelKey: FaqKey }> = [
  { value: "general", labelKey: "catGeneral" },
  { value: "booking", labelKey: "catBooking" },
  { value: "payment", labelKey: "catPayment" },
  { value: "account", labelKey: "catAccount" },
  { value: "partners", labelKey: "catPartners" },
  { value: "visa", labelKey: "catVisa" },
  { value: "insurance", labelKey: "catInsurance" },
];

type Draft = {
  id: number | null;
  category: string;
  question_hy: string;
  question_ru: string;
  question_en: string;
  answer_hy: string;
  answer_ru: string;
  answer_en: string;
  sort_order: number;
  is_active: boolean;
};

const EMPTY_DRAFT: Draft = {
  id: null,
  category: "general",
  question_hy: "",
  question_ru: "",
  question_en: "",
  answer_hy: "",
  answer_ru: "",
  answer_en: "",
  sort_order: 0,
  is_active: true,
};

export default function FaqsPage() {
  const router = useRouter();
  const { token, user, logout } = useAdminAuth();
  const { lang, setLang, languageOptions } = useLanguage();
  const s = useMemo(() => faqStrings(lang), [lang]);
  const allowed = canAccessPlatformAdminNav(user);

  const { sidebarCollapsed, onHamburger, closeNav, layoutClass } = useMgmtMobileNav();
  const [unreadCount, setUnreadCount] = useState(0);

  const [rows, setRows] = useState<Faq[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);

  // notifications badge for the shared chrome
  useEffect(() => {
    if (!token || !canAccessNotificationsNav(user)) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiNotificationsUnreadCount(token);
        if (!cancelled) setUnreadCount(res.data.unread_count ?? 0);
      } catch {
        /* badge is non-critical chrome */
      }
    })();
    return () => { cancelled = true; };
  }, [token, user]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await apiFaqs(token);
      const sorted = [...res.data].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
      setRows(sorted);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : s.errLoad);
    } finally {
      setLoading(false);
    }
  }, [token, s]);

  useEffect(() => {
    if (!allowed) return;
    void load();
  }, [allowed, load]);

  const openNew = () => {
    setDraft({ ...EMPTY_DRAFT, sort_order: rows.length });
    setDrawerOpen(true);
  };
  const openEdit = (f: Faq) => {
    setDraft({
      id: f.id,
      category: f.category,
      question_hy: f.question_hy ?? "",
      question_ru: f.question_ru ?? "",
      question_en: f.question_en ?? "",
      answer_hy: f.answer_hy ?? "",
      answer_ru: f.answer_ru ?? "",
      answer_en: f.answer_en ?? "",
      sort_order: f.sort_order ?? 0,
      is_active: !!f.is_active,
    });
    setDrawerOpen(true);
  };
  const closeDrawer = () => setDrawerOpen(false);

  const setField = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const save = async () => {
    if (!token) return;
    const required: Array<keyof Draft> = [
      "category", "question_hy", "question_ru", "question_en",
      "answer_hy", "answer_ru", "answer_en",
    ];
    const missing = required.some((k) => String(draft[k] ?? "").trim() === "");
    if (missing) {
      setErr(s.errRequired);
      return;
    }
    const body: FaqPayload = {
      category: draft.category,
      question_hy: draft.question_hy,
      question_ru: draft.question_ru,
      question_en: draft.question_en,
      answer_hy: draft.answer_hy,
      answer_ru: draft.answer_ru,
      answer_en: draft.answer_en,
      sort_order: draft.sort_order,
      is_active: draft.is_active,
    };
    setSaving(true);
    try {
      if (draft.id == null) {
        await apiFaqCreate(token, body);
      } else {
        await apiFaqUpdate(token, draft.id, body);
      }
      setDrawerOpen(false);
      setErr(null);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : s.errSave);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (f: Faq) => {
    if (!token) return;
    if (!window.confirm(s.confirmDelete)) return;
    try {
      await apiFaqDelete(token, f.id);
      setErr(null);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : s.errDelete);
    }
  };

  // Escape closes the drawer.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setDrawerOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const catLabel = (value: string): string => {
    const c = CATEGORIES.find((x) => x.value === value);
    return c ? s[c.labelKey] : value;
  };

  const chrome = (body: ReactNode, action?: ReactNode) => (
    <div className="mgmt-page mgmt-page-host">
      <div className={layoutClass}>
        <Sidebar collapsed={sidebarCollapsed} unreadCount={unreadCount} />
        <div className="nav-overlay" onClick={closeNav} />
        <div className="main">
          <Header
            collapsed={sidebarCollapsed}
            onHamburger={onHamburger}
            user={user ?? null}
            token={token}
            lang={lang}
            languageOptions={languageOptions}
            onSetLang={setLang}
            unreadCount={unreadCount}
            onLogout={() => void logout().then(() => router.push("/login"))}
            onNavigate={(href) => router.push(href)}
          />
          <div className="page">
            <div className="page-header">
              <div>
                <div className="breadcrumb">
                  <a onClick={() => router.push("/dashboard")}>{s.breadcrumbHome}</a>
                  <i className="ti ti-chevron-right" />
                  <span className="breadcrumb-current">{s.title}</span>
                </div>
                <h1 className="page-title"><span>{s.title}</span></h1>
                <div className="page-subtitle">{s.subtitle}</div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>{action}</div>
            </div>

            <div className="section-tabs">
              <button className="section-tab active"><i className="ti ti-help" /> {s.title}</button>
            </div>

            {body}
          </div>
        </div>
      </div>
    </div>
  );

  if (!allowed) {
    return chrome(
      <div className="empty-state">
        <div className="es-icon"><i className="ti ti-lock" /></div>
        <div className="es-title">{s.forbidden}</div>
      </div>,
    );
  }

  return chrome(
    <div className="page-pane active">
      {err && (
        <div className="badge badge-danger" style={{ marginBottom: 12, display: "inline-flex" }}>
          <i className="ti ti-alert-triangle" /> {err}
        </div>
      )}

      <div className="card" style={{ marginBottom: 0 }}>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{s.colCategory}</th>
                <th>{s.colQuestion}</th>
                <th>{s.colActive}</th>
                <th>{s.colOrder}</th>
                <th style={{ textAlign: "right" }}>{s.colActions}</th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr><td colSpan={5} className="cell-muted" style={{ textAlign: "center", padding: 40 }}>{s.loading}</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={5} className="cell-muted" style={{ textAlign: "center", padding: 40 }}>{s.empty}</td></tr>
              ) : (
                rows.map((f) => (
                  <tr key={f.id} onClick={() => openEdit(f)}>
                    <td><span className="badge badge-gray">{catLabel(f.category)}</span></td>
                    <td className="font-semibold">{f.question_en || "—"}</td>
                    <td>
                      {f.is_active ? (
                        <span className="badge badge-success">{s.active}</span>
                      ) : (
                        <span className="badge badge-gray">{s.inactive}</span>
                      )}
                    </td>
                    <td className="cell-muted">{f.sort_order}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="row-actions">
                        <button className="btn btn-sm" onClick={() => openEdit(f)}>
                          <i className="ti ti-edit" /> {s.edit}
                        </button>
                        <button className="btn btn-sm btn-danger" onClick={() => void remove(f)}>
                          <i className="ti ti-trash" /> {s.delete}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit / create drawer */}
      <div className={`drawer-overlay ${drawerOpen ? "open" : ""}`} onClick={closeDrawer} />
      <div className={`drawer ${drawerOpen ? "open" : ""}`}>
        <div className="drawer-header">
          <div>
            <div className="card-title">{draft.id == null ? s.drawerNewTitle : s.drawerEditTitle}</div>
          </div>
          <button className="icon-btn" onClick={closeDrawer} title={s.close}><i className="ti ti-x" /></button>
        </div>
        <div className="drawer-body">
          <div className="fld" style={{ marginBottom: 12 }}>
            <span className="fld-label">{s.fldCategory}</span>
            <select value={draft.category} onChange={(e) => setField("category", e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{s[c.labelKey]}</option>
              ))}
            </select>
          </div>

          <div className="drawer-section">{s.secQuestions}</div>
          <div className="fld" style={{ marginBottom: 10 }}>
            <span className="fld-label">{s.qHy}</span>
            <input value={draft.question_hy} onChange={(e) => setField("question_hy", e.target.value)} />
          </div>
          <div className="fld" style={{ marginBottom: 10 }}>
            <span className="fld-label">{s.qRu}</span>
            <input value={draft.question_ru} onChange={(e) => setField("question_ru", e.target.value)} />
          </div>
          <div className="fld" style={{ marginBottom: 10 }}>
            <span className="fld-label">{s.qEn}</span>
            <input value={draft.question_en} onChange={(e) => setField("question_en", e.target.value)} />
          </div>

          <div className="drawer-section">{s.secAnswers}</div>
          <div className="fld" style={{ marginBottom: 10 }}>
            <span className="fld-label">{s.aHy}</span>
            <textarea value={draft.answer_hy} onChange={(e) => setField("answer_hy", e.target.value)} />
          </div>
          <div className="fld" style={{ marginBottom: 10 }}>
            <span className="fld-label">{s.aRu}</span>
            <textarea value={draft.answer_ru} onChange={(e) => setField("answer_ru", e.target.value)} />
          </div>
          <div className="fld" style={{ marginBottom: 10 }}>
            <span className="fld-label">{s.aEn}</span>
            <textarea value={draft.answer_en} onChange={(e) => setField("answer_en", e.target.value)} />
          </div>

          <div className="drawer-section">{s.fldSortOrder}</div>
          <div className="fld" style={{ marginBottom: 12 }}>
            <span className="fld-label">{s.fldSortOrder}</span>
            <input
              type="number"
              value={draft.sort_order}
              onChange={(e) => setField("sort_order", Number(e.target.value) || 0)}
            />
          </div>

          <label className="switch-row" style={{ marginTop: 4 }}>
            <span className="switch">
              <input
                type="checkbox"
                checked={draft.is_active}
                onChange={(e) => setField("is_active", e.target.checked)}
              />
              <span className="switch-slider" />
            </span>
            <span>{s.fldIsActive}</span>
          </label>
        </div>
        <div className="drawer-footer">
          <button className="btn" onClick={closeDrawer} disabled={saving}>{s.cancel}</button>
          <button className="btn btn-primary" onClick={() => void save()} disabled={saving}>
            <i className="ti ti-device-floppy" /> {s.save}
          </button>
        </div>
      </div>
    </div>,
    <button className="btn btn-primary" onClick={openNew}><i className="ti ti-plus" /> {s.newFaq}</button>,
  );
}
