/**
 * Internal chat API client (Phase 1 — polling).
 * Backend: ChatController @ /chat/* (2026-06-01). Auth-only, company-scoped.
 */
import { apiFetchJson } from "./api-client";
import type { ApiSuccessEnvelope } from "./api-envelope";

export type ChatColleague = { id: number; name: string; email: string };

export type ChatConversationRow = {
  id: number;
  type: "direct" | "group" | "customer";
  title: string;
  company_id: number | null;
  participants: { id: number; name: string }[];
  /** Roadmap §4 — B2C customer ↔ platform support thread. */
  is_customer?: boolean;
  customer?: { id: number; name: string; email: string } | null;
  unread: number;
  last_message: { body: string; created_at: string | null } | null;
  last_message_at: string | null;
};

export type ChatMessageRow = {
  id: number;
  body: string;
  sender: { id: number; name: string } | null;
  mine: boolean;
  created_at: string | null;
};

export async function apiChatColleagues(
  token: string,
  companyId?: number,
): Promise<ApiSuccessEnvelope<ChatColleague[]>> {
  const qs = companyId != null ? `?company_id=${companyId}` : "";
  return apiFetchJson(`/chat/colleagues${qs}`, { method: "GET", token });
}

export async function apiChatConversations(
  token: string,
): Promise<ApiSuccessEnvelope<ChatConversationRow[]>> {
  return apiFetchJson(`/chat/conversations`, { method: "GET", token });
}

export async function apiCreateChatConversation(
  token: string,
  body: { company_id: number; user_ids: number[]; title?: string },
): Promise<ApiSuccessEnvelope<{ id: number; reused: boolean }>> {
  return apiFetchJson(`/chat/conversations`, { method: "POST", token, body });
}

export async function apiChatMessages(
  token: string,
  conversationId: number,
  afterId = 0,
): Promise<ApiSuccessEnvelope<ChatMessageRow[]>> {
  const qs = afterId > 0 ? `?after_id=${afterId}` : "";
  return apiFetchJson(`/chat/conversations/${conversationId}/messages${qs}`, { method: "GET", token });
}

export async function apiSendChatMessage(
  token: string,
  conversationId: number,
  body: string,
): Promise<ApiSuccessEnvelope<ChatMessageRow>> {
  return apiFetchJson(`/chat/conversations/${conversationId}/messages`, {
    method: "POST",
    token,
    body: { body },
  });
}
