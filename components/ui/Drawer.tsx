"use client";

/**
 * Side-sheet primitive — slides in from the right and overlays the page.
 *
 * Use when a detail view is wide or text-heavy and a centered modal would
 * feel constrained: cases detail with a conversation thread, ticket
 * detail with reply history, customer detail with a booking timeline.
 *
 * Behavior:
 * - ESC key closes
 * - Backdrop click closes
 * - Focus moves into the drawer on open; the previously-focused element
 *   is restored on close
 * - Body scroll locked while open
 *
 * Usage:
 *   <Drawer open={open} onClose={() => setOpen(false)} title="Case #C-0001">
 *     <DrawerSection>...</DrawerSection>
 *   </Drawer>
 */

import { useEffect, useRef } from "react";

export type DrawerProps = {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  /** "md" = 480px, "lg" = 640px, "xl" = 800px */
  size?: "md" | "lg" | "xl";
  children: React.ReactNode;
  footer?: React.ReactNode;
};

const SIZE_CLASS: Record<NonNullable<DrawerProps["size"]>, string> = {
  md: "w-full sm:max-w-[480px]",
  lg: "w-full sm:max-w-[640px]",
  xl: "w-full sm:max-w-[800px]",
};

export function Drawer({ open, onClose, title, subtitle, size = "lg", children, footer }: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", handler);

    // Focus the panel after paint so the first focusable child can be tabbed to.
    requestAnimationFrame(() => {
      panelRef.current?.focus();
    });

    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = prevOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={`flex h-full flex-col bg-white shadow-zulu-card outline-none ${SIZE_CLASS[size]} animate-[slideInRight_0.18s_ease-out]`}
      >
        {(title || subtitle) && (
          <div className="flex items-start justify-between gap-3 border-b border-default px-5 py-4">
            <div>
              {title && <div className="text-base font-semibold text-fg-t8">{title}</div>}
              {subtitle && <div className="mt-0.5 text-xs text-fg-t6">{subtitle}</div>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-zulu p-1 text-fg-t6 hover:bg-figma-bg-1 hover:text-fg-t8"
            >
              <span aria-hidden className="text-lg leading-none">✕</span>
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="border-t border-default px-5 py-3">{footer}</div>}
      </div>
      {/* Keyframe injected via inline style so we don't need a tailwind config change */}
      <style jsx global>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
}

export function DrawerSection({
  title,
  children,
  className,
}: {
  title?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`mb-5 ${className ?? ""}`}>
      {title && <h3 className="mb-2 text-sm font-semibold text-fg-t8">{title}</h3>}
      {children}
    </section>
  );
}
