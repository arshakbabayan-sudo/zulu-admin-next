"use client";

/**
 * /platform/contract-templates/new — admin v3 (2026-06-04).
 *
 * Creating a template now happens in the in-place "New template" modal on the
 * Management → Contract templates surface (see MgmtPage `TemplateModal`). This
 * route is kept only so old deep-links resolve: it renders the Management
 * Templates view (new chrome) instead of the retired V2-styled standalone form.
 */
import { MgmtPage } from "../../management/MgmtPage";

export default function AdminContractTemplateNewPage() {
  return <MgmtPage initialTab="templates" />;
}
