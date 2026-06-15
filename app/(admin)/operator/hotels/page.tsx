"use client";

/**
 * /operator/hotels — renders the unified InventoryPage (Hotels tab, default).
 * 1:1 port of docs/admin_designe/2_Inventory/inventory.html (2026-06-15).
 * The old standalone V2 page was replaced by the in-page Hotels pane.
 */

import { InventoryPage } from "../_inventory/InventoryPage";

export default function OperatorHotelsPage() {
  return <InventoryPage initialTab="hotels" />;
}
