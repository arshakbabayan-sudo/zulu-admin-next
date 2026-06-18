import { apiFetchJson } from "./api-client";
import type { ApiSuccessEnvelope } from "./api-envelope";

const PA = "/platform-admin";

/**
 * FAQ admin editor — backend `App\Http\Controllers\…\FaqController` under
 * `/platform-admin/faqs` (Sanctum bearer). One row holds all three languages
 * (question_/answer_ × hy/ru/en) plus the category + ordering + active flag.
 */
export type Faq = {
  id: number;
  category: string;
  question_hy: string;
  question_ru: string;
  question_en: string;
  answer_hy: string;
  answer_ru: string;
  answer_en: string;
  sort_order: number;
  is_active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

/** Create / update payload. category + all 6 language fields required on create. */
export type FaqPayload = Partial<{
  category: string;
  question_hy: string;
  question_ru: string;
  question_en: string;
  answer_hy: string;
  answer_ru: string;
  answer_en: string;
  sort_order: number;
  is_active: boolean;
}>;

export async function apiFaqs(token: string): Promise<ApiSuccessEnvelope<Faq[]>> {
  return apiFetchJson(`${PA}/faqs`, { method: "GET", token });
}

export async function apiFaqCreate(
  token: string,
  body: FaqPayload
): Promise<ApiSuccessEnvelope<Faq>> {
  return apiFetchJson(`${PA}/faqs`, { method: "POST", token, body });
}

export async function apiFaqUpdate(
  token: string,
  id: number,
  body: FaqPayload
): Promise<ApiSuccessEnvelope<Faq>> {
  return apiFetchJson(`${PA}/faqs/${id}`, { method: "PATCH", token, body });
}

export async function apiFaqDelete(token: string, id: number): Promise<ApiSuccessEnvelope<null>> {
  return apiFetchJson(`${PA}/faqs/${id}`, { method: "DELETE", token });
}
