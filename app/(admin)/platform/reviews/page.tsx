"use client";

/**
 * /platform/reviews — unified Inbox page (Reviews tab). 1:1 port of
 * docs/admin_designe/8_Inbox/inbox.html (2026-06-15). Renders the Inbox shell
 * with the Reviews pane (reused from SettingsPage) active.
 */

import { InboxPage } from "../../inbox/InboxPage";

export default function ReviewsPage() {
  return <InboxPage initialTab="reviews" />;
}
