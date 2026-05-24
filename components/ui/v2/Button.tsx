/**
 * v2 admin-redesign — Button component
 *
 * Source: docs/zulu-admin-v2.html lines 102-115, .btn / .btn-primary /
 * .btn-danger / .btn-success / .btn-ghost / .btn-sm / .btn-xs.
 *
 * Heights: md=36px (default) · sm=30px · xs=26px
 * Variants: default (white border), primary (purple solid),
 *           danger (red solid), success (green solid), ghost (transparent)
 *
 * Usage:
 *   <V2Button variant="primary" icon={<i className="ti ti-plus" />}>
 *     Add hotel
 *   </V2Button>
 *
 *   <V2Button as="link" href="/some/path" variant="ghost" size="sm">
 *     Cancel
 *   </V2Button>
 */

import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export type V2ButtonVariant = "default" | "primary" | "danger" | "success" | "ghost";
export type V2ButtonSize = "xs" | "sm" | "md";

const SIZE_CLASSES: Record<V2ButtonSize, string> = {
  xs: "h-[26px] px-2 text-[11px]",
  sm: "h-[30px] px-2.5 text-[12px]",
  md: "h-[36px] px-3.5 text-[13px]",
};

function variantStyle(variant: V2ButtonVariant): React.CSSProperties {
  switch (variant) {
    case "primary":
      return {
        backgroundColor: "var(--admin-primary)",
        borderColor: "var(--admin-primary)",
        color: "white",
      };
    case "danger":
      return {
        backgroundColor: "var(--admin-danger)",
        borderColor: "var(--admin-danger)",
        color: "white",
      };
    case "success":
      return {
        backgroundColor: "var(--admin-success)",
        borderColor: "var(--admin-success)",
        color: "white",
      };
    case "ghost":
      return {
        backgroundColor: "transparent",
        borderColor: "transparent",
        color: "var(--admin-text-primary)",
      };
    case "default":
    default:
      return {
        backgroundColor: "white",
        borderColor: "var(--admin-border)",
        color: "var(--admin-text-primary)",
      };
  }
}

type CommonProps = {
  children: ReactNode;
  variant?: V2ButtonVariant;
  size?: V2ButtonSize;
  icon?: ReactNode;
  iconRight?: ReactNode;
  className?: string;
};

type AsButtonProps = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> & {
    as?: "button";
  };

type AsLinkProps = CommonProps & {
  as: "link";
  href: string;
};

type Props = AsButtonProps | AsLinkProps;

const BASE =
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[8px] border font-medium transition disabled:opacity-50 disabled:cursor-not-allowed";

export function V2Button(props: Props) {
  const { variant = "default", size = "md", icon, iconRight, className = "", children } = props;
  const classes = `${BASE} ${SIZE_CLASSES[size]} ${className}`.trim();
  const inner = (
    <>
      {icon}
      {children}
      {iconRight}
    </>
  );

  if (props.as === "link") {
    return (
      <Link href={props.href} className={classes} style={variantStyle(variant)}>
        {inner}
      </Link>
    );
  }
  const { as: _ignored, icon: _i, iconRight: _ir, variant: _v, size: _s, className: _c, children: _ch, ...rest } = props;
  return (
    <button type="button" className={classes} style={variantStyle(variant)} {...rest}>
      {inner}
    </button>
  );
}
