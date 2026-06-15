"use client";

/**
 * /admin-redesign/notifications — unified Inbox page (My notifications tab).
 * 1:1 port of docs/admin_designe/8_Inbox/inbox.html (2026-06-15). The old V2
 * standalone page was replaced by the in-page My-notifications pane.
 */

import { InboxPage } from "../../inbox/InboxPage";

export default function MyNotificationsPage() {
  return <InboxPage initialTab="my-notif" />;
}
