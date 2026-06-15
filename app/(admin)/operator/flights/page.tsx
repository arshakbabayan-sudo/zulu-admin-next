"use client";

/**
 * /operator/flights — renders the unified InventoryPage (Flights tab).
 * 1:1 port of docs/admin_designe/2_Inventory/inventory.html (2026-06-15).
 */

import { InventoryPage } from "../_inventory/InventoryPage";

export default function OperatorFlightsPage() {
  return <InventoryPage initialTab="flights" />;
}
