/**
 * Operator statistics page strings (roadmap §11). Local trilingual dictionary
 * — same pattern as chat-i18n.ts; no server round-trip needed.
 */
type Lang = "en" | "hy" | "ru";

const DICT = {
  heroBookings: { en: "Bookings", hy: "Ամրագրումներ", ru: "Бронирования" },
  heroOffers: { en: "Active offers", hy: "Ակտիվ առաջարկներ", ru: "Активные предложения" },
  heroRevenue: { en: "Revenue", hy: "Եկամուտ", ru: "Доход" },
  heroCommission: { en: "Commission", hy: "Միջնորդավճար", ru: "Комиссия" },
  revenueTrend: { en: "Revenue trend (12 months)", hy: "Եկամտի դինամիկան (12 ամիս)", ru: "Динамика дохода (12 месяцев)" },
  byService: { en: "By service", hy: "Ըստ ծառայության", ru: "По услугам" },
  topDestinations: { en: "Top destinations", hy: "Հանրաճանաչ ուղղություններ", ru: "Популярные направления" },
  revenueByCurrency: { en: "Revenue by currency", hy: "Եկամուտն ըստ արժույթի", ru: "Доход по валютам" },
  commissionByCurrency: { en: "Commission by currency", hy: "Միջնորդավճարն ըստ արժույթի", ru: "Комиссия по валютам" },
  noData: { en: "No sales in this period yet.", hy: "Այս ժամանակահատվածում դեռ վաճառք չկա։", ru: "Пока нет продаж за этот период." },
  noBreakdown: { en: "No data yet.", hy: "Դեռ տվյալ չկա։", ru: "Пока нет данных." },
  svc_hotel: { en: "Hotels", hy: "Հյուրանոցներ", ru: "Отели" },
  svc_flight: { en: "Flights", hy: "Թռիչքներ", ru: "Авиабилеты" },
  svc_transfer: { en: "Transfers", hy: "Փոխադրումներ", ru: "Трансферы" },
  svc_car: { en: "Cars", hy: "Մեքենաներ", ru: "Авто" },
  svc_excursion: { en: "Excursions", hy: "Էքսկուրսիաներ", ru: "Экскурсии" },
  svc_visa: { en: "Visas", hy: "Վիզաներ", ru: "Визы" },
  svc_package: { en: "Packages", hy: "Փաթեթներ", ru: "Пакеты" },
  svc_other: { en: "Other", hy: "Այլ", ru: "Прочее" },
} as const;

export type StatStrings = Record<keyof typeof DICT, string>;

export function statStrings(lang: string): StatStrings {
  const l: Lang = lang === "hy" || lang === "ru" ? lang : "en";
  const out = {} as StatStrings;
  (Object.keys(DICT) as (keyof typeof DICT)[]).forEach((k) => {
    out[k] = DICT[k][l];
  });
  return out;
}

export function serviceLabel(s: StatStrings, type: string): string {
  const key = `svc_${type}` as keyof typeof DICT;
  return (s as Record<string, string>)[key] ?? type;
}
