"use client";

/**
 * CRM → Messages: the social inbox. Facebook Messenger (and later Instagram
 * Direct) conversations from the company's Meta pages, shown two-pane
 * (conversation list ↔ thread) in the same chrome/classes as the internal Chat
 * page. Read-only for now — replying from here lands in a follow-up (needs the
 * page access token); until then the composer is disabled with a hint.
 *
 * Wired to /platform-admin/crm/social/* (SocialInboxController). Polls so new
 * messages appear without a manual refresh.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { crmStrings } from "./crm-i18n";
import { ApiRequestError } from "@/lib/api-client";
import {
  apiSocialConversations,
  apiSocialMessages,
  type SocialConversationRow,
  type SocialThread,
} from "@/lib/social-inbox-api";

function initials(name: string | null | undefined): string {
  if (!name) return "•";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "•";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

const TONES = ["", "avatar-teal", "avatar-amber", "avatar-blue"] as const;
function tone(key: number): string {
  return TONES[Math.abs(key) % TONES.length]!;
}

function relTime(input: string | null): string {
  if (!input) return "";
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit" });
}

function channelIcon(channel: string): string {
  return channel === "instagram" ? "ti-brand-instagram" : "ti-brand-messenger";
}

export function SocialInboxPane({ token, lang }: { token: string | null; lang: string }) {
  const s = crmStrings(lang);
  const [convs, setConvs] = useState<SocialConversationRow[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [thread, setThread] = useState<SocialThread | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const threadRef = useRef<HTMLDivElement | null>(null);

  const convTitle = useCallback(
    (c: { customer_name: string | null; psid: string }) =>
      c.customer_name ?? `${s.msgCustomerFallback} · ${c.psid.slice(0, 6)}`,
    [s]
  );

  const loadConvs = useCallback(async () => {
    if (!token) return;
    try {
      const res = await apiSocialConversations(token);
      setConvs(res.data);
      setErr(null);
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : String(e));
    }
  }, [token]);

  const loadThread = useCallback(
    async (id: number) => {
      if (!token) return;
      try {
        const res = await apiSocialMessages(token, id);
        setThread(res.data);
        // Opening clears unread server-side; mirror it locally.
        setConvs((prev) => prev.map((c) => (c.id === id ? { ...c, unread_count: 0 } : c)));
      } catch (e) {
        setErr(e instanceof ApiRequestError ? e.message : String(e));
      }
    },
    [token]
  );

  // Initial + polling for the conversation list.
  useEffect(() => {
    void loadConvs();
    const t = setInterval(() => void loadConvs(), 6000);
    return () => clearInterval(t);
  }, [loadConvs]);

  // Polling for the open thread.
  useEffect(() => {
    if (activeId == null) return;
    void loadThread(activeId);
    const t = setInterval(() => void loadThread(activeId), 5000);
    return () => clearInterval(t);
  }, [activeId, loadThread]);

  // Auto-scroll to the newest message.
  useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [thread]);

  const active = convs.find((c) => c.id === activeId) ?? null;
  const threadActive = activeId != null;

  return (
    <div>
      {err ? (
        <div className="alert alert-danger" style={{ marginBottom: 12 }}>
          <i className="ti ti-alert-triangle" />
          <span>{err}</span>
        </div>
      ) : null}

      <div className="card" style={{ marginBottom: 0 }}>
        <div className={`chat-shell ${threadActive ? "thread-active" : ""}`}>
          {/* LEFT: conversation list */}
          <div className="conv-list">
            {convs.length === 0 ? (
              <div className="conv-empty">{s.msgInboxEmpty}</div>
            ) : (
              convs.map((c) => {
                const title = convTitle(c);
                return (
                  <div
                    key={c.id}
                    className={`conv-row ${c.id === activeId ? "active" : ""}`}
                    onClick={() => setActiveId(c.id)}
                  >
                    <span className={`avatar ${tone(c.id)}`}>{initials(c.customer_name ?? title)}</span>
                    <div className="conv-body">
                      <div className="conv-top">
                        <span className="conv-title">
                          <i className={`ti ${channelIcon(c.channel)}`} style={{ fontSize: 13, marginRight: 4 }} />
                          {title}
                        </span>
                        {c.unread_count > 0 && <span className="unread-badge">{c.unread_count}</span>}
                      </div>
                      {c.last_preview && <div className="conv-preview">{c.last_preview}</div>}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* RIGHT: thread */}
          <div className="thread-col">
            {active == null ? (
              <div className="thread-empty">
                <div className="empty-state">
                  <div className="es-icon"><i className="ti ti-message-circle" /></div>
                  <div className="es-title">{s.msgThreadEmptyTitle}</div>
                  <div className="es-sub">{s.msgThreadEmptySubtitle}</div>
                </div>
              </div>
            ) : (
              <>
                <div className="thread-head">
                  <button className="icon-btn thread-back" onClick={() => setActiveId(null)} title={s.msgBack}>
                    <i className="ti ti-arrow-left" />
                  </button>
                  <span className={`avatar ${tone(active.id)}`}>{initials(active.customer_name ?? convTitle(active))}</span>
                  <div className="thread-head-main">
                    <div className="thread-title-line">
                      <span className="thread-title">{convTitle(active)}</span>
                      <span className="badge badge-info">
                        <i className={`ti ${channelIcon(active.channel)}`} style={{ fontSize: 12 }} />
                        {active.channel === "instagram" ? s.msgChannelInstagram : s.msgChannelFacebook}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="thread-body" ref={threadRef}>
                  {!thread || thread.messages.length === 0 ? (
                    <div className="thread-nomsg">{s.msgNoMessages}</div>
                  ) : (
                    thread.messages.map((m) => (
                      <div key={m.id} className={`msg-row ${m.direction === "out" ? "mine" : "theirs"}`}>
                        <div className="msg-bubble">
                          {m.text}
                          {m.attachments?.map((a, i) =>
                            a.url && a.type === "image" ? (
                              <a key={i} href={a.url} target="_blank" rel="noreferrer">
                                <img
                                  src={a.url}
                                  alt="attachment"
                                  style={{ maxWidth: "100%", borderRadius: 8, marginTop: m.text ? 6 : 0, display: "block" }}
                                />
                              </a>
                            ) : a.url ? (
                              <a key={i} href={a.url} target="_blank" rel="noreferrer" style={{ display: "block", marginTop: 4 }}>
                                <i className="ti ti-paperclip" /> {a.type}
                              </a>
                            ) : (
                              <span key={i} style={{ display: "block", marginTop: 4 }}>
                                <i className="ti ti-paperclip" /> {a.type}
                              </span>
                            )
                          )}
                        </div>
                        <div className="msg-time">{relTime(m.created_at)}</div>
                      </div>
                    ))
                  )}
                </div>

                {/* Read-only composer for now (reply needs the page token). */}
                <div className="composer">
                  <input disabled placeholder={s.msgReplyComingSoon} />
                  <button className="btn btn-primary" disabled title={s.msgReplyComingSoon}>
                    <i className="ti ti-send" />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
