"use client";

import React from "react";
import { cn } from "@/lib/cn";

/**
 * Quest CRM Figma 9900:20004 — text labels above an underline; active label has
 * a thick primary-500 underline (~2px) and a slightly darker text color.
 *
 * Controlled:
 *   const [tab, setTab] = useState("a");
 *   <Tabs value={tab} onChange={setTab} items={[{id:"a",label:"…"},…]} />
 */
export type TabItem = {
  id: string;
  label: React.ReactNode;
  disabled?: boolean;
};

export type TabsProps = {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
  size?: "sm" | "md";
};

export function Tabs({ items, value, onChange, className, size = "md" }: TabsProps) {
  return (
    <div
      role="tablist"
      className={cn(
        "flex items-end gap-1 border-b border-default overflow-x-auto",
        className
      )}
    >
      {items.map((it) => {
        const active = it.id === value;
        return (
          <button
            key={it.id}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={it.disabled}
            onClick={() => onChange(it.id)}
            className={cn(
              "relative whitespace-nowrap font-medium transition-colors",
              size === "sm" ? "px-3 py-2 text-xs" : "px-4 py-2.5 text-sm",
              active ? "text-fg-t8" : "text-fg-t6 hover:text-fg-t8",
              it.disabled && "cursor-not-allowed opacity-50"
            )}
          >
            {it.label}
            <span
              className={cn(
                "absolute -bottom-px left-0 right-0 h-[2px] rounded-t-sm transition-colors",
                active ? "bg-primary-500" : "bg-transparent"
              )}
              aria-hidden
            />
          </button>
        );
      })}
    </div>
  );
}
