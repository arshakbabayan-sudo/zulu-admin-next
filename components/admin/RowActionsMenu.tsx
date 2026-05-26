"use client";

/**
 * Shared inline action-row dropdown for admin v2 list pages.
 *
 * Used to consolidate per-row table actions behind a single 3-dot
 * MoreVertical IconButton, replacing the v1 pattern of clustering
 * 5-10 inline text buttons per row.
 *
 * Click-outside + Escape close the menu. Menu items render with an
 * optional leading icon and may flag themselves destructive (red text).
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { MoreVertical } from "lucide-react";
import { IconButton } from "@/components/ui/v2";

export type RowMenuItem = {
  key: string;
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  destructive?: boolean;
  disabled?: boolean;
};

type Props = {
  items: RowMenuItem[];
  disabled?: boolean;
  label?: string;
};

export function RowActionsMenu({ items, disabled, label = "More" }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative inline-block">
      <IconButton
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
      >
        <MoreVertical />
      </IconButton>
      {open && items.length > 0 ? (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-1 min-w-[180px] rounded-md border bg-white py-1 text-[12px] shadow-lg"
          style={{ borderColor: "var(--admin-border)" }}
        >
          {items.map((it) => (
            <button
              key={it.key}
              type="button"
              role="menuitem"
              disabled={it.disabled}
              onClick={() => {
                setOpen(false);
                it.onSelect();
              }}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-left transition hover:bg-[color:var(--admin-bg-secondary)] disabled:opacity-40 ${it.destructive ? "text-error-700" : "text-fg-t7"}`}
            >
              {it.icon ? (
                <span className="inline-flex h-4 w-4 items-center justify-center [&>svg]:h-4 [&>svg]:w-4" aria-hidden>
                  {it.icon}
                </span>
              ) : null}
              <span className="font-medium">{it.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
