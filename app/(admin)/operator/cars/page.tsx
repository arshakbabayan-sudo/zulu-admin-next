"use client";

/**
 * /operator/cars — renders the unified InventoryPage (Cars tab).
 * 1:1 port of docs/admin_designe/2_Inventory/inventory.html (2026-06-15).
 */

import { InventoryPage } from "../_inventory/InventoryPage";

export default function OperatorCarsPage() {
  return <InventoryPage initialTab="cars" />;
}
