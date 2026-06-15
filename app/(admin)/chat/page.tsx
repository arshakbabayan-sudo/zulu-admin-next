"use client";

/**
 * admin v3 — internal Chat (messaging). 1:1 port of
 * docs/admin_designe/5_chat/chat.html.
 *
 * Renders its OWN mgmt chrome (Sidebar/Header/management.css, off-canvas mobile
 * nav) like Inventory / Bookings / CRM / Settings — a two-pane messaging surface
 * (conversation list + thread) inside a `.card`, NOT a list/table.
 *
 * Phase 1 polling (NO websockets): while a thread is open poll
 * GET …/messages?after_id every 2500ms; refresh the conversation list (unread +
 * previews) every 5000ms. The only write surfaces are the composer (send) and the
 * New-chat colleague picker drawer (create/reuse a 1:1 conversation).
 *
 * Role scoping is server-side: super/platform staff also see B2C `customer`
 * threads (Customer badge + email); operator/agent are gated by `chat.view` and
 * only chat with company colleagues. Customer-thread titles are NEVER translated.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import "../platform/management/management.css";
import { Sidebar, Header } from "../platform/management/MgmtPage";
import { useMgmtMobileNav } from "@/lib/use-mgmt-mobile-nav";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { canAccessChatSection, canAccessNotificationsNav } from "@/lib/access";
import { apiNotificationsUnreadCount } from "@/lib/notifications-api";
import {
  apiChatColleagues,
  apiChatConversations,
  apiChatMessages,
  apiCreateChatConversation,
  apiSendChatMessage,
  type ChatColleague,
  type ChatConversationRow,
  type ChatMessageRow,
} from "@/lib/chat-api";
import { formatRelativeTime } from "@/lib/admin-v2-helpers";
import { chatStrings } from "./chat-i18n";

const TONES = ["", "avatar-teal", "avatar-amber", "avatar-blue"];
function initials(name?: string | null): string {
  if (!name) return "—";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? "";
  const b = parts[1]?.[0] ?? "";
  return (a + b).toUpperCase() || "—";
}
function tone(key: string | number): string {
  let h = 0;
  const s = String(key);
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return TONES[h % TONES.length]!;
}

export default function ChatPage() {
  const router = useRouter();
  const { token, user, logout } = useAdminAuth();
  const { lang, setLang, languageOptions } = useLanguage();
  const s = useMemo(() => chatStrings(lang), [lang]);
  const allowed = canAccessChatSection(user);

  const { sidebarCollapsed, onHamburger, closeNav, layoutClass } = useMgmtMobileNav();
  const [unreadCount, setUnreadCount] = useState(0);

  const [convs, setConvs] = useState<ChatConversationRow[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessageRow[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [threadActive, setThreadActive] = useState(false); // mobile: slide thread in

  // New-chat picker
  const [pickerOpen, setPickerOpen] = useState(false);
  const [colleagues, setColleagues] = useState<ChatColleague[]>([]);
  const [colleagueFilter, setColleagueFilter] = useState("");

  const lastMsgId = useRef(0);
  const threadRef = useRef<HTMLDivElement>(null);

  const companyId = user?.companies?.[0]?.id ?? null;

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

  const loadConvs = useCallback(async () => {
    if (!token) return;
    try {
      const res = await apiChatConversations(token);
      setConvs(res.data);
    } catch (e) {
      setErr(e instanceof Error ? e.message : s.errLoadConversations);
    }
  }, [token, s]);

  const loadMessages = useCallback(
    async (conversationId: number, append: boolean) => {
      if (!token) return;
      try {
        const res = await apiChatMessages(token, conversationId, append ? lastMsgId.current : 0);
        const fetched = res.data;
        const newest = fetched[fetched.length - 1];
        if (newest) {
          lastMsgId.current = newest.id;
          setMessages((prev) => (append ? [...prev, ...fetched] : fetched));
        } else if (!append) {
          setMessages([]);
        }
      } catch {
        // transient poll error — ignore, next tick retries
      }
    },
    [token],
  );

  // Initial conversation list + 5s refresh for unread counts.
  useEffect(() => {
    if (!allowed) return;
    void loadConvs();
    const id = window.setInterval(() => void loadConvs(), 5000);
    return () => window.clearInterval(id);
  }, [allowed, loadConvs]);

  // When the active conversation changes, load its messages fresh.
  useEffect(() => {
    if (activeId == null) return;
    lastMsgId.current = 0;
    setMessages([]);
    void loadMessages(activeId, false);
  }, [activeId, loadMessages]);

  // Poll the open thread every 2.5s for new messages.
  useEffect(() => {
    if (activeId == null) return;
    const id = window.setInterval(() => void loadMessages(activeId, true), 2500);
    return () => window.clearInterval(id);
  }, [activeId, loadMessages]);

  // Auto-scroll to newest.
  useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [messages]);

  const selectConv = (id: number) => {
    setActiveId(id);
    setThreadActive(true);
  };
  const backToList = () => {
    setThreadActive(false);
    setActiveId(null);
  };

  const openPicker = useCallback(async () => {
    setPickerOpen(true);
    setColleagueFilter("");
    if (!token) return;
    try {
      const res = await apiChatColleagues(token, companyId ?? undefined);
      setColleagues(res.data);
    } catch {
      setColleagues([]);
    }
  }, [token, companyId]);

  const startChat = async (colleague: ChatColleague) => {
    if (!token || companyId == null) return;
    try {
      const res = await apiCreateChatConversation(token, { company_id: companyId, user_ids: [colleague.id] });
      setPickerOpen(false);
      await loadConvs();
      selectConv(res.data.id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : s.errStartChat);
    }
  };

  const send = async () => {
    const body = draft.trim();
    if (!token || activeId == null || body === "") return;
    setSending(true);
    setDraft("");
    try {
      const res = await apiSendChatMessage(token, activeId, body);
      lastMsgId.current = res.data.id;
      setMessages((prev) => [...prev, res.data]);
      void loadConvs();
    } catch (e) {
      setErr(e instanceof Error ? e.message : s.errSend);
      setDraft(body); // restore on failure
    } finally {
      setSending(false);
    }
  };

  // Escape closes the picker drawer.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setPickerOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const active = convs.find((c) => c.id === activeId) ?? null;
  const convTitle = (c: ChatConversationRow): string =>
    c.title || (c.is_customer && c.customer?.name ? c.customer.name : c.is_customer ? s.customerBadge : "");
  const filteredColleagues = colleagues.filter((c) =>
    `${c.name} ${c.email}`.toLowerCase().includes(colleagueFilter.toLowerCase()),
  );

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

            {/* single-tab section strip (one route: /chat) — shell consistency */}
            <div className="section-tabs">
              <button className="section-tab active"><i className="ti ti-messages" /> {s.title}</button>
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
      <div className={`chat-error ${err ? "show" : ""}`}>
        <i className="ti ti-alert-triangle" />
        <span>{err}</span>
      </div>

      <div className="card" style={{ marginBottom: 0 }}>
        <div className={`chat-shell ${threadActive ? "thread-active" : ""}`}>
          {/* LEFT: conversation list */}
          <div className="conv-list">
            {convs.length === 0 ? (
              <div className="conv-empty">{s.convEmpty}</div>
            ) : (
              convs.map((c) => {
                const title = convTitle(c);
                const last = c.last_message?.body ?? null;
                return (
                  <div key={c.id} className={`conv-row ${c.id === activeId ? "active" : ""}`} onClick={() => selectConv(c.id)}>
                    <span className={`avatar ${tone(c.id)}`}>{initials(title)}</span>
                    <div className="conv-body">
                      <div className="conv-top">
                        <span className="conv-title">{title}</span>
                        {c.is_customer && <span className="badge badge-primary">{s.customerBadge}</span>}
                        {c.unread > 0 && <span className="unread-badge">{c.unread}</span>}
                      </div>
                      {last && <div className="conv-preview">{last.length > 120 ? last.slice(0, 120) : last}</div>}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* RIGHT: thread column */}
          <div className="thread-col">
            {active == null ? (
              <div className="thread-empty">
                <div className="empty-state">
                  <div className="es-icon"><i className="ti ti-message-circle" /></div>
                  <div className="es-title">{s.threadEmptyTitle}</div>
                  <div className="es-sub">{s.threadEmptySubtitle}</div>
                </div>
              </div>
            ) : (
              <>
                <div className="thread-head">
                  <button className="icon-btn thread-back" onClick={backToList} title={s.back}><i className="ti ti-arrow-left" /></button>
                  <span className={`avatar ${tone(active.id)}`}>{initials(convTitle(active))}</span>
                  <div className="thread-head-main">
                    <div className="thread-title-line">
                      <span className="thread-title">{convTitle(active)}</span>
                      {active.is_customer && <span className="badge badge-primary">{s.customerBadge}</span>}
                    </div>
                    {active.is_customer && active.customer?.email && (
                      <div className="thread-cust-email">{active.customer.email}</div>
                    )}
                  </div>
                </div>

                <div className="thread-body" ref={threadRef}>
                  {messages.length === 0 ? (
                    <div className="thread-nomsg">{s.noMessages}</div>
                  ) : (
                    messages.map((m) => (
                      <div key={m.id} className={`msg-row ${m.mine ? "mine" : "theirs"}`}>
                        {!m.mine && <div className="msg-sender">{m.sender?.name ?? "—"}</div>}
                        <div className="msg-bubble">{m.body}</div>
                        <div className="msg-time">{formatRelativeTime(m.created_at)}</div>
                      </div>
                    ))
                  )}
                </div>

                <div className="composer">
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
                    placeholder={s.msgPlaceholder}
                    maxLength={5000}
                  />
                  <button className="btn btn-primary" onClick={() => void send()} disabled={sending || draft.trim() === ""} title={s.send}>
                    <i className="ti ti-send" />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* New-chat picker drawer (the only create surface) */}
      <div className={`drawer-overlay ${pickerOpen ? "open" : ""}`} onClick={() => setPickerOpen(false)} />
      <div className={`drawer chat-picker ${pickerOpen ? "open" : ""}`}>
        <div className="drawer-header">
          <div>
            <div className="card-title">{s.newChat}</div>
            <div className="card-subtitle">{s.pickerSubtitle}</div>
          </div>
          <button className="icon-btn" onClick={() => setPickerOpen(false)} title={s.close}><i className="ti ti-x" /></button>
        </div>
        <div className="drawer-body">
          <div className="picker-search">
            <i className="ti ti-search" />
            <input value={colleagueFilter} onChange={(e) => setColleagueFilter(e.target.value)} placeholder={s.searchColleaguesPh} />
          </div>
          {filteredColleagues.length === 0 ? (
            <div className="coll-empty">{s.noColleagues}</div>
          ) : (
            filteredColleagues.map((col) => (
              <div key={col.id} className="coll-row" onClick={() => void startChat(col)}>
                <span className={`avatar ${tone(col.id)}`}>{initials(col.name)}</span>
                <div className="coll-main">
                  <div className="coll-name">{col.name}</div>
                  <div className="coll-email">{col.email}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>,
    <button className="btn btn-primary" onClick={() => void openPicker()}><i className="ti ti-plus" /> {s.newChat}</button>,
  );
}
