"use client";

/**
 * Bulk notifications (admin broadcast).
 *
 * Super admin selects a recipient segment (all B2C / all staff / by company /
 * specific user IDs), picks one or more delivery channels (in-app / email /
 * SMS / push), and hits send. The backend fans the message out via
 * SendBulkNotificationJob — email always works (Mail driver is "log" by
 * default and writes to storage/logs/laravel.log); SMS and push fall back
 * to NoopSmsProvider / NoopPushProvider when no real gateway is configured.
 */

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useConfirm } from "@/contexts/ConfirmDialogContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { canAccessSuperAdminOnlyPlatformNav } from "@/lib/access";
import { ApiRequestError, apiFetchJson } from "@/lib/api-client";
import type { ApiSuccessEnvelope } from "@/lib/api-envelope";
import {
  Button,
  FormField,
  Input,

  Select,
} from "@/components/ui";
import {
  PageHeader as V2PageHeader,
  SectionTabs,
  V2Button,
} from "@/components/ui/v2";
import { Download, Send } from "lucide-react";
import { useState } from "react";

type Target = "all_b2c" | "all_staff" | "by_company" | "specific_users";
type Channel = "in_app" | "email" | "sms" | "push";

/** i18n with English fallback so the page stays readable mid-translation. */
function tx(t: (k: string) => string, key: string, fallback: string): string {
  const r = t(key);
  return r === key ? fallback : r;
}

