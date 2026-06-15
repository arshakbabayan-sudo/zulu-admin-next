"use client";

/**
 * /operator/excursions — renders the unified InventoryPage (Excursions tab).
 * 1:1 port of docs/admin_designe/2_Inventory/inventory.html (2026-06-15).
 */

import { InventoryPage } from "../_inventory/InventoryPage";

export default function OperatorExcursionsPage() {
  return <InventoryPage initialTab="excursions" />;
}
