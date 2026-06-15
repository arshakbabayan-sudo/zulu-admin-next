import type { ReactNode } from "react";
import type { AdminUser } from "@/lib/auth-types";

/** The 9 inventory verticals, in the fixed mock order. */
export type InventoryTab =
  | "hotels"
  | "flights"
  | "transfers"
  | "cars"
  | "excursions"
  | "visas"
  | "packages"
  | "offers"
  | "external-api";

/** Operator (own company, full CRUD) vs super-admin cross-company oversight
 *  (read-only). Toggled in-page by the header scope segmented control. */
export type InventoryScope = "operator" | "oversight";

/** Props every pane receives from the InventoryPage shell. */
export type InventoryPaneProps = {
  token: string | null;
  user: AdminUser | null;
  lang: string;
  scope: InventoryScope;
  isSuper: boolean;
  /** Mount a node into the page-header action slot (e.g. the "+ New" CTA). */
  registerAction: (node: ReactNode) => void;
  showToast: (msg: string) => void;
};
