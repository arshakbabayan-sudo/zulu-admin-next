"use client";

/**
 * /platform/notifications — unified Inbox page (System notifications tab).
 * 1:1 port of docs/admin_designe/8_Inbox/inbox.html (2026-06-15). Renders the
 * Inbox shell with the SysNotif pane (reused from SettingsPage) active.
 */

import { InboxPage } from "../../inbox/InboxPage";

export default function SystemNotificationsPage() {
  return <InboxPage initialTab="sys-notif" />;
}
