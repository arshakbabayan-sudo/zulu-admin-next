"use client";

/**
 * /operator/transfers — renders the unified InventoryPage (Transfers tab).
 * 1:1 port of docs/admin_designe/2_Inventory/inventory.html (2026-06-15).
 */

import { InventoryPage } from "../_inventory/InventoryPage";

export default function OperatorTransfersPage() {
  return <InventoryPage initialTab="transfers" />;
}
