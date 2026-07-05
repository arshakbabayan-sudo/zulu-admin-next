import { apiFetchJson } from "./api-client";
import type { ApiSuccessEnvelope } from "./api-envelope";

/**
 * Social inbox (Facebook Messenger / Instagram Direct) — CRM read side.
 * Backend: crm/social/* (auth:sanctum), see SocialInboxController.
 */

const BASE = "/platform-admin/crm/social/conversations";

export type SocialChannel = "facebook" | "instagram";

export type SocialConversationRow = {
  id: number;
  channel: SocialChannel;
  psid: string;
  customer_name: string | null;
  lead: { id: number; name: string | null; status: string } | null;
  unread_count: number;
  last_message_at: string | null;
  last_preview: string;
  last_direction: "in" | "out" | null;
};

export type SocialMessageRow = {
  id: number;
  direction: "in" | "out";
  text: string | null;
  attachments: Array<{ type: string; url: string | null }> | null;
  created_at: string | null;
};

export type SocialThread = {
  id: number;
  channel: SocialChannel;
  psid: string;
  customer_name: string | null;
  messages: SocialMessageRow[];
};

export async function apiSocialConversations(
  token: string
): Promise<ApiSuccessEnvelope<SocialConversationRow[]>> {
  return apiFetchJson(BASE, { method: "GET", token });
}

export async function apiSocialMessages(
  token: string,
  conversationId: number
): Promise<ApiSuccessEnvelope<SocialThread>> {
  return apiFetchJson(`${BASE}/${conversationId}/messages`, { method: "GET", token });
}

export async function apiSocialMarkRead(
  token: string,
  conversationId: number
): Promise<{ success: boolean }> {
  return apiFetchJson(`${BASE}/${conversationId}/read`, { method: "POST", token, body: {} });
}

export async function apiSocialReply(
  token: string,
  conversationId: number,
  text: string
): Promise<ApiSuccessEnvelope<SocialMessageRow>> {
  return apiFetchJson(`${BASE}/${conversationId}/reply`, { method: "POST", token, body: { text } });
}
