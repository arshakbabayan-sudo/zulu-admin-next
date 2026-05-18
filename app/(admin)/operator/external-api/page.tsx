"use client";

/**
 * Phase 9 — External API integration placeholder UI.
 *
 * Per the roadmap and feedback_no_payment_integration_yet.md sibling memory,
 * the actual API integration is handled by the user's OTHER project (a
 * separate codebase that returns inventory). ZULU admin just needs the UI
 * surface where operator / agent can enter their external platform credentials.
 * No backend writes from this page — submit is a visual confirmation only
 * until the user's other project wiring lands.
 */

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { canAccessOperatorToolsNav } from "@/lib/access";
import { Button, FormField, Input, PageHeader } from "@/components/ui";
import { useState } from "react";

type ConnectionStatus = "not_connected" | "testing" | "connected" | "error";

function statusBadge(s: ConnectionStatus) {
  const map: Record<ConnectionStatus, { label: string; cls: string }> = {
    not_connected: { label: "Not connected", cls: "bg-figma-bg-1 text-fg-t6" },
    testing: { label: "Testing…", cls: "bg-warning-50 text-warning-700" },
    connected: { label: "Connected", cls: "bg-success-50 text-success-700" },
    error: { label: "Error", cls: "bg-error-50 text-error-700" },
  };
  const m = map[s];
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${m.cls}`}>
      {m.label}
    </span>
  );
}

export default function OperatorExternalApiPage() {
  const { user } = useAdminAuth();
  const allowed = canAccessOperatorToolsNav(user);

  const [baseUrl, setBaseUrl] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<ConnectionStatus>("not_connected");
  const [note, setNote] = useState<string | null>(null);

  // Visual-only test action. When the user's other project is wired in,
  // this will POST to the real connect endpoint.
  function fakeTestConnection() {
    if (!baseUrl.trim() || !login.trim() || !password.trim()) {
      setNote("Fill base URL, login and password before testing.");
      setStatus("error");
      return;
    }
    setStatus("testing");
    setNote(null);
    window.setTimeout(() => {
      setStatus("connected");
      setNote("Visual confirmation only — the actual connection will be established when the external base integration is wired in.");
    }, 800);
  }

  function fakeDisconnect() {
    setStatus("not_connected");
    setBaseUrl("");
    setLogin("");
    setPassword("");
    setNote(null);
  }

  function fakeImport() {
    setNote("Import is a no-op for now — the external base integration is parked. When ready, this will trigger the connector in the user's other project.");
  }

  if (!allowed) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">External API</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="External API integration"
        subtitle={
          <span className="inline-flex items-center gap-3">
            <span>Connect this operator account to your external inventory base.</span>
            {statusBadge(status)}
          </span>
        }
      />

      <div className="rounded-zulu border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-800">
        <div className="font-medium">Placeholder UI — no live integration yet.</div>
        <p className="mt-1 text-xs leading-relaxed">
          The actual connector lives in a separate project that returns inventory back to ZULU. The form
          below records the operator&apos;s intent and credentials; the &quot;Test connection&quot; and
          &quot;Import&quot; buttons are visual confirmations only until the connector is wired in. No
          credentials are persisted server-side from this page yet.
        </p>
      </div>

      <section className="admin-card p-4 space-y-3">
        <h2 className="text-base font-semibold">Connection details</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="External base URL" htmlFor="ext-url" required className="sm:col-span-2">
            <Input
              id="ext-url"
              type="url"
              placeholder="https://api.partner.example.com"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
          </FormField>
          <FormField label="Login" htmlFor="ext-login" required>
            <Input
              id="ext-login"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              placeholder="API username or account email"
              autoComplete="off"
            />
          </FormField>
          <FormField label="Password / API key" htmlFor="ext-password" required>
            <Input
              id="ext-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </FormField>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={status === "testing"} onClick={fakeTestConnection}>
            {status === "testing" ? "Testing…" : "Test connection"}
          </Button>
          {status === "connected" && (
            <Button size="sm" variant="primary" onClick={fakeImport}>
              Import inventory
            </Button>
          )}
          {(status === "connected" || status === "error") && (
            <Button size="sm" variant="outline" onClick={fakeDisconnect}>
              Disconnect
            </Button>
          )}
        </div>
        {note && (
          <p className={`text-xs ${status === "error" ? "text-error-700" : "text-fg-t6"}`}>{note}</p>
        )}
      </section>

      <section className="admin-card p-4 space-y-2">
        <h3 className="text-sm font-semibold text-fg-t8">What happens when this lands?</h3>
        <ul className="list-disc pl-5 text-xs text-fg-t7 space-y-1">
          <li>
            <span className="font-medium">Test connection</span> will call the connector service in the
            user&apos;s other project and verify the credentials against the live external base.
          </li>
          <li>
            <span className="font-medium">Import inventory</span> will trigger a backfill of the
            external base&apos;s offers into ZULU&apos;s inventory tables.
          </li>
          <li>
            <span className="font-medium">Connection status</span> will reflect the live state — last
            sync timestamp, last error, total items imported.
          </li>
        </ul>
      </section>
    </div>
  );
}
