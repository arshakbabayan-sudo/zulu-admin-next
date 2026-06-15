"use client";

/**
 * /localization/templates — unified Inbox page (Email templates tab). 1:1 port
 * of docs/admin_designe/8_Inbox/inbox.html (2026-06-15). Renders the Inbox shell
 * with the EmailTpl pane (reused from SettingsPage) active.
 */

import { InboxPage } from "../../inbox/InboxPage";

export default function EmailTemplatesPage() {
  return <InboxPage initialTab="email-tpl" />;
}
