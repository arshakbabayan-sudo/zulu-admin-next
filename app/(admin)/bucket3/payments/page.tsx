import { redirect } from "next/navigation";

/**
 * "My company" group DISSOLVED 2026-06-10. The operator/agent's own Stripe
 * Connect payouts surface is now rebuilt inside CRM → My profile → "My
 * company" pill (MyCompanyPane reuses StripeConnectCard). This standalone
 * page became a menu-orphan, so it redirects to /crm/my-company. Kept so old
 * bookmarks and breadcrumb back-links still resolve.
 */
export default function MyCompanyPaymentsRedirect() {
  redirect("/crm/my-company");
}
