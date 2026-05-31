import { redirect } from "next/navigation";

/**
 * CRM section index — the bare /crm URL redirects to the Pipeline landing tab
 * so the sidebar highlight + breadcrumb resolve against a concrete page.
 */
export default function CrmIndexPage() {
  redirect("/crm/pipeline");
}
