"use client";

/**
 * /bucket3/requests — unified Inbox page (Requests tab). 1:1 port of
 * docs/admin_designe/8_Inbox/inbox.html (2026-06-15).
 */

import { InboxPage } from "../../inbox/InboxPage";

export default function RequestsPage() {
  return <InboxPage initialTab="requests" />;
}
