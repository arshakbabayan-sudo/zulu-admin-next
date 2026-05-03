import { apiFetchJson } from "./api-client";
import { getApiPublicOrigin } from "./api-base";
import type { ApiListMeta, ApiSuccessEnvelope } from "./api-envelope";

export type AdminPageRow = {
  id: number;
  page_name: string;
  page_slug: string;
  meta_title?: string | null;
  meta_keywords?: string[] | null;
  meta_description?: string | null;
  status: number;
  enable_seo: boolean;
  is_bread_crumb: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

export type AdminPageTranslationRow = {
  id: number;
  page_id: number;
  lang: string;
  page_name: string;
  page_slug: string;
  meta_title?: string | null;
  meta_keywords?: string[] | null;
  meta_description?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type AdminWidgetContentTranslationRow = {
  id: number;
  widget_content_id: number;
  page_id: number;
  lang: string;
  widget_content: Record<string, unknown> | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type AdminWidgetContentRow = {
  id: number;
  page_id: number;
  widget_slug: string;
  ui_card_number: string;
  widget_content: Record<string, unknown> | null;
  position: number;
  status: number;
  created_at?: string | null;
  updated_at?: string | null;
  translations?: AdminWidgetContentTranslationRow[];
};

export type AdminPageDetailRow = AdminPageRow & {
  translations?: AdminPageTranslationRow[];
  widget_contents?: AdminWidgetContentRow[];
};

type AdminPagesListResponse = ApiSuccessEnvelope<AdminPageRow[]> & { meta: ApiListMeta };

export async function apiAdminPages(
  token: string,
  params: { page?: number }
): Promise<AdminPagesListResponse> {
  const q = new URLSearchParams();
  if (params.page != null) q.set("page", String(params.page));
  const qs = q.toString();
  return apiFetchJson(`/admin/pages${qs ? `?${qs}` : ""}`, { method: "GET", token });
}

export async function apiCreateAdminPage(
  token: string,
  body: { page_name: string; page_slug: string }
): Promise<ApiSuccessEnvelope<AdminPageRow> & { message?: string }> {
  return apiFetchJson("/admin/pages", { method: "POST", token, body });
}

export async function apiPatchAdminPageStatus(
  token: string,
  body: { page_id: number; status: 0 | 1 }
): Promise<ApiSuccessEnvelope<AdminPageRow> & { message?: string }> {
  return apiFetchJson("/admin/pages/change-status", { method: "PATCH", token, body });
}

export async function apiDeleteAdminPage(
  token: string,
  id: number
): Promise<ApiSuccessEnvelope<{ id: number }> & { message?: string }> {
  return apiFetchJson(`/admin/pages/${id}`, { method: "DELETE", token });
}

export async function apiAdminPage(
  token: string,
  id: number,
  lang?: string
): Promise<ApiSuccessEnvelope<AdminPageDetailRow>> {
  const q = new URLSearchParams();
  if (lang) q.set("lang", lang);
  return apiFetchJson(`/admin/pages/${id}${q.toString() ? `?${q.toString()}` : ""}`, { method: "GET", token });
}

export async function apiPatchAdminPage(
  token: string,
  id: number,
  body: Partial<
    Pick<
      AdminPageRow,
      | "page_name"
      | "page_slug"
      | "meta_title"
      | "meta_keywords"
      | "meta_description"
      | "status"
      | "enable_seo"
      | "is_bread_crumb"
    >
  >,
  options?: { lang?: string }
): Promise<ApiSuccessEnvelope<AdminPageRow> & { message?: string }> {
  const q = new URLSearchParams();
  if (options?.lang) q.set("lang", options.lang);
  return apiFetchJson(`/admin/pages/${id}${q.toString() ? `?${q.toString()}` : ""}`, { method: "PATCH", token, body });
}

export async function apiAddAdminPageWidget(
  token: string,
  body: { page_id: number; widget_slug: string; widget_content?: Record<string, unknown> }
): Promise<ApiSuccessEnvelope<AdminWidgetContentRow> & { message?: string }> {
  return apiFetchJson("/admin/pages/widgets/add", { method: "POST", token, body });
}

export async function apiUpdateAdminPageWidget(
  token: string,
  body: {
    widget_content_id: number;
    widget_content?: Record<string, unknown>;
    status?: 0 | 1;
    translations?: Array<{ lang: string; widget_content?: Record<string, unknown> }>;
  },
  options?: { lang?: string }
): Promise<ApiSuccessEnvelope<AdminWidgetContentRow> & { message?: string }> {
  const q = new URLSearchParams();
  if (options?.lang) q.set("lang", options.lang);
  return apiFetchJson(`/admin/pages/widgets/update${q.toString() ? `?${q.toString()}` : ""}`, { method: "POST", token, body });
}

export async function apiDeleteAdminPageWidget(
  token: string,
  id: number
): Promise<ApiSuccessEnvelope<{ id: number }> & { message?: string }> {
  return apiFetchJson(`/admin/pages/widgets/${id}`, { method: "DELETE", token });
}

export async function apiUploadAdminPageImage(
  token: string,
  file: File
): Promise<ApiSuccessEnvelope<{ path: string; url: string }> & { message?: string }> {
  const formData = new FormData();
  formData.append("image", file);
  const origin = getApiPublicOrigin().replace(/\/$/, "");
  const uploadUrl = `${origin}/api/admin/pages/widgets/upload-image`;
  return apiFetchJson(uploadUrl, {
    method: "POST",
    token,
    body: formData,
  });
}
