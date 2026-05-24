/**
 * v2 admin-redesign — IconButton component
 *
 * Source: docs/zulu-admin-v2.html lines 148-150, .icon-btn pattern.
 * Small 30×30 transparent button for table row actions, file actions, etc.
 *
 * Usage:
 *   <IconButton aria-label="View" onClick={...}>
 *     <i className="ti ti-eye" />
 *   </IconButton>
 *
 *   <IconButton as="link" href="/some/path" aria-label="Edit">
 *     <PencilIcon />
 *   </IconButton>
 */

import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type CommonProps = {
  children: ReactNode;
  className?: string;
  "aria-label": string;
};

type ButtonProps = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children" | "aria-label"> & {
    as?: "button";
  };

type LinkProps = CommonProps & {
  as: "link";
  href: string;
};

type Props = ButtonProps | LinkProps;

// v2 admin-redesign — bumped from 30×30 to 34×34 (spec was 30×30 but the
// no-border default made buttons feel invisible in dense tables). Now uses
// a subtle 1px border + faint bg by default, so the action target is
// always visible even before hover. SVG children are force-sized to 18px
// via the `[&>svg]:` selectors so every caller renders icons at the same
// size regardless of what they pass (h-4 w-4, h-5 w-5, no size at all).
const BASE_CLASSES =
  "inline-flex h-[34px] w-[34px] items-center justify-center rounded-md border bg-white transition [&>svg]:h-[18px] [&>svg]:w-[18px]";

const HOVER_STYLE: React.CSSProperties = {
  color: "var(--admin-text-secondary)",
  borderColor: "var(--admin-border)",
};

export function IconButton(props: Props) {
  if (props.as === "link") {
    const { children, className = "", href, ...rest } = props;
    return (
      <Link
        href={href}
        className={`${BASE_CLASSES} hover:bg-[color:var(--admin-bg-secondary)] hover:text-[color:var(--admin-text-primary)] ${className}`.trim()}
        style={HOVER_STYLE}
        aria-label={rest["aria-label"]}
      >
        {children}
      </Link>
    );
  }
  const { children, className = "", as: _ignored, ...rest } = props;
  return (
    <button
      type="button"
      className={`${BASE_CLASSES} hover:bg-[color:var(--admin-bg-secondary)] hover:text-[color:var(--admin-text-primary)] ${className}`.trim()}
      style={HOVER_STYLE}
      {...rest}
    >
      {children}
    </button>
  );
}
