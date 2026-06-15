"use client";

/**
 * /operator/offers — renders the unified InventoryPage (Offers tab).
 * 1:1 port of docs/admin_designe/2_Inventory/inventory.html (2026-06-15).
 * The old standalone V2 page was replaced by the in-page Offers pane.
 */

import { InventoryPage } from "../_inventory/InventoryPage";

export default function OperatorOffersPage() {
  return <InventoryPage initialTab="offers" />;
}
