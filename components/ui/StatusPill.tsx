/**
 * Figma layout reference: Quest CRM Copy template
 *   - Status pills appear in: Client Table 4393:6787, Service Logs 4658:8386,
 *     Invoices 4803:12969, Requests 5048:14689, Project/Cases 4866:17026, Payroll 9833:17694.
 * Brand tokens: success/warning/info/error/muted token scales.
 *
 * Usage:
 *   <StatusPill status="confirmed" />     // auto-classifies common strings
 *   <StatusPill status="custom" tone="info" />  // override tone
 */

import type { ReactNode } from "react";

export type StatusTone = "success" | "warning" | "info" | "error" | "muted";

const TONE_CLASSES: Record<StatusTone, string> = {
  success: "bg-success-50 text-success-700 border-success-100",
  warning: "bg-warning-50 text-warning-700 border-warning-100",
  info: "bg-info-50 text-info-700 border-info-100",
  error: "bg-error-50 text-error-700 border-error-100",
  muted: "bg-figma-bg-1 text-fg-t6 border-default",
};

const TONE_BAR_CLASSES: Record<StatusTone, string> = {
  success: "bg-success-500",
  warning: "bg-warning-500",
  info: "bg-info-500",
  error: "bg-error-500",
  muted: "bg-slate-300",
};

export function autoStatusTone(value: string | null | undefined): StatusTone {
  const s = (value ?? "").toLowerCase().trim();
  if (!s) return "muted";
  if (
    s.includes("active") ||
    s.includes("confirmed") ||
    s.includes("complete") ||
    s.includes("paid") ||
    s.includes("approved") ||
    s.includes("done") ||
    s.includes("resolved") ||
    s.includes("success")
  )
    return "success";
  if (
    s.includes("pending") ||
    s.includes("waiting") ||
    s.includes("review") ||
    s.includes("draft") ||
    s.includes("partly") ||
    s.includes("warn")
  )
    return "warning";
  if (
    s.includes("progress") ||
    s.includes("processing") ||
    s.includes("sent") ||
    s.includes("info")
  )
    return "info";
  if (
    s.includes("cancel") ||
    s.includes("fail") ||
    s.includes("error") ||
    s.includes("overdue") ||
    s.includes("rejected") ||
    s.includes("blocked") ||
    s.includes("inactive")
  )
    return "error";
  return "muted";
}

export interface StatusPillProps {
  status: string | null | undefined;
  tone?: StatusTone;
  children?: ReactNode;
  className?: string;
}

export function StatusPill({ status, tone, children, className = "" }: StatusPillProps) {
  const resolved = tone ?? autoStatusTone(status);
  const cls = TONE_CLASSES[resolved];
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${cls} ${className}`}
    >
      {children ?? status ?? "—"}
    </span>
  );
}

/**
 * StatusStep — colored top bar + label + value (used in detail page status header).
 * Reference: Quest CRM Invoice Details 9318:15771.
 */
export function StatusStep({
  label,
  value,
  tone,
}: {
  label: string;
  value: ReactNode;
  tone: StatusTone;
}) {
  return (
    <div className="admin-card overflow-hidden">
      <div className={`h-1 ${TONE_BAR_CLASSES[tone]}`} />
      <div className="p-4">
        <div className="text-xs font-medium uppercase tracking-wide text-fg-t6">{label}</div>
        <div className="mt-1 text-sm font-semibold text-fg-t8">{value}</div>
      </div>
    </div>
  );
}
