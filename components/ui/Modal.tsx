"use client";

import React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Quest CRM Figma 3426:4161 — header with title + X close, white card body.
 * Backdrop dims to 40% black; Escape and backdrop-click close (unless closeOnBackdrop=false).
 *
 * WCAG 2.1 (G3 audit follow-up):
 *  - role="dialog" + aria-modal="true"
 *  - aria-labelledby links the dialog to its title (auto-generated id)
 *  - Focus moves to the dialog on open
 *  - Tab + Shift+Tab cycle within the dialog (focus trap)
 *  - Focus returns to the trigger on close
 */
export type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  closeOnBackdrop?: boolean;
  className?: string;
};

const SIZE_CLASSES: Record<NonNullable<ModalProps["size"]>, string> = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  closeOnBackdrop = true,
  className,
}: ModalProps) {
  const dialogRef = React.useRef<HTMLDivElement | null>(null);
  const previouslyFocused = React.useRef<HTMLElement | null>(null);
  const titleId = React.useId();

  // Escape to close.
  React.useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  // Body scroll lock.
  React.useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  // Focus management: remember trigger → move focus into dialog → restore on close.
  React.useEffect(() => {
    if (!isOpen) return;

    previouslyFocused.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

    // Defer focus move so children have a chance to mount.
    const id = window.requestAnimationFrame(() => {
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusables = dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      const target = focusables[0] ?? dialog;
      target.focus();
    });

    return () => {
      window.cancelAnimationFrame(id);
      const restore = previouslyFocused.current;
      if (restore && typeof restore.focus === "function") {
        restore.focus();
      }
    };
  }, [isOpen]);

  // Focus trap: Tab + Shift+Tab cycle inside the dialog.
  React.useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusables = Array.from(
        dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter((el) => !el.hasAttribute("aria-hidden") && el.offsetParent !== null);
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (active === first || !dialog.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={closeOnBackdrop ? onClose : undefined}
    >
      <div className="fixed inset-0 bg-black/40" aria-hidden />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={cn(
          "relative z-10 w-full overflow-hidden rounded-zulu-card border border-default bg-white shadow-zulu-card focus:outline-none",
          SIZE_CLASSES[size],
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {title || description ? (
          <div className="flex items-start justify-between gap-3 border-b border-default bg-figma-bg-1 px-5 py-4">
            <div className="min-w-0 flex-1">
              {title ? (
                <h2 id={titleId} className="text-base font-semibold text-fg-t8 leading-6">{title}</h2>
              ) : null}
              {description ? (
                <p className="mt-1 text-sm text-fg-t6 leading-5">{description}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-fg-t6 hover:bg-figma-bg-1/80 hover:text-fg-t8 transition-colors"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        ) : null}
        <div className="px-5 py-4">{children}</div>
        {footer ? (
          <div className="flex items-center justify-end gap-2 border-t border-default bg-figma-bg-1 px-5 py-3">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
