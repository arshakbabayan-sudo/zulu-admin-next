"use client";

/**
 * Settings page shell — left rail + content, per the design mock
 * `11_settings.html` `.set-layout` (grid 248px + 1fr, collapses < lg).
 *
 * Settings pages wrap their header + cards in <SettingsShell active="...">
 * in place of the old horizontal <SettingsSubgroupTabs> strip. The rail is
 * route-driven (active item from the `active` href); children render in the
 * right-hand pane.
 */

import type { ReactNode } from "react";
import { SettingsRail } from "@/components/settings/SettingsRail";

type Props = {
  /** Href of the open pane (matches a SETTINGS_SUBGROUPS item, e.g. "/platform/rbac"). */
  active: string;
  children: ReactNode;
  /** Optional per-href label overrides passed through to the rail. */
  labels?: Record<string, string>;
};

export function SettingsShell({ active, children, labels }: Props) {
  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[248px_minmax(0,1fr)]">
      <SettingsRail activeHref={active} labels={labels} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
