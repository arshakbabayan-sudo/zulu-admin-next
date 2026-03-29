"use client";

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { canAccessLocalizationTemplatesNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import {
  apiLocalizationLanguages,
  apiLocalizationTemplateGet,
  apiLocalizationTemplatePatch,
  NOTIFICATION_TEMPLATE_EVENTS,
  type LocalizationLanguageRow,
} from "@/lib/localization-api";
import { useCallback, useEffect, useState } from "react";

const CHANNELS = ["in_app", "email"] as const;

export default function LocalizationTemplatesPage() {
  const { token, user } = useAdminAuth();
  const allowed = canAccessLocalizationTemplatesNav(user);

  const [langs, setLangs] = useState<LocalizationLanguageRow[]>([]);
  const [event, setEvent] = useState<string>(NOTIFICATION_TEMPLATE_EVENTS[0]);
  const [lang, setLang] = useState("en");
  const [channel, setChannel] = useState<string>("in_app");
  const [titleTemplate, setTitleTemplate] = useState("");
  const [bodyTemplate, setBodyTemplate] = useState("");
  const [isActive, setIsActive] = useState(true);

  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadLangs = useCallback(async () => {
    try {
      const res = await apiLocalizationLanguages(token);
      setLangs(res.data);
    } catch {
      /* ignore */
    }
  }, [token]);

  useEffect(() => {
    if (allowed) loadLangs();
  }, [allowed, loadLangs]);

  async function loadTemplate() {
    setErr(null);
    setMsg(null);
    setBusy(true);
    try {
      const res = await apiLocalizationTemplateGet(token, event, { lang, channel });
      setTitleTemplate(res.data.title_template);
      setBodyTemplate(res.data.body_template);
      setIsActive(res.data.is_active);
      setMsg("Loaded.");
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 404) {
        setTitleTemplate("");
        setBodyTemplate("");
        setIsActive(true);
        setMsg("No template found — fill below and save to create.");
      } else {
        setErr(e instanceof ApiRequestError ? e.message : "Load failed");
      }
    } finally {
      setBusy(false);
    }
  }

  async function saveTemplate() {
    if (!token) return;
    setErr(null);
    setMsg(null);
    setForbidden(false);
    setBusy(true);
    try {
      await apiLocalizationTemplatePatch(token, event, {
        lang,
        channel,
        title_template: titleTemplate,
        body_template: bodyTemplate,
        is_active: isActive,
      });
      setMsg("Saved.");
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  if (!allowed) {
    return (
      <div>
        <h1 className="text-xl font-semibold">Notification templates</h1>
        <div className="mt-4">
          <ForbiddenNotice message="Updating notification templates requires super admin." />
        </div>
      </div>
    );
  }

  if (forbidden) {
    return (
      <div>
        <h1 className="text-xl font-semibold">Notification templates</h1>
        <div className="mt-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-semibold">Notification templates</h1>
      <p className="mt-1 text-sm text-zinc-500">
        GET /api/localization/templates/{"{event}"} · PATCH /api/localization/templates/{"{event}"}
      </p>
      {msg && <p className="mt-2 text-sm text-emerald-700">{msg}</p>}
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}

      <div className="mt-4 space-y-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-3">
          <label className="flex flex-col text-xs text-zinc-600">
            Event
            <select
              value={event}
              onChange={(e) => setEvent(e.target.value)}
              className="mt-1 max-w-md rounded border border-zinc-300 px-2 py-1 text-sm"
            >
              {NOTIFICATION_TEMPLATE_EVENTS.map((ev) => (
                <option key={ev} value={ev}>
                  {ev}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-xs text-zinc-600">
            Language
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              className="mt-1 rounded border border-zinc-300 px-2 py-1 text-sm"
            >
              {langs.length === 0 ? (
                <option value={lang}>{lang}</option>
              ) : (
                langs.map((l) => (
                  <option key={l.id} value={l.code}>
                    {l.code}
                  </option>
                ))
              )}
            </select>
          </label>
          <label className="flex flex-col text-xs text-zinc-600">
            Channel
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              className="mt-1 rounded border border-zinc-300 px-2 py-1 text-sm"
            >
              {CHANNELS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => loadTemplate()}
            className="rounded bg-zinc-200 px-3 py-1 text-sm disabled:opacity-50"
          >
            Load
          </button>
          <button
            type="button"
            disabled={busy || !token}
            onClick={() => saveTemplate()}
            className="rounded bg-zinc-900 px-3 py-1 text-sm text-white disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
        <label className="block text-xs text-zinc-600">
          Title template
          <input
            value={titleTemplate}
            onChange={(e) => setTitleTemplate(e.target.value)}
            maxLength={512}
            className="mt-1 w-full max-w-3xl rounded border border-zinc-300 px-2 py-1 text-sm"
          />
        </label>
        <label className="block text-xs text-zinc-600">
          Body template
          <textarea
            value={bodyTemplate}
            onChange={(e) => setBodyTemplate(e.target.value)}
            rows={12}
            className="mt-1 w-full max-w-3xl rounded border border-zinc-300 px-2 py-1 font-mono text-sm"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          Active
        </label>
      </div>
    </div>
  );
}
