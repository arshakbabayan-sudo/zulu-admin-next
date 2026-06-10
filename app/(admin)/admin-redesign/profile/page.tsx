import { redirect } from "next/navigation";

/**
 * My profile — the standalone v2 page is RETIRED 2026-06-10.
 *
 * "My profile" now lives INSIDE CRM as its own cluster (Account · My company ·
 * My team · My agents) — see app/(admin)/crm/CrmPage.tsx + MyProfilePanes.tsx.
 * This route is kept only so old bookmarks/links land on the new Account pane.
 */
export default function MyProfileRedirect() {
  redirect("/crm/account");
}
