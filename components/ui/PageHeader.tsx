import React from "react";
import { cn } from "@/lib/cn";

/**
 * Page header pattern shared by every admin page — title + subtitle + actions.
 * Quest CRM convention: title on the left, actions (buttons) on the right.
 *
 * <PageHeader
 *   title="Users"
 *   subtitle="42 active accounts"
 *   actions={<Button>+ New user</Button>}
 * />
 */
export type PageHeaderProps = {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
};

export function PageHeader({ title, subtitle, actions, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-wrap items-end justify-between gap-3 pb-2",
        className
      )}
    >
      <div className="min-w-0">
        <h1 className="admin-page-title">{title}</h1>
        {subtitle ? (
          <p className="mt-1 text-sm text-fg-t6">{subtitle}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  );
}
