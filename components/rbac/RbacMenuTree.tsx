"use client";

/**
 * RBAC menu-mirror tree (Arshak's model, 2026-06-01).
 *
 * Renders the admin menu as a permission tree: each top-level SECTION is a
 * collapsible row (dropdown); inside, each sub-ITEM lists its action
 * permissions as checkboxes. Checking/unchecking edits the in-memory set;
 * Save calls PUT /rbac/roles/{id}/permissions (full sync — same contract the
 * matrix view uses, so the two stay consistent).
 *
 * `ceilingPermissionIds` (optional) caps what can be granted — for the
 * operator/agent view, a permission the manager doesn't hold is shown disabled.
 * Omitted (super-admin) = no cap.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Check, Lock } from "lucide-react";
import {
  apiRbacTree,
  apiSyncRolePermissions,
  type RbacTreeSection,
} from "@/lib/rbac-tree-api";
import { V2Card, V2CardHeader, V2CardBody, V2Button, EmptyState } from "@/components/ui/v2";
import { useLanguage } from "@/contexts/LanguageContext";
import { settingsStrings, type SettingsKey } from "@/app/(admin)/settings/settings-i18n";

type Props = {
  token: string;
  roleId: number | null;
  roleName?: string;
  /** Permission ids the editor is allowed to grant (ceiling). Undefined = no cap. */
  ceilingPermissionIds?: Set<number>;
  /** Whether the current user may save (super-admin / manager). */
  canEdit?: boolean;
};

/** Permission action → settings-i18n key. Unknown actions fall back to the raw string. */
const ACTION_KEY: Record<string, SettingsKey> = {
  view: "rbActView",
  create: "rbActCreate",
  update: "rbActEdit",
  edit: "rbActEdit",
  delete: "rbActDelete",
  manage: "rbActManage",
  confirm: "rbActConfirm",
  cancel: "rbActCancel",
  publish: "rbActPublish",
  archive: "rbActArchive",
  issue: "rbActIssue",
  pay: "rbActPay",
  capture: "rbActCapture",
  fail: "rbActFail",
  refund: "rbActRefund",
  moderate: "rbActModerate",
  list: "rbActList",
  governance: "rbActGovernance",
  upload: "rbActUpload",
  manage_components: "rbActComponents",
  manage_seller_permissions: "rbActSellerPerms",
  view_dashboard: "rbActDashboard",
  edit_profile: "rbActEditProfile",
  update_profile: "rbActEditProfile",
};

/**
 * Section/item labels arrive from AdminRbacController::PERMISSION_TREE in
 * English, but every node carries a stable machine `key` — so labels are
 * translated client-side by key, with FALLBACK to the server-sent English
 * label for any future section/item these maps don't know yet.
 *
 * Items are resolved by the `<sectionKey>.<itemKey>` composite because item
 * keys repeat across sections (every section has an `access` item).
 */
const SECTION_LABEL_KEY: Record<string, SettingsKey> = {
  dashboard: "rbTreeSecDashboard",
  inventory: "rbTreeSecInventory",
  bookings: "rbTreeSecBookings",
  crm: "rbTreeSecCrm",
  chat: "rbTreeSecChat",
  finance: "rbTreeSecFinance",
  my_company: "rbTreeSecMyCompany",
  management: "rbTreeSecManagement",
  inbox: "rbTreeSecInbox",
  settings: "rbTreeSecSettings",
  profile: "rbTreeSecProfile",
};

const ITEM_LABEL_KEY: Record<string, SettingsKey> = {
  "dashboard.access": "rbTreeItemAccess",
  "dashboard.stats": "rbTreeItemStats",
  "inventory.access": "rbTreeItemAccess",
  "inventory.hotels": "rbTreeItemHotels",
  "inventory.flights": "rbTreeItemFlights",
  "inventory.cars": "rbTreeItemCars",
  "inventory.transfers": "rbTreeItemTransfers",
  "inventory.excursions": "rbTreeItemExcursions",
  "inventory.visas": "rbTreeItemVisas",
  "inventory.packages": "rbTreeItemPackages",
  "inventory.offers": "rbTreeItemOffers",
  "bookings.access": "rbTreeItemAccessView",
  "bookings.manage": "rbTreeItemManageBookings",
  "bookings.package_orders": "rbTreeItemPackageOrders",
  "crm.access": "rbTreeItemAccess",
  "crm.team": "rbTreeItemTeam",
  "crm.files": "rbTreeItemFiles",
  "chat.access": "rbTreeItemAccess",
  "finance.access": "rbTreeItemAccess",
  "finance.invoices": "rbTreeItemInvoices",
  "finance.payments": "rbTreeItemPayments",
  "finance.commissions": "rbTreeItemCommissions",
  "finance.entitlements": "rbTreeItemEntitlements",
  "finance.settlements": "rbTreeItemSettlements",
  "finance.platform_finance": "rbTreeItemPlatformFinance",
  "my_company.access": "rbTreeItemAccess",
  "my_company.profile": "rbTreeItemCompanyProfile",
  "my_company.seller": "rbTreeItemSellerSettings",
  "management.access": "rbTreeItemAccess",
  "management.companies": "rbTreeItemCompaniesAccess",
  "management.approvals": "rbTreeItemApprovals",
  "management.users": "rbTreeItemUsers",
  "management.reviews": "rbTreeItemReviews",
  "management.oversight": "rbTreeItemOversight",
  "inbox.access": "rbTreeItemAccess",
  "settings.access": "rbTreeItemAccess",
  "settings.localization": "rbTreeItemLocalization",
  "settings.platform_settings": "rbTreeItemPlatformSettings",
  "settings.imports": "rbTreeItemImports",
  "profile.access": "rbTreeItemAccess",
  "profile.account": "rbTreeItemAccount",
};

