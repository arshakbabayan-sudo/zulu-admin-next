"use client";

/**
 * Internal chat (Phase 1 — polling). Two-pane: conversation list (left) +
 * message thread (right). Company-scoped; you chat with colleagues (option Բ).
 *
 * Polling: while a conversation is open, fetch messages after the last seen id
 * every 4s; the conversation list refreshes every 8s for unread counts. No
 * websockets yet (Phase 2 can swap the poll for a live channel, same API).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useDocumentTitle } from "@/lib/use-document-title";
import { canAccessChatSection } from "@/lib/access";
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
import { PageHeader, V2Card, EmptyState, V2Button } from "@/components/ui/v2";
import { avatarInitials, avatarStyle, formatRelativeTime, pickAvatarTone } from "@/lib/admin-v2-helpers";
import { MessageSquare, Plus, Send, X, Search } from "lucide-react";

export default function ChatPage() {
  useDocumentTitle("Chat");
  const { token, user } = useAdminAuth();
  const allowed = canAccessChatSection(user);

  const [convs, setConvs] = useState<ChatConversationRow[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessageRow[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // New-chat picker
  const [pickerOpen, setPickerOpen] = useState(false);
  const [colleagues, setColleagues] = useState<ChatColleague[]>([]);
  const [colleagueFilter, setColleagueFilter] = useState("");

  const lastMsgId = useRef(0);
  const threadRef = useRef<HTMLDivElement>(null);

  const companyId = user?.companies?.[0]?.id ?? null;

  const loadConvs = useCallback(async () => {
    if (!token) return;
    try {
      const res = await apiChatConversations(token);
      setConvs(res.data);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load conversations");
    }
  }, [token]);

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

  // Initial conversation list + 8s refresh for unread counts.
  useEffect(() => {
    if (!allowed) return;
    void loadConvs();
    const id = window.setInterval(() => void loadConvs(), 8000);
    return () => window.clearInterval(id);
  }, [allowed, loadConvs]);

  // When the active conversation changes, load its messages fresh.
  useEffect(() => {
    if (activeId == null) return;
    lastMsgId.current = 0;
    setMessages([]);
    void loadMessages(activeId, false);
  }, [activeId, loadMessages]);

  // Poll the open thread every 4s for new messages.
  useEffect(() => {
    if (activeId == null) return;
    const id = window.setInterval(() => void loadMessages(activeId, true), 4000);
    return () => window.clearInterval(id);
  }, [activeId, loadMessages]);

  // Auto-scroll to newest.
  useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [messages]);

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
      setActiveId(res.data.id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to start chat");
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
      setErr(e instanceof Error ? e.message : "Failed to send");
      setDraft(body); // restore on failure
    } finally {
      setSending(false);
    }
  };

  if (!allowed) return <ForbiddenNotice />;

  const active = convs.find((c) => c.id === activeId) ?? null;
  const filteredColleagues = colleagues.filter((c) =>
    `${c.name} ${c.email}`.toLowerCase().includes(colleagueFilter.toLowerCase()),
  );

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Home", href: "/dashboard" }, { label: "Chat" }]}
        title="Chat"
        subtitle="Message colleagues in your company"
        actions={
          <V2Button variant="primary" onClick={() => void openPicker()} icon={<Plus className="h-4 w-4" />}>
            New chat
          </V2Button>
        }
      />

      {err ? (
        <div className="mb-4 rounded-md border p-3 text-[13px]" style={{ borderColor: "var(--admin-border)", color: "var(--admin-danger)" }}>
          {err}
        </div>
      ) : null}

      <V2Card>
        <div className="grid" style={{ gridTemplateColumns: "300px 1fr", minHeight: "60vh" }}>
          {/* ── Conversation list ── */}
          <div className="border-r" style={{ borderColor: "var(--admin-border)" }}>
            {convs.length === 0 ? (
              <div className="p-4 text-[13px]" style={{ color: "var(--admin-text-secondary)" }}>
                No conversations yet. Start one with “New chat”.
              </div>
            ) : (
              <ul>
                {convs.map((c) => {
                  const tone = pickAvatarTone(c.id);
                  const isActive = c.id === activeId;
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => setActiveId(c.id)}
                        className="flex w-full items-center gap-2.5 border-b px-3 py-2.5 text-left transition"
                        style={{
                          borderColor: "var(--admin-border)",
                          backgroundColor: isActive ? "var(--admin-primary-soft)" : "transparent",
                        }}
                      >
                        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold" style={avatarStyle(tone)}>
                          {avatarInitials(c.title)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className="truncate text-[13px] font-medium" style={{ color: "var(--admin-text-primary)" }}>
                              {c.title}
                            </span>
                            {c.unread > 0 ? (
                              <span className="ml-auto rounded-full px-[6px] py-px text-[10px] font-bold text-white" style={{ backgroundColor: "var(--admin-primary)" }}>
                                {c.unread}
                              </span>
                            ) : null}
                          </span>
                          {c.last_message ? (
                            <span className="block truncate text-[12px]" style={{ color: "var(--admin-text-secondary)" }}>
                              {c.last_message.body}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* ── Thread ── */}
          <div className="flex flex-col" style={{ maxHeight: "70vh" }}>
            {active == null ? (
              <EmptyState
                icon={<MessageSquare className="h-10 w-10" />}
                title="Select a conversation"
                subtitle="Pick a chat on the left, or start a new one."
              />
            ) : (
              <>
                <div className="border-b px-4 py-3" style={{ borderColor: "var(--admin-border)" }}>
                  <span className="text-[14px] font-semibold" style={{ color: "var(--admin-text-primary)" }}>{active.title}</span>
                </div>
                <div ref={threadRef} className="flex-1 overflow-y-auto px-4 py-3" style={{ backgroundColor: "var(--admin-bg-secondary)" }}>
                  {messages.length === 0 ? (
                    <p className="py-8 text-center text-[13px]" style={{ color: "var(--admin-text-tertiary)" }}>
                      No messages yet — say hello.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {messages.map((m) => (
                        <div key={m.id} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
                          <div
                            className="max-w-[70%] rounded-[10px] px-3 py-2"
                            style={{
                              backgroundColor: m.mine ? "var(--admin-primary)" : "var(--bg-primary,#fff)",
                              color: m.mine ? "#fff" : "var(--admin-text-primary)",
                              border: m.mine ? "none" : "1px solid var(--admin-border)",
                            }}
                          >
                            {!m.mine ? (
                              <div className="mb-0.5 text-[11px] font-semibold" style={{ color: "var(--admin-text-secondary)" }}>
                                {m.sender?.name ?? "—"}
                              </div>
                            ) : null}
                            <div className="text-[13px] whitespace-pre-wrap break-words">{m.body}</div>
                            <div className="mt-0.5 text-[10px]" style={{ opacity: 0.7 }}>
                              {formatRelativeTime(m.created_at)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 border-t px-3 py-2.5" style={{ borderColor: "var(--admin-border)" }}>
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
                    placeholder="Write a message…"
                    className="h-[38px] flex-1 rounded-md border px-3 text-[13px] outline-none"
                    style={{ borderColor: "var(--admin-border)" }}
                  />
                  <V2Button variant="primary" onClick={() => void send()} disabled={sending || draft.trim() === ""} icon={<Send className="h-4 w-4" />}>
                    Send
                  </V2Button>
                </div>
              </>
            )}
          </div>
        </div>
      </V2Card>

      {/* ── New-chat picker ── */}
      {pickerOpen ? (
        <>
          <div className="fixed inset-0 z-50 bg-black/30" onClick={() => setPickerOpen(false)} aria-hidden />
          <div className="fixed inset-y-0 right-0 z-50 flex w-[380px] max-w-full flex-col bg-white shadow-xl" style={{ borderLeft: "1px solid var(--admin-border)" }}>
            <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: "var(--admin-border)" }}>
              <span className="text-[15px] font-semibold">New chat</span>
              <button type="button" onClick={() => setPickerOpen(false)} aria-label="Close" className="rounded-md p-1 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="border-b px-4 py-3" style={{ borderColor: "var(--admin-border)" }}>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--admin-text-tertiary)" }} />
                <input
                  value={colleagueFilter}
                  onChange={(e) => setColleagueFilter(e.target.value)}
                  placeholder="Search colleagues…"
                  className="h-[36px] w-full rounded-md border pl-9 pr-3 text-[13px] outline-none"
                  style={{ borderColor: "var(--admin-border)" }}
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {filteredColleagues.length === 0 ? (
                <p className="px-4 py-6 text-center text-[13px]" style={{ color: "var(--admin-text-secondary)" }}>
                  No colleagues found.
                </p>
              ) : (
                <ul>
                  {filteredColleagues.map((col) => {
                    const tone = pickAvatarTone(col.id);
                    return (
                      <li key={col.id}>
                        <button
                          type="button"
                          onClick={() => void startChat(col)}
                          className="flex w-full items-center gap-2.5 border-b px-4 py-2.5 text-left hover:bg-slate-50"
                          style={{ borderColor: "var(--admin-border)" }}
                        >
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-semibold" style={avatarStyle(tone)}>
                            {avatarInitials(col.name)}
                          </span>
                          <span>
                            <span className="block text-[13px] font-medium" style={{ color: "var(--admin-text-primary)" }}>{col.name}</span>
                            <span className="block text-[12px]" style={{ color: "var(--admin-text-secondary)" }}>{col.email}</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
