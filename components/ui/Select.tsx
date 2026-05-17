import React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Quest CRM Figma 528:2628 — outlined select with chevron.
 * Matches the Input visual height (48px) so they line up in forms.
 *
 * Use directly:
 *   <Select value={x} onChange={(e) => setX(e.target.value)}>
 *     <option value="a">A</option>
 *   </Select>
 */
/** Native `size` attribute is a number; rename our visual sizing prop so they don't clash. */
export type SelectProps = Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size"> & {
  fieldSize?: "sm" | "md";
};

const SIZE_CLASSES: Record<NonNullable<SelectProps["fieldSize"]>, string> = {
  sm: "h-10 px-3 text-sm",
  md: "h-12 px-4 text-ds-input-text font-ds-input-text",
};

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, fieldSize = "md", children, ...props }, ref) => {
    return (
      <div className="relative w-full">
        <select
          ref={ref}
          className={cn(
            "flex w-full appearance-none rounded-zulu border border-input bg-background pr-10 text-foreground transition-colors",
            "focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary-100",
            "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-figma-bg-1",
            SIZE_CLASSES[fieldSize],
            className
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-fg-t6"
        />
      </div>
    );
  }
);

Select.displayName = "Select";
