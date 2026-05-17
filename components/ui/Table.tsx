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

export function TR({ className, children, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        "border-b border-default last:border-0 transition-colors hover:bg-figma-bg-1/60",
        className
      )}
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
