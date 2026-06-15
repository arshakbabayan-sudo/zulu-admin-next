"use client";

/**
 * /operator/packages — renders the unified InventoryPage (Packages tab).
 * 1:1 port of docs/admin_designe/2_Inventory/inventory.html (2026-06-15).
 */

import { InventoryPage } from "../_inventory/InventoryPage";

export default function OperatorPackagesPage() {
  return <InventoryPage initialTab="packages" />;
}
