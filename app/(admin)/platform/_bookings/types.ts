import type { ReactNode } from "react";
import type { AdminUser } from "@/lib/auth-types";

/** The two Bookings tabs, in the fixed mock order. */
export type BookingsTab = "bookings" | "packages";

/** Props every pane receives from the BookingsPage shell. Mirrors the
 *  Inventory pane contract so the two surfaces stay consistent. */
export type BookingsPaneProps = {
  token: string | null;
  user: AdminUser | null;
  lang: string;
  isSuper: boolean;
  /** Mount a node into the page-header action slot (Refresh + Export). */
  registerAction: (node: ReactNode) => void;
  /** Report the pane's list total so the shell can render the tab count pill. */
  reportCount: (n: number | undefined) => void;
  /** Override the breadcrumb-current label (e.g. an order number while a
   *  full-page in-pane detail is open). Pass null to restore the tab label. */
  setCrumbOverride: (label: string | null) => void;
  showToast: (msg: string) => void;
};
