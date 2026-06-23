/**
 * Per-operator price-markup card strings. Local trilingual dictionary —
 * same pattern as statistics-i18n.ts; no server round-trip, so the labels
 * are always present regardless of whether the ui_translations rows are
 * seeded. Used by the "Price markup" section on the company-detail
 * Commission tab (super-admin sets the two per-operator percentages that
 * the customer site DISPLAYS and the booking CHARGES — shown == charged).
 */
type Lang = "en" | "hy" | "ru";

const DICT = {
  title: {
    en: "Price markup",
    hy: "Գնի հավելագին",
    ru: "Наценка к цене",
  },
  hint: {
    en: "Markup added on top of this operator's supplier price. Leave a field empty to use the platform default.",
    hy: "Հավելագինը, որ ավելացվում է այս օպերատորի մատակարարի գնի վրա։ Թողե՛ք դաշտը դատարկ՝ հարթակի կանխադրված տոկոսն օգտագործելու համար։",
    ru: "Наценка, добавляемая к цене поставщика этого оператора. Оставьте поле пустым, чтобы использовать значение платформы по умолчанию.",
  },
  agentLabel: {
    en: "Agent markup (%) — netto",
    hy: "Գործակալի հավելագին (%) — նետո",
    ru: "Наценка для агента (%) — нетто",
  },
  customerLabel: {
    en: "Customer markup (%) — brutto",
    hy: "Հաճախորդի հավելագին (%) — բրուտո",
    ru: "Наценка для клиента (%) — брутто",
  },
  emptyHint: {
    en: "Empty = use the global default.",
    hy: "Դատարկ = օգտագործել գլոբալ կանխադրվածը։",
    ru: "Пусто = использовать глобальное значение по умолчанию.",
  },
  save: {
    en: "Save markup",
    hy: "Պահպանել հավելագինը",
    ru: "Сохранить наценку",
  },
  cancel: {
    en: "Cancel",
    hy: "Չեղարկել",
    ru: "Отмена",
  },
  saved: {
    en: "Saved",
    hy: "Պահպանվեց",
    ru: "Сохранено",
  },
  errSave: {
    en: "Failed to save markup",
    hy: "Չհաջողվեց պահպանել հավելագինը",
    ru: "Не удалось сохранить наценку",
  },
  errRange: {
    en: "Markup must be between 0 and 100.",
    hy: "Հավելագինը պետք է լինի 0-ից 100-ի սահմաններում։",
    ru: "Наценка должна быть от 0 до 100.",
  },
} as const;

export type MarkupStrings = Record<keyof typeof DICT, string>;

export function markupStrings(lang: string): MarkupStrings {
  const l: Lang = lang === "hy" || lang === "ru" ? lang : "en";
  const out = {} as MarkupStrings;
  (Object.keys(DICT) as (keyof typeof DICT)[]).forEach((k) => {
    out[k] = DICT[k][l];
  });
  return out;
}
