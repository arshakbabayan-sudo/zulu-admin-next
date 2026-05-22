import { apiFetchJson } from "./api-client";

/**
 * Backend ENTITY_TYPES (App\Models\ContentTranslation::ENTITY_TYPES).
 * Keep in sync with `backend/app/Models/ContentTranslation.php`.
 */
export type TranslatableEntityType =
  | "offer"
  | "package"
  | "hotel"
  | "flight"
  | "transfer"
  | "excursion"
  | "car"
  | "visa"
  | "company";

/**
 * Backend TRANSLATABLE_FIELDS — keep in sync with
 * `App\Models\ContentTranslation::TRANSLATABLE_FIELDS`.
 */
export type TranslatableField =
  | "title"
  | "subtitle"
  | "description"
  | "package_title"
  | "package_subtitle"
  | "hotel_name"
  | "short_description"
  | "highlights"
  | "included_summary"
  | "notes"
  | "full_address"
  | "district_or_area"
  | "review_label"
  | "tour_name"
  | "overview"
  | "meeting_pickup"
  | "additional_info"
  | "cancellation_policy"
  | "transfer_title"
  | "pickup_point_name"
  | "dropoff_point_name"
  | "tagline"
  | "body"
  | "name"
  | "address";

export type TranslationsPayload = {
  entity_type: TranslatableEntityType;
  entity_id: number;
  language_code: string;
  translations: Partial<Record<TranslatableField, string | null>>;
  available_fields: TranslatableField[];
};

export type TranslationRow = {
  value: string;
  is_manually_edited: boolean;
  /** 'manual' | 'ai_pending' | 'ai_completed' | 'ai_failed' */
  translation_status: string;
};

export type AllLanguagesPayload = {
  entity_type: TranslatableEntityType;
  entity_id: number;
  /** The language the operator first entered the record in. Null if not set yet. */
  source_lang: string | null;
  /** Outer key = language code; inner key = field name. */
  languages: Record<string, Record<string, TranslationRow>>;
  available_fields: TranslatableField[];
};

export async function fetchAllLanguages(
  token: string,
  entity_type: TranslatableEntityType,
  entity_id: number
): Promise<AllLanguagesPayload> {
  const json = await apiFetchJson<{ success: boolean; data: AllLanguagesPayload }>(
    `/localization/content-translations/${entity_type}/${entity_id}`,
    { token }
  );
  return json.data;
}

export async function saveTranslations(
  token: string,
  entity_type: TranslatableEntityType,
  entity_id: number,
  language_code: string,
  translations: Partial<Record<TranslatableField, string>>
): Promise<{ ai_translation_dispatched: boolean; source_language: string | null }> {
  const json = await apiFetchJson<{
    success: boolean;
    data: { ai_translation_dispatched: boolean; source_language: string | null };
  }>(`/localization/translations`, {
    method: "POST",
    token,
    body: {
      entity_type,
      entity_id,
      language_code,
      translations,
    },
  });
  return json.data;
}

export async function retranslateEntity(
  token: string,
  entity_type: TranslatableEntityType,
  entity_id: number,
  options?: { target_locales?: string[]; fields?: TranslatableField[] }
): Promise<{ queued: boolean; source_lang: string; target_locales: string[] | null }> {
  const json = await apiFetchJson<{
    success: boolean;
    data: { queued: boolean; source_lang: string; target_locales: string[] | null };
  }>(`/localization/content-translations/${entity_type}/${entity_id}/retranslate`, {
    method: "POST",
    token,
    body: options ?? {},
  });
  return json.data;
}
