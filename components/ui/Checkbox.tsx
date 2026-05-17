import React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Quest CRM Figma 238:1392 — square checkbox with rounded corners.
 * Hidden native input keeps form semantics; styled box reacts to peer state.
 */
export type CheckboxProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label?: React.ReactNode;
  description?: React.ReactNode;
};

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, description, id, disabled, ...props }, ref) => {
    const reactId = React.useId();
    const inputId = id ?? reactId;
    return (
      <label
        htmlFor={inputId}
        className={cn(
          "inline-flex items-start gap-3 cursor-pointer select-none",
          disabled && "cursor-not-allowed opacity-60",
          className
        )}
      >
        <span className="relative inline-flex h-5 w-5 shrink-0 items-center justify-center mt-0.5">
          <input
            ref={ref}
            id={inputId}
            type="checkbox"
            disabled={disabled}
            className="peer absolute inset-0 h-full w-full appearance-none rounded-[4px] border border-input bg-background transition-colors checked:border-primary checked:bg-primary-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-100 disabled:cursor-not-allowed"
            {...props}
          />
          <Check
            className="pointer-events-none absolute h-3.5 w-3.5 text-white opacity-0 peer-checked:opacity-100"
            strokeWidth={3}
            aria-hidden
          />
        </span>
        {label || description ? (
          <span className="flex flex-col gap-0.5">
            {label ? <span className="text-sm font-medium text-fg-t8 leading-5">{label}</span> : null}
            {description ? <span className="text-xs text-fg-t6 leading-4">{description}</span> : null}
          </span>
        ) : null}
      </label>
    );
  }
);

Checkbox.displayName = "Checkbox";