export function RbacMenuTree({ token, roleId, roleName, ceilingPermissionIds, canEdit = true }: Props) {
  const { lang } = useLanguage();
  const s = useMemo(() => settingsStrings(lang), [lang]);
  const [sections, setSections] = useState<RbacTreeSection[]>([]);
  const [granted, setGranted] = useState<Set<number>>(new Set());
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || roleId == null) {
      setSections([]);
      setGranted(new Set());
      return;
    }
    setLoading(true);
    setErr(null);
    setSavedOk(false);
    try {
      const res = await apiRbacTree(token, roleId);
      setSections(res.data.sections);
      const g = new Set<number>();
      for (const s of res.data.sections) {
        for (const it of s.items) {
          for (const p of it.permissions) if (p.granted) g.add(p.id);
        }
      }
      setGranted(g);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load permission tree");
    } finally {
      setLoading(false);
    }
  }, [token, roleId]);

  useEffect(() => {
    void load();
  }, [load]);

  const allowed = useCallback(
    (permId: number) => ceilingPermissionIds === undefined || ceilingPermissionIds.has(permId),
    [ceilingPermissionIds],
  );

  const toggle = (permId: number) => {
    if (!canEdit || !allowed(permId)) return;
    setSavedOk(false);
    setGranted((prev) => {
      const next = new Set(prev);
      if (next.has(permId)) next.delete(permId);
      else next.add(permId);
      return next;
    });
  };

  const toggleSectionOpen = (key: string) => {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  /** Toggle every (allowed) permission in an item on/off as a group. */
  const toggleItem = (permIds: number[], turnOn: boolean) => {
    if (!canEdit) return;
    setSavedOk(false);
    setGranted((prev) => {
      const next = new Set(prev);
      for (const id of permIds) {
        if (!allowed(id)) continue;
        if (turnOn) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  };

  const save = async () => {
    if (!token || roleId == null || !canEdit) return;
    setSaving(true);
    setErr(null);
    try {
      await apiSyncRolePermissions(token, roleId, Array.from(granted));
      setSavedOk(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : s.rbTreeErrSave);
    } finally {
      setSaving(false);
    }
  };

  const actionLabel = (action: string): string => {
    const key = ACTION_KEY[action];
    return key ? s[key] : action.replace(/_/g, " ");
  };

  const sectionLabel = (sectionKey: string, fallback: string): string => {
    const key = SECTION_LABEL_KEY[sectionKey];
    return key ? s[key] : fallback;
  };

  const itemLabel = (sectionKey: string, itemKey: string, fallback: string): string => {
    const key = ITEM_LABEL_KEY[`${sectionKey}.${itemKey}`];
    return key ? s[key] : fallback;
  };

  const grantedCount = granted.size;
  const totalCount = useMemo(
    () => sections.reduce((n, s) => n + s.items.reduce((m, it) => m + it.permissions.length, 0), 0),
    [sections],
  );

  if (roleId == null) {
    return (
      <EmptyState
        icon={<Lock className="h-10 w-10" />}
        title={s.rbTreeSelectRole}
        subtitle={s.rbTreeSelectRoleSubtitle}
      />
    );
  }

  return (
    <V2Card>
      <V2CardHeader
        title={s.rbTreeHeader.replace("{role}", roleName ?? s.rbTreeRoleNum.replace("{id}", String(roleId)))}
        subtitle={s.rbTreeGrantedOf.replace("{granted}", String(grantedCount)).replace("{total}", String(totalCount))}
        action={
          canEdit ? (
            <span className="flex items-center gap-3">
              {savedOk ? (
                <span className="inline-flex items-center gap-1 text-[13px]" style={{ color: "var(--admin-success)" }}>
                  <Check className="h-4 w-4" /> {s.rbTreeSaved}
                </span>
              ) : null}
              <V2Button variant="primary" onClick={() => void save()} disabled={saving}>
                {saving ? s.rbTreeSaving : s.rbTreeSavePerms}
              </V2Button>
            </span>
          ) : null
        }
      />
      <V2CardBody>
        {err ? (
          <div className="mb-3 rounded-md border p-3 text-[13px]" style={{ borderColor: "var(--admin-border)", color: "var(--admin-danger)" }}>
            {err}
          </div>
        ) : null}

        {/* Only blank to "Loading…" on the FIRST load (empty tree). On a role
            switch the tree structure is identical — only `granted` differs — so
            keep the existing sections rendered (they update in place when the new
            data arrives). Blanking on every switch collapsed/re-opened every
            section = the "flicker" Arshak saw when clicking Agent/Operator/etc. */}
        {loading && sections.length === 0 ? (
          <p className="text-[13px]" style={{ color: "var(--admin-text-secondary)" }}>{s.loading}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {sections.map((section) => {
              const isOpen = open.has(section.key);
              const sectionPermIds = section.items.flatMap((it) => it.permissions.map((p) => p.id));
              const sectionGranted = sectionPermIds.filter((id) => granted.has(id)).length;
              return (
                <div key={section.key} className="rounded-[8px] border" style={{ borderColor: "var(--admin-border)" }}>
                  <button
                    type="button"
                    onClick={() => toggleSectionOpen(section.key)}
                    className="flex w-full items-center gap-2 px-3.5 py-3 text-left"
                  >
                    {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <span className="text-[13px] font-semibold" style={{ color: "var(--admin-text-primary)" }}>
                      {sectionLabel(section.key, section.label)}
                    </span>
                    <span
                      className="ml-auto rounded-full px-[7px] py-px text-[11px] font-semibold"
                      style={{
                        backgroundColor: sectionGranted > 0 ? "var(--admin-primary-soft)" : "var(--admin-bg-tertiary)",
                        color: sectionGranted > 0 ? "var(--admin-primary)" : "var(--admin-text-secondary)",
                      }}
                    >
                      {sectionGranted}/{sectionPermIds.length}
                    </span>
                  </button>

                  {isOpen ? (
                    <div className="border-t" style={{ borderColor: "var(--admin-border)" }}>
                      {section.items.map((item) => {
                        const itemIds = item.permissions.map((p) => p.id);
                        const allOn = itemIds.every((id) => granted.has(id));
                        return (
                          <div key={item.key} className="border-b px-3.5 py-2.5 last:border-b-0" style={{ borderColor: "var(--admin-border)" }}>
                            <div className="mb-1.5 flex items-center gap-2">
                              <span className="text-[12px] font-medium" style={{ color: "var(--admin-text-primary)" }}>
                                {itemLabel(section.key, item.key, item.label)}
                              </span>
                              {canEdit ? (
                                <button
                                  type="button"
                                  onClick={() => toggleItem(itemIds, !allOn)}
                                  className="ml-auto text-[11px] font-medium"
                                  style={{ color: "var(--admin-primary)" }}
                                >
                                  {allOn ? s.rbTreeClearAll : s.rbTreeSelectAll}
                                </button>
                              ) : null}
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {item.permissions.map((p) => {
                                const checked = granted.has(p.id);
                                const capped = !allowed(p.id);
                                return (
                                  <label
                                    key={p.id}
                                    title={capped ? s.rbTreeCeiling : p.name}
                                    className="inline-flex items-center gap-1.5 rounded-[6px] border px-2 py-1 text-[12px]"
                                    style={{
                                      cursor: capped || !canEdit ? "not-allowed" : "pointer",
                                      opacity: capped ? 0.45 : 1,
                                      borderColor: checked ? "var(--admin-primary)" : "var(--admin-border)",
                                      backgroundColor: checked ? "var(--admin-primary-soft)" : "transparent",
                                      color: checked ? "var(--admin-primary)" : "var(--admin-text-secondary)",
                                    }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      disabled={capped || !canEdit}
                                      onChange={() => toggle(p.id)}
                                      className="h-3.5 w-3.5"
                                    />
                                    {actionLabel(p.action)}
                                    {capped ? <Lock className="h-3 w-3" /> : null}
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </V2CardBody>
    </V2Card>
  );
}
