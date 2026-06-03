"use client";

/**
 * v2 admin-redesign — Modal (centered overlay)
 *
 * Source: docs/admin_designe/6_management.html .modal-overlay, .modal,
 * .modal-header, .modal-body, .modal-footer, .modal.lg, .modal-section-label.
 *
 * Used for CREATE/EDIT forms (contracts, templates, etc.). Escape closes;
 * body scroll is locked while open.
 *
 * Usage:
 *   <V2Modal open={open} onClose={() => setOpen(false)} title="New contract"
 *     size="lg" footer={<>
 *       <V2Button variant="default" onClick={...}>Cancel</V2Button>
 *       <V2Button variant="primary" onClick={...}>Create</V2Button>
 *     </>}
 *   >
 *     <V2ModalSectionLabel>Parties & template</V2ModalSectionLabel>
 *     <div className="form-grid-2">...</div>
 *   </V2Modal>
 */

import { useEffect } from "react";
import type { ReactNode } from "react";

export function V2Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "md" | "lg";
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

  if (!open) return null;
  const w = size === "lg" ? "w-[640px]" : "w-[520px]";
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`flex max-h-[calc(100vh-64px)] max-w-[calc(100vw-32px)] flex-col rounded-[12px] bg-white shadow-2xl ${w}`}
      >
        {title ? (
          <div
            className="flex items-center justify-between border-b px-5 py-4"
            style={{ borderColor: "var(--admin-border)" }}
          >
            <div
              className="text-[15px] font-semibold"
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
            className="flex justify-end gap-2 border-t px-5 py-3"
            style={{
              borderColor: "var(--admin-border)",
              backgroundColor: "var(--admin-bg-secondary)",
            }}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function V2ModalSectionLabel({ children }: { children: ReactNode }) {
  return (
    <div
      className="mb-2.5 mt-5 border-b pb-1.5 text-[11px] font-semibold uppercase tracking-[0.4px] first:mt-0"
      style={{ color: "var(--admin-text-tertiary)", borderColor: "var(--admin-border)" }}
    >
      {children}
    </div>
  );
}
