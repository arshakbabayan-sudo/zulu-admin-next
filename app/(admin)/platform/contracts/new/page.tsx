"use client";

/**
 * /platform/contracts/new — admin v3 (2026-06-04).
 *
 * Creating a contract now happens in the in-place "New contract" modal on the
 * Management → Contracts surface (see MgmtPage `NewContractModal`). This route
 * is kept only so old deep-links resolve: it renders the Management Contracts
 * view (new chrome) instead of the retired V2-styled standalone form.
 */
import { MgmtPage } from "../../management/MgmtPage";

export default function AdminContractCreatePage() {
  return <MgmtPage initialTab="contracts" />;
}
