"use client";

import React from "react";
import { cn } from "@/lib/cn";

/**
 * Quest CRM Figma 9737:18674 — pill toggle (~36×20).
 * Off: gray track + white knob. On: primary-500 track + white knob shifted.
 */
export type SwitchProps = {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  disabled?: boolean;
  label?: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
  id?: string;
  "aria-label"?: string;
};

export function Switch({
  checked,
  onCheckedChange,
  disabled,
  label,
  description,
  className,
  id,
  "aria-label": ariaLabel,
}: SwitchProps) {
  const reactId = React.useId();
  const inputId = id ?? reactId;
  const toggle = () => {
    if (disabled) return;
    onCheckedChange(!checked);
  };
  return (
    <label
      htmlFor={inputId}
      className={cn(
        "inline-flex items-start gap-3 cursor-pointer select-none",
        disabled && "cursor-not-allowed opacity-60",
        className
      )}
    >
      <button
        type="button"
        role="switch"
        id={inputId}
        aria-checked={checked}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={toggle}
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors mt-0.5",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-100",
          checked ? "bg-primary-500" : "bg-secondary-100"
        )}
      >
        <span
          className={cn(
            "inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform",
            checked ? "translate-x-[18px]" : "translate-x-[2px]"
          )}
        />
      </button>
      {label || description ? (
        <span className="flex flex-col gap-0.5">
          {label ? <span className="text-sm font-medium text-fg-t8 leading-5">{label}</span> : null}
          {description ? <span className="text-xs text-fg-t6 leading-4">{description}</span> : null}
        </span>
      ) : null}
    </label>
  );
}
