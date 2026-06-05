import { redirect } from "next/navigation";

/**
 * /platform/company-applications/[id] — admin v3 (2026-06-05).
 *
 * The standalone V2 detail page is retired: company applications now open in a
 * detail drawer inside the Management "Company applications" tab. Any deep link
 * to a specific application id redirects to that tab's list (where the row opens
 * the drawer). Kept so old links / the company-detail "Applications" eye don't 404.
 */
export default function CompanyApplicationDetailRedirect() {
  redirect("/platform/company-applications");
}
