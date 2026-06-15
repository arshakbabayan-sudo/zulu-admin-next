import type { ReactNode } from "react";
import type { AdminUser } from "@/lib/auth-types";

/** The 7 Finance tabs, in the fixed mock order. Per-X is super-admin only. */
export type FinanceTab =
  | "summary"
  | "invoices"
  | "payments"
  | "commissions"
  | "transactions"
  | "vouchers"
  | "perx";

/** Props every Finance pane receives from the FinancePage shell. Mirrors the
 *  Inventory / Bookings pane contract so the surfaces stay consistent. */
export type FinancePaneProps = {
  token: string | null;
  user: AdminUser | null;
  lang: string;
  isSuper: boolean;
  /** Mount a node into the page-header action slot (Refresh / Export / New …). */
  registerAction: (node: ReactNode) => void;
  /** Report the pane's list total so the shell can render the tab count pill. */
  reportCount: (n: number | undefined) => void;
  showToast: (msg: string) => void;
};
