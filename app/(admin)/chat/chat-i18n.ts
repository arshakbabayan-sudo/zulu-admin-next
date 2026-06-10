/**
 * admin — internal chat page local i18n dictionary.
 *
 * Like crm-i18n / settings-i18n / management-i18n, the bespoke strings live
 * here keyed by language so switching the admin chrome language re-renders and
 * instantly swaps the dictionary (no DB round-trip / raw-key flash). EN is the
 * source of truth; HY/RU spread over it so any missing key falls back to EN.
 *
 * Armenian column: plain product-Armenian, NO Cyrillic characters (checked).
 */

const EN = {
  breadcrumbHome: "Home",
  title: "Chat",
  subtitle: "Message colleagues in your company",
  newChat: "New chat",
  convEmpty: "No conversations yet. Start one with “New chat”.",
  threadEmptyTitle: "Select a conversation",
  threadEmptySubtitle: "Pick a chat on the left, or start a new one.",
  noMessages: "No messages yet — say hello.",
  msgPlaceholder: "Write a message…",
  send: "Send",
  close: "Close",
  searchColleaguesPh: "Search colleagues…",
  noColleagues: "No colleagues found.",
  errLoadConversations: "Failed to load conversations",
  errStartChat: "Failed to start chat",
  errSend: "Failed to send",
} as const;

export type ChatKey = keyof typeof EN;

const HY: Partial<Record<ChatKey, string>> = {
  breadcrumbHome: "Գլխավոր",
  title: "Չաթ",
  subtitle: "Գրիր քո ընկերության գործընկերներին",
  newChat: "Նոր չաթ",
  convEmpty: "Դեռ զրույցներ չկան։ Սկսիր մեկը «Նոր չաթ» կոճակով։",
  threadEmptyTitle: "Ընտրիր զրույց",
  threadEmptySubtitle: "Ընտրիր չաթ ձախ ցուցակից կամ սկսիր նորը։",
  noMessages: "Դեռ հաղորդագրություններ չկան — բարևիր։",
  msgPlaceholder: "Գրիր հաղորդագրություն…",
  send: "Ուղարկել",
  close: "Փակել",
  searchColleaguesPh: "Որոնել գործընկերներ…",
  noColleagues: "Գործընկերներ չգտնվեցին։",
  errLoadConversations: "Չհաջողվեց բեռնել զրույցները",
  errStartChat: "Չհաջողվեց սկսել չաթը",
  errSend: "Չհաջողվեց ուղարկել",
};

const RU: Partial<Record<ChatKey, string>> = {
  breadcrumbHome: "Главная",
  title: "Чат",
  subtitle: "Переписывайтесь с коллегами вашей компании",
  newChat: "Новый чат",
  convEmpty: "Пока нет переписок. Начните новую кнопкой «Новый чат».",
  threadEmptyTitle: "Выберите переписку",
  threadEmptySubtitle: "Выберите чат слева или начните новый.",
  noMessages: "Пока нет сообщений — поздоровайтесь.",
  msgPlaceholder: "Напишите сообщение…",
  send: "Отправить",
  close: "Закрыть",
  searchColleaguesPh: "Поиск коллег…",
  noColleagues: "Коллеги не найдены.",
  errLoadConversations: "Не удалось загрузить переписки",
  errStartChat: "Не удалось начать чат",
  errSend: "Не удалось отправить",
};

export function chatStrings(lang: string): Record<ChatKey, string> {
  if (lang === "hy") return { ...EN, ...HY };
  if (lang === "ru") return { ...EN, ...RU };
  return { ...EN };
}
