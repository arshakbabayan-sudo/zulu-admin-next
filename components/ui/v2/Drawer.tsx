"use client";

/**
 * v2 admin-redesign — Drawer (right-side slide-in)
 *
 * Source: docs/admin_designe/6_management.html .drawer, .drawer-overlay,
 * .drawer-header, .drawer-body, .drawer-footer, .drawer-section, .info-row.
 *
 * Used for DETAIL views (row click → drawer with key/value rows + actions).
 * Escape closes; body scroll is locked while open.
 *
 * Usage:
 *   <V2Drawer open={open} onClose={() => setOpen(false)} title="Seller application">
 *     <V2DrawerSection>Company</V2DrawerSection>
 *     <V2DrawerInfoRow label="Name" value="Tour Operator 2" />
 *     ...
 *   </V2Drawer>
 */

import { useEffect } from "react";
import type { ReactNode } from "react";

export function V2Drawer({
  open,
  onClose,
  title,
  children,
  footer,
  width = 520,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  return (
    <>
      <div
        aria-hidden
        onClick={onClose}
        className={`fixed inset-0 z-[50] bg-black/30 transition-opacity duration-200 ${
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <aside
        role="dialog"
        aria-modal="true"
        className={`fixed inset-y-0 right-0 z-[51] flex max-w-full flex-col border-l bg-white shadow-2xl transition-transform duration-200 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        style={{ width, borderColor: "var(--admin-border)" }}
      >
        {title ? (
          <div
            className="flex items-start justify-between gap-3 border-b px-5 py-[18px]"
            style={{ borderColor: "var(--admin-border)" }}
          >
            <div
              className="min-w-0 text-[15px] font-semibold"
              style={{ color: "var(--admin-text-primary)" }}
            >
              {title}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100"
            >
              <i className="ti ti-x text-[18px]" aria-hidden />
            </button>
          </div>
        ) : null}
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer ? (
          <div
            className="flex gap-2 border-t px-5 py-3.5"
            style={{
              borderColor: "var(--admin-border)",
              backgroundColor: "var(--admin-bg-secondary)",
            }}
          >
            {footer}
          </div>
        ) : null}
      </aside>
    </>
  );
}

export function V2DrawerSection({ children }: { children: ReactNode }) {
  return (
    <div
      className="mb-2 mt-[18px] text-[11px] font-semibold uppercase tracking-[0.4px] first:mt-0"
      style={{ color: "var(--admin-text-tertiary)" }}
    >
      {children}
    </div>
  );
}

export function V2DrawerInfoRow({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div
      className="grid grid-cols-[130px_1fr] gap-4 border-b border-dashed py-1.5 last:border-b-0"
      style={{ borderColor: "var(--admin-border)" }}
    >
      <div
        className="text-[12px] font-medium"
        style={{ color: "var(--admin-text-secondary)" }}
      >
        {label}
      </div>
      <div
        className="break-words text-[13px]"
        style={{ color: "var(--admin-text-primary)" }}
      >
        {value}
      </div>
    </div>
  );
}
