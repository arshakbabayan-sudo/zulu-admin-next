/**
 * Finance — SHARED shell/common i18n (admin v3, 1:1 port of
 * docs/admin_designe/6_Finance/finance.html).
 *
 * EN is the source-of-truth (and key type); HY and RU are FULL overlays. Holds
 * only shell + common vocabulary (tab labels, subtitles, shared chrome words).
 * The field-heavy panes carry their OWN local trilingual label maps in-file
 * (same split as the inventory port), so this dictionary stays manageable.
 */

const EN = {
  // shell / chrome
  breadcrumbHome: "Home",
  finance: "Finance",
  superAdmin: "Super admin",

  // tab labels
  tabSummary: "Finance summary",
  tabInvoices: "Invoices",
  tabPayments: "Payments",
  tabCommissions: "Commissions",
  tabTransactions: "Transactions",
  tabVouchers: "Vouchers",
  tabPerx: "Per-X invoicing",

  // per-tab subtitles
  subSummary: "Platform-wide financial overview across all service types.",
  subInvoices: "Issue, track, and reconcile invoices across companies.",
  subPayments: "All payments across the platform with method and status.",
  subCommissions: "Commission policies and the earned/payout ledger.",
  subTransactions: "Per-company entitlements and settlements.",
  subVouchers: "Issued service vouchers, scans, and lifecycle.",
  subPerx: "Aggregated invoice analytics grouped by operator, month, currency, or status.",

  // common
  refresh: "Refresh",
  exportCsv: "Export CSV",
  exportShort: "Export",
  newLabel: "New",
  apply: "Apply",
  clear: "Clear",
  clearAll: "Clear all",
  activeFilters: "Active filters:",
  search: "Search",
  status: "Status",
  all: "All",
  allStatuses: "All statuses",
  actions: "Actions",
  loading: "Loading…",
  empty: "Nothing here yet.",
  noMatch: "Nothing matches your filters.",
  company: "Company",
  id: "ID",
  amount: "Amount",
  currency: "Currency",
  created: "Created",
  date: "Date",
  view: "View",
  more: "More",
  save: "Save",
  saving: "Saving…",
  cancel: "Cancel",
  close: "Close",
  prev: "Prev",
  next: "Next",
  showing: "Showing",
  of: "of",
  errLoad: "Failed to load. Please try again.",
  errAction: "Action failed. Please try again.",
  forbidden: "You don't have access to this section.",
  perxSuperOnly: "Per-X invoicing is available to super admins only.",
};

export type FinanceKey = keyof typeof EN;

const HY: Record<FinanceKey, string> = {
  breadcrumbHome: "Գլխավոր",
  finance: "Ֆինանսներ",
  superAdmin: "Սուպեր ադմին",

  tabSummary: "Ֆինանսական ամփոփում",
  tabInvoices: "Հաշիվ-ապրանքագրեր",
  tabPayments: "Վճարումներ",
  tabCommissions: "Միջնորդավճարներ",
  tabTransactions: "Գործարքներ",
  tabVouchers: "Վաուչերներ",
  tabPerx: "Per-X հաշվարկ",

  subSummary: "Հարթակի ֆինանսական ընդհանուր պատկերը՝ բոլոր ծառայությունների գծով։",
  subInvoices: "Դուրս գրիր, հետևիր և համադրիր հաշիվ-ապրանքագրերը ընկերությունների գծով։",
  subPayments: "Բոլոր վճարումները հարթակում՝ եղանակով և կարգավիճակով։",
  subCommissions: "Միջնորդավճարի քաղաքականություններ և վաստակ/վճարում մատյան։",
  subTransactions: "Ընկերությունների կտրվածքով հասույթներ և կարգավորումներ։",
  subVouchers: "Դուրս գրված ծառայության վաուչերներ, ստուգումներ և ընթացք։",
  subPerx: "Հաշիվ-ապրանքագրերի ամփոփ վերլուծություն՝ ըստ օպերատորի, ամսվա, արժույթի կամ կարգավիճակի։",

  refresh: "Թարմացնել",
  exportCsv: "Արտահանել CSV",
  exportShort: "Արտահանել",
  newLabel: "Նոր",
  apply: "Կիրառել",
  clear: "Մաքրել",
  clearAll: "Մաքրել բոլորը",
  activeFilters: "Ակտիվ զտիչներ՝",
  search: "Որոնում",
  status: "Կարգավիճակ",
  all: "Բոլորը",
  allStatuses: "Բոլոր կարգավիճակները",
  actions: "Գործողություններ",
  loading: "Բեռնվում է…",
  empty: "Դեռ ոչինչ չկա։",
  noMatch: "Ոչինչ չի համապատասխանում զտիչներին։",
  company: "Ընկերություն",
  id: "ID",
  amount: "Գումար",
  currency: "Արժույթ",
  created: "Ստեղծված",
  date: "Ամսաթիվ",
  view: "Դիտել",
  more: "Ավելին",
  save: "Պահպանել",
  saving: "Պահպանվում է…",
  cancel: "Չեղարկել",
  close: "Փակել",
  prev: "Նախ.",
  next: "Հաջ.",
  showing: "Ցուցադրվում է",
  of: "/",
  errLoad: "Չհաջողվեց բեռնել։ Փորձեք նորից։",
  errAction: "Գործողությունը ձախողվեց։ Փորձեք նորից։",
  forbidden: "Դուք այս բաժնի հասանելիություն չունեք։",
  perxSuperOnly: "Per-X հաշվարկը հասանելի է միայն սուպեր ադմիններին։",
};

