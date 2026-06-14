/**
 * Inbox group — shared section tabs (2026-06-13 IA redesign).
 *
 * Mirrors components/finance/FinanceSectionTabs.tsx: i18n via tx() fallback +
 * an `activeHref` prop. Lists the 7 Inbox tabs in canonical order so every
 * Inbox page renders the SAME strip regardless of which one you land on:
 *
 *   My notifications · Requests · Cases · System notifications ·
 *   Email templates · Reviews · Support tickets
 *
 * The last four were relocated OUT of Settings into Inbox; their pages still
 * render through SettingsPage panes (routes unchanged), but the on-page strip
 * + the sidebar (via ADMIN_NAV_GROUPS["notifications_v2"]) now show them under
 * Inbox.
 */

import { SectionTabs } from "@/components/ui/v2";
import { useLanguage } from "@/contexts/LanguageContext";

/**
 * Local i18n shim — returns `fallback` when the server translation row for
 * `key` hasn't been seeded yet (t() echoes the key on a miss), so tabs never
 * render a raw dotted key.
 */
function tx(t: (k: string) => string, key: string, fallback: string): string {
  const v = t(key);
  return v === key ? fallback : v;
}

type Props = {
  activeHref: string;
  /** Optional per-href badge counts (e.g. unread notifications, open cases). */
  counts?: Partial<Record<string, number>>;
};

export function InboxSectionTabs({ activeHref, counts }: Props) {
  const { t } = useLanguage();
  const items = [
    {
      href: "/admin-redesign/notifications",
      label: tx(t, "admin.nav.tab.my_notifications", "My notifications"),
      count: counts?.["/admin-redesign/notifications"],
    },
    {
      href: "/bucket3/requests",
      label: tx(t, "admin.nav.tab.bucket3.requests", "Requests"),
      count: counts?.["/bucket3/requests"],
    },
    {
      href: "/bucket3/cases",
      label: tx(t, "admin.nav.tab.bucket3.cases", "Cases"),
      count: counts?.["/bucket3/cases"],
    },
    {
      href: "/platform/notifications",
      label: tx(t, "admin.nav.tab.system_notifications", "System notifications"),
      count: counts?.["/platform/notifications"],
    },
    {
      href: "/localization/templates",
      label: tx(t, "admin.nav.tab.email_templates", "Email templates"),
      count: counts?.["/localization/templates"],
    },
    {
      href: "/platform/reviews",
      label: tx(t, "admin.nav.tab.reviews", "Reviews"),
      count: counts?.["/platform/reviews"],
    },
    {
      href: "/support/tickets",
      label: tx(t, "admin.nav.tab.support", "Support tickets"),
      count: counts?.["/support/tickets"],
    },
  ];
  return <SectionTabs activeHref={activeHref} items={items} />;
}
