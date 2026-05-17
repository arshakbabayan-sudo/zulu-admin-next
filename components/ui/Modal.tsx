"use client";

import React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Quest CRM Figma 3426:4161 — header with title + X close, white card body.
 * Backdrop dims to 40% black; Escape and backdrop-click close (unless closeOnBackdrop=false).
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
  React.useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  React.useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={closeOnBackdrop ? onClose : undefined}
    >
      <div className="fixed inset-0 bg-black/40" aria-hidden />
      <div
        className={cn(
          "relative z-10 w-full overflow-hidden rounded-zulu-card border border-default bg-white shadow-zulu-card",
          SIZE_CLASSES[size],
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {title || description ? (
          <div className="flex items-start justify-between gap-3 border-b border-default bg-figma-bg-1 px-5 py-4">
            <div className="min-w-0 flex-1">
              {title ? (
                <h2 className="text-base font-semibold text-fg-t8 leading-6">{title}</h2>
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
