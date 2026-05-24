/**
 * v2 admin-redesign — PageHeader component
 *
 * Source: docs/zulu-admin-v2.html lines 83-92, .page-header pattern.
 * Layout: breadcrumb on top, h1 title + optional subtitle, actions on right.
 *
 * Usage:
 *   <PageHeader
 *     breadcrumb={[{ label: "Home", href: "/" }, { label: "Hotels" }]}
 *     title="Hotels"
 *     subtitle="Manage your hotel inventory"
 *     actions={<>
 *       <button className="...">Import</button>
 *       <button className="...">Add hotel</button>
 *     </>}
 *   />
 */

import type { ReactNode } from "react";
import { Breadcrumb, type BreadcrumbItem } from "./Breadcrumb";

export type PageHeaderProps = {
  breadcrumb?: BreadcrumbItem[];
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
};

export function PageHeader({ breadcrumb, title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div>
        {breadcrumb && breadcrumb.length > 0 ? (
          <div className="mb-1.5">
            <Breadcrumb items={breadcrumb} />
          </div>
        ) : null}
        <h1
          className="text-[22px] font-semibold leading-tight tracking-[-0.01em]"
          style={{ color: "var(--admin-text-primary)" }}
        >
          {title}
        </h1>
        {subtitle ? (
          <div
            className="mt-1 text-[13px]"
            style={{ color: "var(--admin-text-secondary)" }}
          >
            {subtitle}
          </div>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
