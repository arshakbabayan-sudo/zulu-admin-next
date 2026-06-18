/**
 * Integrations page — local trilingual dictionary (chat-i18n pattern). EN is
 * the source of truth; HY / RU spread over it. Armenian = plain product-
 * Armenian, ZERO Cyrillic.
 */

const EN = {
  breadcrumbHome: "Home",
  title: "Integrations",
  subtitle: "Connect external services to your company",
  // Google Drive card
  gdriveTitle: "Google Drive",
  gdriveDesc: "Store uploaded files and documents in your company's Google Drive.",
  statusConnected: "Connected",
  statusNotConnected: "Not connected",
  connectedAs: "Connected as",
  connectedAt: "Connected on",
  connect: "Connect",
  disconnect: "Disconnect",
  // company selector
  companyLabel: "Company",
  companyPickPh: "Select a company…",
  companyIdLabel: "Company ID",
  noCompany: "No company is linked to your account.",
  // states
  loading: "Loading…",
  confirmDisconnect: "Disconnect Google Drive from this company?",
  errStatus: "Failed to load connection status",
  errDisconnect: "Failed to disconnect",
  forbidden: "You don't have access to Integrations.",
} as const;

export type IntegrationsKey = keyof typeof EN;

const HY: Partial<Record<IntegrationsKey, string>> = {
  breadcrumbHome: "Գլխավոր",
  title: "Ինտեգրումներ",
  subtitle: "Միացրու արտաքին ծառայություններ քո ընկերությանը",
  gdriveTitle: "Google Drive",
  gdriveDesc: "Պահիր վերբեռնված ֆայլերն ու փաստաթղթերը քո ընկերության Google Drive-ում։",
  statusConnected: "Միացված է",
  statusNotConnected: "Միացված չէ",
  connectedAs: "Միացված է որպես",
  connectedAt: "Միացվել է",
  connect: "Միացնել",
  disconnect: "Անջատել",
  companyLabel: "Ընկերություն",
  companyPickPh: "Ընտրիր ընկերություն…",
  companyIdLabel: "Ընկերության համար",
  noCompany: "Քո հաշվին ընկերություն կապված չէ։",
  loading: "Բեռնվում է…",
  confirmDisconnect: "Անջատե՞լ Google Drive-ը այս ընկերությունից։",
  errStatus: "Չհաջողվեց բեռնել միացման վիճակը",
  errDisconnect: "Չհաջողվեց անջատել",
  forbidden: "Դու Ինտեգրումների հասանելիություն չունես։",
};

const RU: Partial<Record<IntegrationsKey, string>> = {
  breadcrumbHome: "Главная",
  title: "Интеграции",
  subtitle: "Подключайте внешние сервисы к вашей компании",
  gdriveTitle: "Google Drive",
  gdriveDesc: "Храните загруженные файлы и документы в Google Drive вашей компании.",
  statusConnected: "Подключено",
  statusNotConnected: "Не подключено",
  connectedAs: "Подключено как",
  connectedAt: "Подключено",
  connect: "Подключить",
  disconnect: "Отключить",
  companyLabel: "Компания",
  companyPickPh: "Выберите компанию…",
  companyIdLabel: "ID компании",
  noCompany: "К вашему аккаунту не привязана компания.",
  loading: "Загрузка…",
  confirmDisconnect: "Отключить Google Drive от этой компании?",
  errStatus: "Не удалось загрузить статус подключения",
  errDisconnect: "Не удалось отключить",
  forbidden: "У вас нет доступа к интеграциям.",
};

export function integrationsStrings(lang: string): Record<IntegrationsKey, string> {
  if (lang === "hy") return { ...EN, ...HY };
  if (lang === "ru") return { ...EN, ...RU };
  return { ...EN };
}
