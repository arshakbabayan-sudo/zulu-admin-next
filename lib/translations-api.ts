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
 * Backend TRANSLATABLE_FIELDS. Returned via `available_fields` in the GET
 * response (Phase 2 Step 2.3) — keep the local type-level list aligned.
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
  | "notes";

export type TranslationsPayload = {
  entity_type: TranslatableEntityType;
  entity_id: number;
  language_code: string;
  translations: Partial<Record<TranslatableField, string | null>>;
  available_fields: TranslatableField[];
};

export async function fetchTranslations(
  entity_type: TranslatableEntityType,
  entity_id: number,
  language_code: string
): Promise<TranslationsPayload> {
  const params = new URLSearchParams({
    entity_type,
    entity_id: String(entity_id),
    lang: language_code,
  });
  const json = await apiFetchJson<{ success: boolean; data: TranslationsPayload }>(
    `/localization/translations?${params.toString()}`
  );
  return json.data;
}

export async function saveTranslations(
  token: string,
  entity_type: TranslatableEntityType,
  entity_id: number,
  language_code: string,
  translations: Partial<Record<TranslatableField, string>>
): Promise<void> {
  await apiFetchJson(`/localization/translations`, {
    method: "POST",
    token,
    body: {
      entity_type,
      entity_id,
      language_code,
      translations,
    },
  });
}
