"use client";

/**
 * /operator/external-api — renders the unified InventoryPage (External API tab).
 * 1:1 port of docs/admin_designe/2_Inventory/inventory.html (2026-06-15).
 * The old standalone V2 page was replaced by the in-page External API pane.
 */

import { InventoryPage } from "../_inventory/InventoryPage";

export default function OperatorExternalApiPage() {
  return <InventoryPage initialTab="external-api" />;
}