export default function Bucket3BulkNotificationsPage() {
  const { token, user } = useAdminAuth();
  const confirm = useConfirm();
  const { t } = useLanguage();
  const allowed = canAccessSuperAdminOnlyPlatformNav(user);
  const [target, setTarget] = useState<Target>("all_b2c");
  const [companyId, setCompanyId] = useState("");
  const [userIdsRaw, setUserIdsRaw] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState<"low" | "normal" | "high">("normal");
  const [channels, setChannels] = useState<Record<Channel, boolean>>({
    in_app: true,
    email: true,
    sms: false,
    push: false,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<{ sent_count: number; channels?: Channel[] } | null>(null);

  function toggleChannel(channel: Channel) {
    setChannels((prev) => ({ ...prev, [channel]: !prev[channel] }));
  }

  async function handleSend() {
    if (!token) return;
    setErr(null);
    setResult(null);
    if (!title.trim() || !message.trim()) {
      setErr(t("admin.bucket3.bulk_notifications.error.title_message_required"));
      return;
    }
    const selectedChannels = (Object.keys(channels) as Channel[]).filter((c) => channels[c]);
    if (selectedChannels.length === 0) {
      setErr(
        tx(t, "admin.bucket3.bulk_notifications.error.channels_required", "Pick at least one delivery channel.")
      );
      return;
    }
    const payload: Record<string, unknown> = {
      target,
      title: title.trim(),
      message: message.trim(),
      priority,
      channels: selectedChannels,
    };
    if (target === "by_company") {
      const cid = Number(companyId.trim());
      if (!Number.isFinite(cid) || cid <= 0) {
        setErr(t("admin.bucket3.bulk_notifications.error.company_id_required"));
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
        setErr(t("admin.bucket3.bulk_notifications.error.user_ids_required"));
        return;
      }
      payload.user_ids = ids;
    }

    const ok = await confirm({ messageKey: "admin.bucket3.bulk_notifications.confirm_send" });
    if (!ok) return;

    setBusy(true);
    try {
      const res = await apiFetchJson<
        ApiSuccessEnvelope<{ sent_count: number; channels?: Channel[] }>
      >(`/platform-admin/notifications/bulk-send`, { method: "POST", token, body: payload });
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
        <h1 className="admin-page-title">{t("admin.bucket3.bulk_notifications.title")}</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div>
      <V2PageHeader
        breadcrumb={[
          { label: "Home", href: "/dashboard" },
          { label: "My company", href: "/bucket3/employees" },
          { label: t("admin.bucket3.bulk_notifications.title") },
        ]}
        title={t("admin.bucket3.bulk_notifications.title")}
        subtitle={t("admin.bucket3.bulk_notifications.subtitle")}
        actions={
          <>
            <V2Button icon={<Download className="h-4 w-4" />}>Export</V2Button>
            <V2Button
              variant="primary"
              icon={<Send className="h-4 w-4" />}
              onClick={() => void handleSend()}
              disabled={busy}
            >
              {busy ? t("admin.bucket3.bulk_notifications.sending") : t("admin.bucket3.bulk_notifications.send")}
            </V2Button>
          </>
        }
      />

      <SectionTabs
        activeHref="/bucket3/bulk-notifications"
        items={[
          { href: "/bucket3/employees", label: "Employees" },
          { href: "/bucket3/payroll", label: "Payroll" },
          { href: "/bucket3/non-service-hours", label: "Non-service hours" },
          { href: "/bucket3/cases", label: "Cases" },
          { href: "/bucket3/bulk-notifications", label: "Bulk notifications" },
          { href: "/bucket3/pin-settings", label: "PIN settings" },
          { href: "/bucket3/customers", label: "Customers" },
          { href: "/bucket3/subscriptions", label: "Subscriptions" },
          { href: "/bucket3/per-x-invoicing", label: "Per-X invoicing" },
        ]}
      />

      <div className="space-y-6">
      {err && (
        <div className="rounded-zulu border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">
          {err}
        </div>
      )}
      {result && (
        <div className="rounded-zulu border border-success-200 bg-success-50 px-4 py-2 text-sm text-success-700">
          {t("admin.bucket3.bulk_notifications.success").replace("{count}", String(result.sent_count))}
          {result.channels && result.channels.length > 0 ? (
            <span className="ml-2 text-xs opacity-80">
              ({tx(t, "admin.bucket3.bulk_notifications.channels_label", "channels")}:{" "}
              {result.channels.join(", ")})
            </span>
          ) : null}
        </div>
      )}

      <section className="admin-card p-4 space-y-3">
        <h2 className="text-base font-semibold">{t("admin.bucket3.bulk_notifications.section.recipients")}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label={t("admin.bucket3.bulk_notifications.field.target")} htmlFor="bulk-target" required>
            <Select
              id="bulk-target"
              value={target}
              onChange={(e) => setTarget(e.target.value as Target)}
            >
              <option value="all_b2c">{t("admin.bucket3.bulk_notifications.option.all_b2c")}</option>
              <option value="all_staff">{t("admin.bucket3.bulk_notifications.option.all_staff")}</option>
              <option value="by_company">{t("admin.bucket3.bulk_notifications.option.by_company")}</option>
              <option value="specific_users">{t("admin.bucket3.bulk_notifications.option.specific_users")}</option>
            </Select>
          </FormField>
          {target === "by_company" && (
            <FormField label={t("admin.bucket3.bulk_notifications.field.company_id")} htmlFor="bulk-company" required>
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
              label={t("admin.bucket3.bulk_notifications.field.user_ids")}
              htmlFor="bulk-user-ids"
              required
              helperText={t("admin.bucket3.bulk_notifications.field.user_ids_helper")}
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
        <h2 className="text-base font-semibold">
          {tx(t, "admin.bucket3.bulk_notifications.section.channels", "Delivery channels")}
        </h2>
        <FormField
          label={tx(t, "admin.bucket3.bulk_notifications.field.channels", "Channels")}
          htmlFor="bulk-channels"
          required
          helperText={tx(
            t,
            "admin.bucket3.bulk_notifications.field.channels_helper",
            "Pick where this broadcast should land. In-app shows in the bell; email goes to the user's address on file."
          )}
        >
          <div id="bulk-channels" className="flex flex-wrap gap-x-6 gap-y-2 pt-1">
            <ChannelCheckbox
              id="bulk-channel-in-app"
              label={tx(t, "admin.bucket3.bulk_notifications.channel.in_app", "In-app")}
              checked={channels.in_app}
              onChange={() => toggleChannel("in_app")}
            />
            <ChannelCheckbox
              id="bulk-channel-email"
              label={tx(t, "admin.bucket3.bulk_notifications.channel.email", "Email")}
              checked={channels.email}
              onChange={() => toggleChannel("email")}
            />
            <ChannelCheckbox
              id="bulk-channel-sms"
              label={tx(t, "admin.bucket3.bulk_notifications.channel.sms", "SMS")}
              checked={channels.sms}
              onChange={() => toggleChannel("sms")}
              note={tx(
                t,
                "admin.bucket3.bulk_notifications.channel.sms_note",
                "provider not configured — sent to log"
              )}
            />
            <ChannelCheckbox
              id="bulk-channel-push"
              label={tx(t, "admin.bucket3.bulk_notifications.channel.push", "Push")}
              checked={channels.push}
              onChange={() => toggleChannel("push")}
              note={tx(
                t,
                "admin.bucket3.bulk_notifications.channel.push_note",
                "provider not configured — sent to log"
              )}
            />
          </div>
        </FormField>
      </section>

      <section className="admin-card p-4 space-y-3">
        <h2 className="text-base font-semibold">{t("admin.bucket3.bulk_notifications.section.message")}</h2>
        <FormField label={t("admin.bucket3.bulk_notifications.field.title")} htmlFor="bulk-title" required>
          <Input
            id="bulk-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("admin.bucket3.bulk_notifications.field.title_placeholder")}
          />
        </FormField>
        <FormField label={t("admin.bucket3.bulk_notifications.field.body")} htmlFor="bulk-message" required>
          <Input
            as="textarea"
            id="bulk-message"
            rows={6}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t("admin.bucket3.bulk_notifications.field.body_placeholder")}
          />
        </FormField>
        <FormField label={t("admin.bucket3.bulk_notifications.field.priority")} htmlFor="bulk-priority">
          <Select
            id="bulk-priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value as "low" | "normal" | "high")}
          >
            <option value="low">{t("admin.bucket3.bulk_notifications.priority.low")}</option>
            <option value="normal">{t("admin.bucket3.bulk_notifications.priority.normal")}</option>
            <option value="high">{t("admin.bucket3.bulk_notifications.priority.high")}</option>
          </Select>
        </FormField>
      </section>

      <div>
        <Button size="sm" disabled={busy} onClick={() => void handleSend()}>
          {busy ? t("admin.bucket3.bulk_notifications.sending") : t("admin.bucket3.bulk_notifications.send")}
        </Button>
      </div>
      </div>
    </div>
  );
}

function ChannelCheckbox({
  id,
  label,
  checked,
  onChange,
  note,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: () => void;
  note?: string;
}) {
  return (
    <label
      htmlFor={id}
      className="flex items-center gap-2 text-sm cursor-pointer select-none"
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
      />
      <span>{label}</span>
      {note ? (
        <span className="text-xs text-gray-500">({note})</span>
      ) : null}
    </label>
  );
}
