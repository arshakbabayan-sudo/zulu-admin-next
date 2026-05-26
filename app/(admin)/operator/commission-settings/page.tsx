/**
 * Bucket B refactor (2026-05-27) — moved to /settings/pricing-rules per the
 * 8-section IA spec. This redirect keeps existing bookmarks + email-deep-links
 * working while the canonical page sits at /settings/pricing-rules.
 *
 * The original commission-settings UI is preserved in git history at HEAD~1
 * for reference if pricing-rules needs to absorb its calculation-base /
 * per-agent-override patterns.
 */

import { redirect } from "next/navigation";

export default function OperatorCommissionSettingsRedirect(): never {
  redirect("/settings/pricing-rules");
}
