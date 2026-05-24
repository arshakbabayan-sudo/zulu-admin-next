/**
 * v2 admin-redesign — Breadcrumb component
 *
 * Source: docs/zulu-admin-v2.html lines 86-90, .breadcrumb pattern.
 *
 * Usage:
 *   <Breadcrumb items={[
 *     { label: "Home", href: "/" },
 *     { label: "Inventory", href: "/operator/hotels" },
 *     { label: "Hotels" },  // last = current, no href
 *   ]} />
 */

import Link from "next/link";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav
      className="flex items-center gap-1.5 text-xs"
      style={{ color: "var(--admin-text-secondary)" }}
      aria-label="Breadcrumb"
    >
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        return (
          <span key={`${item.label}-${idx}`} className="inline-flex items-center gap-1.5">
            {idx > 0 ? (
              <ChevronRight />
            ) : null}
            {item.href && !isLast ? (
              <Link
                href={item.href}
                className="transition hover:text-[color:var(--admin-primary)]"
                style={{ color: "var(--admin-text-secondary)" }}
              >
                {item.label}
              </Link>
            ) : (
              <span
                className="font-medium"
                style={{ color: isLast ? "var(--admin-text-primary)" : "var(--admin-text-secondary)" }}
                aria-current={isLast ? "page" : undefined}
              >
                {item.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}

function ChevronRight() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3 w-3 fill-none stroke-current"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
