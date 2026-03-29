import { apiFetchJson } from "./api-client";
import type { ApiListMeta, ApiSuccessEnvelope } from "./api-envelope";

const PAGINATED = "/notifications/paginated";
const UNREAD = "/notifications/unread-count";
const READ_ALL = "/notifications/read-all";

export type NotificationRow = {
  id: number;
  type: string;
  title: string;
  message: string;
  status: string;
  event_type: string;
  subject_type: string | null;
  subject_id: number | null;
  related_company_id: number | null;
  priority: string | null;
  created_at?: string | null;
};

export async function apiNotificationsPaginated(
  token: string,
  params: { page?: number; per_page?: number }
): Promise<ApiSuccessEnvelope<NotificationRow[]> & { meta: ApiListMeta }> {
  const q = new URLSearchParams();
  if (params.page != null) q.set("page", String(params.page));
  if (params.per_page != null) q.set("per_page", String(params.per_page));
  const qs = q.toString();
  return apiFetchJson(`${PAGINATED}${qs ? `?${qs}` : ""}`, { method: "GET", token });
}

export async function apiNotificationsUnreadCount(
  token: string
): Promise<ApiSuccessEnvelope<{ unread_count: number }>> {
  return apiFetchJson(UNREAD, { method: "GET", token });
}

export async function apiNotificationMarkRead(
  token: string,
  id: number
): Promise<ApiSuccessEnvelope<NotificationRow>> {
  return apiFetchJson(`/notifications/${id}/read`, { method: "POST", token, body: {} });
}

export async function apiNotificationsMarkAllRead(
  token: string
): Promise<ApiSuccessEnvelope<{ updated_count: number }>> {
  return apiFetchJson(READ_ALL, { method: "POST", token, body: {} });
}