const RU: Record<FinanceKey, string> = {
  breadcrumbHome: "Главная",
  finance: "Финансы",
  superAdmin: "Супер-админ",

  tabSummary: "Финансовая сводка",
  tabInvoices: "Счета",
  tabPayments: "Платежи",
  tabCommissions: "Комиссии",
  tabTransactions: "Транзакции",
  tabVouchers: "Ваучеры",
  tabPerx: "Per-X выставление",

  subSummary: "Финансовый обзор по платформе по всем типам услуг.",
  subInvoices: "Выставляйте, отслеживайте и сверяйте счета по компаниям.",
  subPayments: "Все платежи по платформе со способом и статусом.",
  subCommissions: "Политики комиссий и журнал начислений/выплат.",
  subTransactions: "Начисления и расчёты по компаниям.",
  subVouchers: "Выпущенные ваучеры услуг, сканы и жизненный цикл.",
  subPerx: "Сводная аналитика счетов по оператору, месяцу, валюте или статусу.",

  refresh: "Обновить",
  exportCsv: "Экспорт CSV",
  exportShort: "Экспорт",
  newLabel: "Новый",
  apply: "Применить",
  clear: "Очистить",
  clearAll: "Очистить всё",
  activeFilters: "Активные фильтры:",
  search: "Поиск",
  status: "Статус",
  all: "Все",
  allStatuses: "Все статусы",
  actions: "Действия",
  loading: "Загрузка…",
  empty: "Здесь пока пусто.",
  noMatch: "Ничего не найдено по фильтрам.",
  company: "Компания",
  id: "ID",
  amount: "Сумма",
  currency: "Валюта",
  created: "Создано",
  date: "Дата",
  view: "Просмотр",
  more: "Ещё",
  save: "Сохранить",
  saving: "Сохранение…",
  cancel: "Отмена",
  close: "Закрыть",
  prev: "Назад",
  next: "Вперёд",
  showing: "Показано",
  of: "из",
  errLoad: "Не удалось загрузить. Попробуйте снова.",
  errAction: "Действие не выполнено. Попробуйте снова.",
  forbidden: "У вас нет доступа к этому разделу.",
  perxSuperOnly: "Per-X выставление доступно только супер-админам.",
};

const TABLES: Record<string, Record<FinanceKey, string>> = { hy: HY, ru: RU, en: EN };

export function financeStrings(lang: string): Record<FinanceKey, string> {
  return TABLES[lang] ?? EN;
}

/** Pick the right column for a trilingual local label map `{hy,ru,en}`. */
export function pick(lang: string, map: { hy: string; ru: string; en: string }): string {
  if (lang === "hy") return map.hy;
  if (lang === "ru") return map.ru;
  return map.en;
}
