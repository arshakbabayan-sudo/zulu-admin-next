"use client";

/**
 * /bucket3/cases — unified Inbox page (Cases tab). 1:1 port of
 * docs/admin_designe/8_Inbox/inbox.html (2026-06-15).
 */

import { InboxPage } from "../../inbox/InboxPage";

export default function CasesPage() {
  return <InboxPage initialTab="cases" />;
}
