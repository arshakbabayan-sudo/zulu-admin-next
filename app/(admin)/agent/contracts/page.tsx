"use client";

/**
 * Phase 5 — Agent contracts list. Renders the same seller-side view as
 * /operator/contracts since the backend endpoint (/seller/contracts) is
 * identical for both roles. Re-exporting the operator component keeps the
 * two pages in lock-step.
 */

export { default } from "../../operator/contracts/page";
