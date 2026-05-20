"use client";

/**
 * Phase 7.6 — Bulk notifications (admin broadcast).
 *
 * Super admin selects a recipient segment (all B2C / all staff / by company /
 * specific user IDs) and sends a single notification row to each matched
 * user. Backend creates one Notification row per recipient inside a
 * transaction.
 *
 * SMS / email / push channels + scheduling are deferred — this initial
 * cut surfaces the in-app notification bell to the recipients.
 */

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useConfirm } from "@/contexts/ConfirmDialogContext";
import { canAccessSuperAdminOnlyPlatformNav } from "@/lib/access";
import { ApiRequestError, apiFetchJson } from "@/lib/api-client";
import type { ApiSuccessEnvelope } from "@/lib/api-envelope";
import {
  Button,
  FormField,
  Input,
  PageHeader,
  Select,
} from "@/components/ui";
import { useState } from "react";

type Target = "all_b2c" | "all_staff" | "by_company" | "specific_users";

export default function Bucket3BulkNotificationsPage() {
  const { token, user } = useAdminAuth();
  const confirm = useConfirm();
  const allowed = canAccessSuperAdminOnlyPlatformNav(user);
  const [target, setTarget] = useState<Target>("all_b2c");
  const [companyId, setCompanyId] = useState("");
  const [userIdsRaw, setUserIdsRaw] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState<"low" | "normal" | "high">("normal");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<{ sent_count: number } | null>(null);

  async function handleSend() {
    if (!token) return;
    setErr(null);
    setResult(null);
    if (!title.trim() || !message.trim()) {
      setErr("Title and message are required");
      return;
    }
    const payload: Record<string, unknown> = {
      target,
      title: title.trim(),
      message: message.trim(),
      priority,
    };
    if (target === "by_company") {
      const cid = Number(companyId.trim());
      if (!Number.isFinite(cid) || cid <= 0) {
        setErr("Company id required");
        return;
      }
      payload.company_id = cid;
    }
    if (target === "specific_users") {
      const ids = userIdsRaw
        .split(/[\s,]+/)
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n) && n > 0);
      if (ids.length === 0) {
        setErr("At least one user id required");
        return;
      }
      payload.user_ids = ids;
    }

    const ok = await confirm({ messageKey: "admin.bucket3.bulk_notifications.confirm_send" });
    if (!ok) return;

    setBusy(true);
    try {
      const res = await apiFetchJson<ApiSuccessEnvelope<{ sent_count: number }>>(
        `/platform-admin/notifications/bulk-send`,
        { method: "POST", token, body: payload }
      );
      setResult(res.data);
      setTitle("");
      setMessage("");
      setUserIdsRaw("");
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : "Send failed");
    } finally {
      setBusy(false);
    }
  }

  if (!allowed) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">Bulk notifications</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bulk notifications"
        subtitle="Broadcast an in-app notification to a recipient segment. Each matched user gets one Notification row in their bell."
      />

      {err && (
        <div className="rounded-zulu border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">
          {err}
        </div>
      )}
      {result && (
        <div className="rounded-zulu border border-success-200 bg-success-50 px-4 py-2 text-sm text-success-700">
          Sent {result.sent_count} notification{result.sent_count === 1 ? "" : "s"}.
        </div>
      )}

      <section className="admin-card p-4 space-y-3">
        <h2 className="text-base font-semibold">Recipients</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Target segment" htmlFor="bulk-target" required>
            <Select
              id="bulk-target"
              value={target}
              onChange={(e) => setTarget(e.target.value as Target)}
            >
              <option value="all_b2c">All B2C customers (no company memberships)</option>
              <option value="all_staff">All staff (users with company memberships)</option>
              <option value="by_company">Members of a specific company</option>
              <option value="specific_users">Specific user IDs</option>
            </Select>
          </FormField>
          {target === "by_company" && (
            <FormField label="Company id" htmlFor="bulk-company" required>
              <Input
                id="bulk-company"
                type="number"
                min={1}
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
              />
            </FormField>
          )}
          {target === "specific_users" && (
            <FormField
              label="User IDs"
              htmlFor="bulk-user-ids"
              required
              helperText="Comma- or space-separated list, e.g. 12, 18, 42"
              className="sm:col-span-2"
            >
              <Input
                as="textarea"
                id="bulk-user-ids"
                rows={3}
                value={userIdsRaw}
                onChange={(e) => setUserIdsRaw(e.target.value)}
              />
            </FormField>
          )}
        </div>
      </section>

      <section className="admin-card p-4 space-y-3">
        <h2 className="text-base font-semibold">Message</h2>
        <FormField label="Title" htmlFor="bulk-title" required>
          <Input
            id="bulk-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Short headline shown in the bell list"
          />
        </FormField>
        <FormField label="Body" htmlFor="bulk-message" required>
          <Input
            as="textarea"
            id="bulk-message"
            rows={6}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Full message text"
          />
        </FormField>
        <FormField label="Priority" htmlFor="bulk-priority">
          <Select
            id="bulk-priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value as "low" | "normal" | "high")}
          >
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
          </Select>
        </FormField>
      </section>

      <div>
        <Button size="sm" disabled={busy} onClick={() => void handleSend()}>
          {busy ? "Sending…" : "Send broadcast"}
        </Button>
      </div>
    </div>
  );
}
