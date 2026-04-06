import { apiFetchJson } from "./api-client";
import type { ApiSuccessEnvelope } from "./api-envelope";

const LOC = "/localization";

/** Mirrors `ContentTranslation::ENTITY_TYPES` (frozen API contract). */
export const LOCALIZATION_ENTITY_TYPES = [
  "offer",
  "package",
  "hotel",
  "flight",
  "transfer",
  "excursion",
  "car",
  "visa",
  "company",
] as const;

/** Mirrors `ContentTranslation::TRANSLATABLE_FIELDS`. */
export const LOCALIZATION_TRANSLATABLE_FIELDS = [
  "title",
  "subtitle",
  "description",
  "package_title",
  "package_subtitle",
  "hotel_name",
  "short_description",
  "highlights",
  "included_summary",
  "notes",
] as const;

/** Mirrors `Notification::EVENT_TYPES`. */
export const NOTIFICATION_TEMPLATE_EVENTS = [
  "package_order.created",
  "package_order.paid",
  "package_order.confirmed",
  "package_order.partially_confirmed",
  "package_order.partially_failed",
  "package_order.cancelled",
  "order.confirmed",
  "order.cancelled",
  "payment.succeeded",
  "payment.failed",
  "account.welcome",
  "account.password_reset",
] as const;

export type LocalizationLanguageRow = {
  id: number;
  code: string;
  name: string;
  name_en?: string | null;
  is_default: boolean;
  is_enabled?: boolean;
  rtl?: boolean;
  sort_order: number;
};

export type LocalizationTranslationsPayload = {
  entity_type: string;
  entity_id: number;
  language_code: string;
  translations: Record<string, string | null>;
};

export type NotificationTemplateRow = {
  event_type: string;
  language_code: string;
  channel: string;
  title_template: string;
  body_template: string;
  is_active: boolean;
};

export type UiTranslationRow = {
  key: string;
  value: string;
};

export type UiTranslationsPaginatedPayload = {
  data: UiTranslationRow[];
  total: number;
  per_page: number;
  current_page: number;
  last_page: number;
};

export async function apiLocalizationLanguages(
  token?: string | null
): Promise<ApiSuccessEnvelope<LocalizationLanguageRow[]>> {
  return apiFetchJson(`${LOC}/languages`, { method: "GET", token: token ?? undefined });
}

/** Admin: returns ALL languages including disabled ones */
export async function apiAdminLanguages(
  token: string
): Promise<ApiSuccessEnvelope<LocalizationLanguageRow[]>> {
  return apiFetchJson(`${LOC}/languages/all`, { method: "GET", token });
}

export async function apiSetDefaultLanguage(
  token: string,
  languageId: number
): Promise<ApiSuccessEnvelope<{ id: number; code: string; is_default: boolean }>> {
  return apiFetchJson(`${LOC}/languages/${languageId}/set-default`, { method: "PATCH", token, body: {} });
}

export async function apiEditLanguage(
  token: string,
  languageId: number,
  body: { name: string; name_en: string; rtl: boolean }
): Promise<ApiSuccessEnvelope<LocalizationLanguageRow>> {
  return apiFetchJson(`${LOC}/languages/${languageId}/edit`, { method: "PATCH", token, body });
}

export async function apiLocalizationCreateLanguage(
  token: string,
  body: { code: string; name: string; name_en: string }
): Promise<ApiSuccessEnvelope<LocalizationLanguageRow & { is_enabled: boolean }>> {
  return apiFetchJson(`${LOC}/languages`, { method: "POST", token, body });
}

export async function apiLocalizationDeleteLanguage(
  token: string,
  languageId: number
): Promise<ApiSuccessEnvelope<Record<string, never>>> {
  return apiFetchJson(`${LOC}/languages/${languageId}`, { method: "DELETE", token, body: {} });
}

export async function apiUiTranslationsGetAdmin(
  token: string,
  params: { lang: string; page?: number; per_page?: number; search?: string }
): Promise<ApiSuccessEnvelope<UiTranslationsPaginatedPayload>> {
  const q = new URLSearchParams();
  q.set("lang", params.lang);
  if (params.page) q.set("page", String(params.page));
  if (params.per_page) q.set("per_page", String(params.per_page));
  if (params.search) q.set("search", params.search);
  return apiFetchJson(`${LOC}/ui-translations/admin?${q.toString()}`, { method: "GET", token });
}

export async function apiUiTranslationsSave(
  token: string,
  body: { language_code: string; translations: Record<string, string> }
): Promise<ApiSuccessEnvelope<{ saved: number }>> {
  return apiFetchJson(`${LOC}/ui-translations`, { method: "POST", token, body });
}

export async function apiLocalizationToggleLanguage(
  token: string,
  languageId: number
): Promise<ApiSuccessEnvelope<LocalizationLanguageRow & { is_enabled: boolean }>> {
  return apiFetchJson(`${LOC}/languages/${languageId}/toggle`, {
    method: "PATCH",
    token,
    body: {},
  });
}

export async function apiLocalizationTranslationsGet(
  token: string | null | undefined,
  params: {
    entity_type: string;
    entity_id: number;
    lang?: string;
    fields?: readonly string[];
  }
): Promise<ApiSuccessEnvelope<LocalizationTranslationsPayload>> {
  const q = new URLSearchParams();
  q.set("entity_type", params.entity_type);
  q.set("entity_id", String(params.entity_id));
  if (params.lang) q.set("lang", params.lang);
  if (params.fields?.length) {
    for (const f of params.fields) q.append("fields[]", f);
  }
  return apiFetchJson(`${LOC}/translations?${q.toString()}`, {
    method: "GET",
    token: token ?? undefined,
  });
}

export async function apiLocalizationTranslationsSet(
  token: string,
  body: {
    entity_type: string;
    entity_id: number;
    language_code: string;
    translations: Record<string, string>;
  }
): Promise<
  ApiSuccessEnvelope<{
    entity_type: string;
    entity_id: number;
    language_code: string;
    fields_saved: number;
  }>
> {
  return apiFetchJson(`${LOC}/translations`, { method: "POST", token, body });
}

export async function apiLocalizationTranslationsDelete(
  token: string,
  body: {
    entity_type: string;
    entity_id: number;
    language_code?: string | null;
  }
): Promise<ApiSuccessEnvelope<{ deleted_count: number }>> {
  return apiFetchJson(`${LOC}/translations`, { method: "DELETE", token, body });
}

export async function apiLocalizationTemplateGet(
  token: string | null | undefined,
  event: string,
  params?: { lang?: string; channel?: string }
): Promise<ApiSuccessEnvelope<NotificationTemplateRow>> {
  const q = new URLSearchParams();
  if (params?.lang) q.set("lang", params.lang);
  if (params?.channel) q.set("channel", params.channel);
  const qs = q.toString();
  const path = `${LOC}/templates/${encodeURIComponent(event)}${qs ? `?${qs}` : ""}`;
  return apiFetchJson(path, { method: "GET", token: token ?? undefined });
}

export async function apiLocalizationTemplatePatch(
  token: string,
  event: string,
  body: {
    lang: string;
    channel: string;
    title_template: string;
    body_template: string;
    is_active?: boolean;
  }
): Promise<
  ApiSuccessEnvelope<
    NotificationTemplateRow & {
      id?: number;
      updated_at?: string | null;
    }
  >
> {
  return apiFetchJson(`${LOC}/templates/${encodeURIComponent(event)}`, {
    method: "PATCH",
    token,
    body,
  });
}
