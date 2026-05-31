"use client";

/**
 * CRM → Activities — the interaction log (calls / emails / meetings / tasks /
 * notes). Backed by /platform-admin/crm/activities (CrmController).
 */

import { useCallback, useEffect, useState } from "react";
import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useDocumentTitle } from "@/lib/use-document-title";
import { canAccessCrmSection } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import { apiCrmActivities, type CrmActivity } from "@/lib/crm-api";
import {
  STATUS_BADGE_CLASS,
  formatRelativeTime,
  statusBadgeStyle,
  type StatusTone,
} from "@/lib/admin-v2-helpers";
import { PageHeader, V2Card, EmptyState } from "@/components/ui/v2";
import { CrmSectionTabs } from "@/components/crm/CrmSectionTabs";
import { ListChecks, Phone, Mail, Users, CheckSquare, StickyNote, RefreshCw } from "lucide-react";

function typeIcon(type: string) {
  switch (type) {
    case "call":
      return <Phone className="h-4 w-4" />;
    case "email":
      return <Mail className="h-4 w-4" />;
    case "meeting":
      return <Users className="h-4 w-4" />;
    case "task":
      return <CheckSquare className="h-4 w-4" />;
    default:
      return <StickyNote className="h-4 w-4" />;
  }
}

function statusTone(status: string): StatusTone {
  switch (status) {
    case "done":
      return "success";
    case "overdue":
      return "danger";
    default:
      return "warning";
  }
}

export default function CrmActivitiesPage() {
  useDocumentTitle("CRM — Activities");
  const { token, user } = useAdminAuth();
  const allowed = canAccessCrmSection(user);

  const [rows, setRows] = useState<CrmActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await apiCrmActivities(token, { per_page: 100 });
      setRows(res.data);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof Error ? e.message : "Failed to load activities");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (allowed) void load();
  }, [allowed, load]);

  if (!allowed || forbidden) return <ForbiddenNotice />;

  return (
    <div>
      <PageHeader
        breadcrumb={[
          { label: "Home", href: "/dashboard" },
          { label: "CRM", href: "/crm/pipeline" },
          { label: "Activities" },
        ]}
        title="Activities"
        subtitle="Calls, emails, meetings, tasks and follow-ups"
        actions={
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border px-[14px] text-[13px] font-medium"
            style={{ borderColor: "var(--admin-border)", color: "var(--admin-text-primary)" }}
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        }
      />
      <CrmSectionTabs activeHref="/crm/activities" counts={{ activities: rows.length }} />

      {err ? (
        <div className="mb-4 rounded-md border p-4 text-[13px]" style={{ borderColor: "var(--admin-border)", color: "var(--admin-danger)" }}>
          {err}
        </div>
      ) : null}

      {!loading && rows.length === 0 ? (
        <EmptyState
          icon={<ListChecks className="h-10 w-10" />}
          title="No activities yet"
          subtitle="Logged calls, emails, meetings and tasks will appear here."
        />
      ) : (
        <V2Card>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead style={{ backgroundColor: "var(--admin-bg-secondary)" }}>
                <tr>
                  {["Type", "Subject", "Owner", "Due", "Status"].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.5px]"
                      style={{ color: "var(--admin-text-secondary)" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id} className="border-t" style={{ borderColor: "var(--admin-border)" }}>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-2" style={{ color: "var(--admin-text-secondary)" }}>
                        {typeIcon(a.type)}
                        {a.type}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-medium" style={{ color: "var(--admin-text-primary)" }}>
                      {a.subject}
                    </td>
                    <td className="px-4 py-2.5" style={{ color: "var(--admin-text-secondary)" }}>
                      {a.owner?.name ?? "—"}
                    </td>
                    <td className="px-4 py-2.5" style={{ color: "var(--admin-text-secondary)" }}>
                      {a.due_at ? formatRelativeTime(a.due_at) : "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={STATUS_BADGE_CLASS} style={statusBadgeStyle(statusTone(a.status))}>
                        {a.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </V2Card>
      )}
    </div>
  );
}
