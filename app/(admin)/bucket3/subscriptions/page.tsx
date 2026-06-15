"use client";

/**
 * /bucket3/subscriptions — unified Management page (Subscriptions tab).
 * 1:1 port of docs/admin_designe/7_Management/management.html (2026-06-15):
 * Subscriptions is now an in-page pane (Companies cluster) of MgmtPage instead
 * of a standalone V2 page.
 */

import { MgmtPage } from "../../platform/management/MgmtPage";

export default function SubscriptionsPage() {
  return <MgmtPage initialTab="subscriptions" />;
}
