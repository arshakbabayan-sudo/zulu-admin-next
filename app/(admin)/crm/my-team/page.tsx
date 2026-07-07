import { redirect } from "next/navigation";

/**
 * CRM → My profile → My team REMOVED 2026-07-07 (Arshak). It rendered the exact
 * same <TeamPane> as CRM → People → Team (identical component, props and
 * subtitle) — a duplicate. The employees roster now lives only under
 * People → Team; redirect any old /crm/my-team link there. Mirrors the earlier
 * /crm/staff → /crm/team removal.
 */
export default function CrmMyTeamRedirect() {
  redirect("/crm/team");
}
