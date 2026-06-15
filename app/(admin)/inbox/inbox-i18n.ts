/**
 * Inbox — shell/common i18n (admin v3, 1:1 port of
 * docs/admin_designe/8_Inbox/inbox.html). EN source-of-truth; HY + RU full
 * overlays. Only shell vocabulary (the 7 tab labels + subtitles + breadcrumb);
 * each pane owns its body strings (the 3 native panes carry local label maps,
 * the 4 reused panes carry settings-i18n).
 */

const EN = {
  breadcrumbHome: "Home",
  inbox: "Inbox",
  superAdmin: "Super admin",

  tabMyNotif: "My notifications",
  tabRequests: "Requests",
  tabCases: "Cases",
  tabSysNotif: "System notifications",
  tabEmailTpl: "Email templates",
  tabReviews: "Reviews",
  tabSupport: "Support tickets",

  subMyNotif: "Your personal inbox — alerts, mentions, and system messages.",
  subRequests: "Agent ↔ operator requests across your companies.",
  subCases: "Structured case management with SLA tracking.",
  subSysNotif: "Platform-wide notification registry and admin notices.",
  subEmailTpl: "Notification email templates per event, channel, and language.",
  subReviews: "Moderate customer reviews across the platform.",
  subSupport: "Customer support tickets and replies.",
};

export type InboxKey = keyof typeof EN;

const HY: Record<InboxKey, string> = {
  breadcrumbHome: "Գլխավոր",
  inbox: "Մուտքային",
  superAdmin: "Սուպեր ադմին",

  tabMyNotif: "Իմ ծանուցումները",
  tabRequests: "Հարցումներ",
  tabCases: "Գործեր",
  tabSysNotif: "Համակարգային ծանուցումներ",
  tabEmailTpl: "Email ձևանմուշներ",
  tabReviews: "Կարծիքներ",
  tabSupport: "Աջակցության հարցումներ",

  subMyNotif: "Քո անձնական մուտքայինը՝ ծանուցումներ, հիշատակումներ և համակարգային հաղորդագրություններ։",
  subRequests: "Գործակալ ↔ օպերատոր հարցումներ քո ընկերությունների գծով։",
  subCases: "Կառուցվածքային գործերի կառավարում՝ SLA հետևումով։",
  subSysNotif: "Հարթակի ծանուցումների գրանցամատյան և ադմին հայտարարություններ։",
  subEmailTpl: "Ծանուցման email ձևանմուշներ՝ ըստ իրադարձության, ալիքի և լեզվի։",
  subReviews: "Մոդերացրու հաճախորդների կարծիքները հարթակում։",
  subSupport: "Հաճախորդների աջակցության հարցումներ և պատասխաններ։",
};

const RU: Record<InboxKey, string> = {
  breadcrumbHome: "Главная",
  inbox: "Входящие",
  superAdmin: "Супер-админ",

  tabMyNotif: "Мои уведомления",
  tabRequests: "Запросы",
  tabCases: "Обращения",
  tabSysNotif: "Системные уведомления",
  tabEmailTpl: "Email-шаблоны",
  tabReviews: "Отзывы",
  tabSupport: "Тикеты поддержки",

  subMyNotif: "Ваш личный ящик — уведомления, упоминания и системные сообщения.",
  subRequests: "Запросы агент ↔ оператор по вашим компаниям.",
  subCases: "Структурированное ведение обращений с контролем SLA.",
  subSysNotif: "Реестр уведомлений платформы и админ-объявления.",
  subEmailTpl: "Email-шаблоны уведомлений по событию, каналу и языку.",
  subReviews: "Модерация отзывов клиентов по платформе.",
  subSupport: "Тикеты поддержки клиентов и ответы.",
};

const TABLES: Record<string, Record<InboxKey, string>> = { hy: HY, ru: RU, en: EN };

export function inboxStrings(lang: string): Record<InboxKey, string> {
  return TABLES[lang] ?? EN;
}
