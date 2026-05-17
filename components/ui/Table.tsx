import React from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Quest CRM Figma 10012:22306 ("Header Table") — gray-fill header row,
 * vertical separators, white body rows. Sortable cells show carets.
 *
 * Composable: <Table><THead><TR><TH>…</TH></TR></THead><TBody>…</TBody></Table>
 * Mobile rule: tables convert to a card list at <md (per admin-figma-mapping).
 */

export function Table({ className, children, ...props }: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto rounded-zulu border border-default">
      <table
        className={cn("w-full min-w-[640px] text-left text-sm", className)}
        {...props}
      >
        {children}
      </table>
    </div>
  );
}

export function THead({ className, children, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn(
        "border-b border-default bg-figma-bg-1 text-xs font-medium uppercase tracking-wide text-fg-t6",
        className
      )}
      {...props}
    >
      {children}
    </thead>
  );
}

export function TBody({ className, children, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={cn("", className)} {...props}>
      {children}
    </tbody>
  );
}

/**
 * Clickable row pattern — pass `onClick` (or `href`) and the row becomes
 * keyboard-accessible, cursor-pointer, hover-elevated. Buttons/links inside
 * the row should call `e.stopPropagation()` so the row click doesn't fire too.
 */
export function TR({
  className,
  children,
  onClick,
  href,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement> & { href?: string }) {
  const clickable = Boolean(onClick || href);
  const handleClick = (e: React.MouseEvent<HTMLTableRowElement>) => {
    if (href && typeof window !== "undefined") {
      // Honor middle-click / cmd-click for new-tab
      if (e.metaKey || e.ctrlKey || e.button === 1) {
        window.open(href, "_blank");
        return;
      }
      window.location.href = href;
      return;
    }
    onClick?.(e);
  };
  return (
    <tr
      className={cn(
        "border-b border-default last:border-0 transition-colors",
        clickable
          ? "cursor-pointer hover:bg-figma-bg-1 focus-within:bg-figma-bg-1"
          : "hover:bg-figma-bg-1/60",
        className
      )}
      onClick={clickable ? handleClick : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                if (href && typeof window !== "undefined") {
                  window.location.href = href;
                } else if (onClick) {
                  // Synthesize a minimal mouse event for callers
                  onClick({} as React.MouseEvent<HTMLTableRowElement>);
                }
              }
            }
          : undefined
      }
      {...props}
    >
      {children}
    </tr>
  );
}

export function TH({
  className,
  children,
  sortable,
  sortDir,
  onSort,
  align = "left",
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement> & {
  sortable?: boolean;
  sortDir?: "asc" | "desc" | null;
  onSort?: () => void;
  align?: "left" | "right" | "center";
}) {
  if (!sortable) {
    return (
      <th
        className={cn(
          "px-4 py-3 whitespace-nowrap",
          align === "right" && "text-right",
          align === "center" && "text-center",
          className
        )}
        {...props}
      >
        {children}
      </th>
    );
  }
  const Icon =
    sortDir === "asc" ? ChevronUp : sortDir === "desc" ? ChevronDown : ChevronsUpDown;
  return (
    <th
      className={cn(
        "px-4 py-3 whitespace-nowrap",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className
      )}
      {...props}
    >
      <button
        type="button"
        onClick={onSort}
        className={cn(
          "inline-flex items-center gap-1 uppercase tracking-wide text-xs font-medium text-fg-t6 hover:text-fg-t8 transition-colors",
          align === "right" && "ml-auto"
        )}
      >
        <span>{children}</span>
        <Icon className="h-3.5 w-3.5" aria-hidden />
      </button>
    </th>
  );
}

export function TD({
  className,
  children,
  align = "left",
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement> & {
  align?: "left" | "right" | "center";
}) {
  return (
    <td
      className={cn(
        "px-4 py-3 text-fg-t7",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className
      )}
      {...props}
    >
      {children}
    </td>
  );
}

/** Empty state row that spans all columns. */
export function TEmpty({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-12 text-center text-sm text-fg-t6">
        {children}
      </td>
    </tr>
  );
}
