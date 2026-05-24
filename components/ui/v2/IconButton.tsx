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

const BASE_CLASSES =
  "inline-flex h-[30px] w-[30px] items-center justify-center rounded-[6px] border-none bg-transparent transition";

const HOVER_STYLE: React.CSSProperties = {
  color: "var(--admin-text-secondary)",
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
