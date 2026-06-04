"use client";

/**
 * /platform/b2c-customers — admin v3 (2026-06-04).
 *
 * Tab moved into Management when the Directory sidebar group was deleted.
 * Renders the unified MgmtPage with the customers pane active so the route
 * inherits the Management chrome (sidebar + header + design tokens) verbatim.
 */
import { MgmtPage } from "../management/MgmtPage";

export default function PlatformB2cCustomersPage() {
  return <MgmtPage initialTab="customers" />;
}
