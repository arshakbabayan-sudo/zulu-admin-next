"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { isSuperAdminRole } from "@/lib/access";
import {
  apiPricingRuleCreate,
  apiPricingRuleDelete,
  apiPricingRuleTest,
  apiPricingRuleUpdate,
  apiPricingRulesList,
  type PricingRuleCreate,
  type PricingRuleRow,
  type PricingRuleScope,
  type PricingRuleMarkupType,
  type PricingRuleServiceCategory,
  type PricingRuleTestResult,
} from "@/lib/pricing-rules-api";
import {
  Badge,
  Button,
  ConfirmDialog,
  Drawer,
  DrawerSection,
  FormField,
  Input,
  Select,
  Switch,
  Table,
  TBody,
  TD,
  TEmpty,
  TH,
  THead,
  TR,
} from "@/components/ui";
import {
  PageHeader as V2PageHeader,
  SectionTabs,
  FilterCard,
  FilterField,
  V2Card,
  V2Button,
  IconButton,
} from "@/components/ui/v2";
import { Trash2 } from "lucide-react";

/**
 * Phase 1 / Step D.3 — pricing rules admin CRUD UI.
 *
 * Replaces the Phase 0 placeholder. Super-admin only — operator
 * read-only view is a Phase 2 follow-up.
 *
 * List + create/edit drawer + delete confirm. The Test panel (D.4)
 * ships as a sibling component.
 */

type FormState = {
  scope_type: PricingRuleScope;
  operator_id: string;
  agent_id: string;
  service_category: PricingRuleServiceCategory | "";
  destination_id: string;
  markup_type: PricingRuleMarkupType;
  markup_value: string;
  min_sell_amount: string;
  max_sell_amount: string;
  currency: string;
  effective_from: string;
  effective_until: string;
  priority: string;
  is_active: boolean;
  reason: string;
};

const blankForm: FormState = {
  scope_type: "global",
  operator_id: "",
  agent_id: "",
  service_category: "",
  destination_id: "",
  markup_type: "percentage",
  markup_value: "15",
  min_sell_amount: "",
  max_sell_amount: "",
  currency: "USD",
  effective_from: new Date().toISOString().slice(0, 16),
  effective_until: "",
  priority: "100",
  is_active: true,
  reason: "",
};

const SCOPE_OPTIONS: { value: PricingRuleScope; label: string }[] = [
  { value: "global", label: "Global (platform-wide)" },
  { value: "category", label: "Category (per service type)" },
  { value: "operator", label: "Operator (one company)" },
  { value: "partnership", label: "Partnership (operator + agent)" },
];

const CATEGORY_OPTIONS: { value: PricingRuleServiceCategory | ""; label: string }[] = [
  { value: "", label: "—" },
  { value: "hotel", label: "Hotel" },
  { value: "flight", label: "Flight" },
  { value: "transfer", label: "Transfer" },
  { value: "car", label: "Car" },
  { value: "excursion", label: "Excursion" },
  { value: "package", label: "Package" },
  { value: "visa", label: "Visa" },
];

const CURRENCY_OPTIONS = ["USD", "EUR", "AMD", "RUB", "GBP"];

export default function PricingRulesPage() {
  const { token, user } = useAdminAuth();
  const { t } = useLanguage();

  const tr = (key: string, fallback: string): string => {
    const v = t(key);
    return v === key ? fallback : v;
  };

  const isSuper = isSuperAdminRole(user);

  const [rows, setRows] = useState<PricingRuleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterScope, setFilterScope] = useState<PricingRuleScope | "">("");
  const [filterCurrency, setFilterCurrency] = useState("");
  const [filterActive, setFilterActive] = useState<"" | "true" | "false">("");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<PricingRuleRow | null>(null);
  const [form, setForm] = useState<FormState>(blankForm);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [pendingDelete, setPendingDelete] = useState<PricingRuleRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  // D.4 — Test panel state
  const [testPanelOpen, setTestPanelOpen] = useState(false);
  const [testOfferId, setTestOfferId] = useState("");
  const [testQuantity, setTestQuantity] = useState("1");
  const [testAgentId, setTestAgentId] = useState("");
  const [testDestinationId, setTestDestinationId] = useState("");
  const [testPriceOverride, setTestPriceOverride] = useState("");
  const [testResult, setTestResult] = useState<PricingRuleTestResult | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);

  const fetchRows = useCallback(async () => {
    if (!token || !isSuper) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiPricingRulesList(token, {
        scope_type: filterScope || undefined,
        currency: filterCurrency || undefined,
        is_active: filterActive === "" ? undefined : filterActive === "true",
        per_page: 100,
      });
      setRows(res.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load rules");
    } finally {
      setLoading(false);
    }
  }, [token, isSuper, filterScope, filterCurrency, filterActive]);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  const openCreate = () => {
    setEditingRule(null);
    setForm(blankForm);
    setSaveError(null);
    setDrawerOpen(true);
  };

  const openEdit = (rule: PricingRuleRow) => {
    setEditingRule(rule);
    setForm({
      scope_type: rule.scope_type,
      operator_id: rule.operator_id?.toString() ?? "",
      agent_id: rule.agent_id?.toString() ?? "",
      service_category: rule.service_category ?? "",
      destination_id: rule.destination_id?.toString() ?? "",
      markup_type: rule.markup_type,
      markup_value: rule.markup_value.toString(),
      min_sell_amount: rule.min_sell_amount?.toString() ?? "",
      max_sell_amount: rule.max_sell_amount?.toString() ?? "",
      currency: rule.currency,
      effective_from: rule.effective_from.slice(0, 16),
      effective_until: rule.effective_until?.slice(0, 16) ?? "",
      priority: rule.priority.toString(),
      is_active: rule.is_active,
      reason: "",
    });
    setSaveError(null);
    setDrawerOpen(true);
  };

  const submit = async () => {
    if (!token) return;
    setSaving(true);
    setSaveError(null);

    const payload: PricingRuleCreate = {
      scope_type: form.scope_type,
      markup_type: form.markup_type,
      markup_value: Number(form.markup_value),
      currency: form.currency.toUpperCase(),
      effective_from: new Date(form.effective_from).toISOString(),
      priority: form.priority ? Number(form.priority) : 100,
      is_active: form.is_active,
    };
    if (form.operator_id) payload.operator_id = Number(form.operator_id);
    if (form.agent_id) payload.agent_id = Number(form.agent_id);
    if (form.service_category) payload.service_category = form.service_category;
    if (form.destination_id) payload.destination_id = Number(form.destination_id);
    if (form.min_sell_amount) payload.min_sell_amount = Number(form.min_sell_amount);
    if (form.max_sell_amount) payload.max_sell_amount = Number(form.max_sell_amount);
    if (form.effective_until) payload.effective_until = new Date(form.effective_until).toISOString();
    if (form.reason.trim()) payload.reason = form.reason.trim();

    try {
      if (editingRule) {
        await apiPricingRuleUpdate(token, editingRule.id, payload);
      } else {
        await apiPricingRuleCreate(token, payload);
      }
      setDrawerOpen(false);
      void fetchRows();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const runTest = async () => {
    if (!token || !testOfferId) {
      setTestError("Offer id is required");
      return;
    }
    setTestLoading(true);
    setTestError(null);
    setTestResult(null);
    try {
      const res = await apiPricingRuleTest(token, {
        offer_id: Number(testOfferId),
        quantity: testQuantity ? Number(testQuantity) : 1,
        agent_id: testAgentId ? Number(testAgentId) : undefined,
        destination_id: testDestinationId ? Number(testDestinationId) : undefined,
        price_override: testPriceOverride ? Number(testPriceOverride) : undefined,
      });
      setTestResult(res.data);
    } catch (e) {
      setTestError(e instanceof Error ? e.message : "Test failed");
    } finally {
      setTestLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!token || !pendingDelete) return;
    setDeleting(true);
    try {
      await apiPricingRuleDelete(token, pendingDelete.id, "Deleted via admin UI");
      setPendingDelete(null);
      void fetchRows();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  const formatRule = (rule: PricingRuleRow): string => {
    const parts: string[] = [];
    if (rule.scope_type === "global") parts.push("All offers");
    if (rule.scope_type === "category") parts.push(`Category: ${rule.service_category ?? "—"}`);
    if (rule.scope_type === "operator")
      parts.push(`Operator: ${rule.operator_name ?? `#${rule.operator_id}`}`);
    if (rule.scope_type === "partnership")
      parts.push(
        `Partnership: ${rule.operator_name ?? `#${rule.operator_id}`} → ${rule.agent_name ?? `#${rule.agent_id}`}`
      );
    if (rule.service_category && rule.scope_type !== "category")
      parts.push(`(category: ${rule.service_category})`);
    return parts.join(" ");
  };

  // Phase Զ.15 — Item 9. Non-super (operator_admin / platform_admin) gets
  // a read-only view: list + filter + Test panel work, but Create / Edit /
  // Delete are hidden. Backend mirrors this — index() open, store/update/
  // destroy stay super-only via Form Request authorize().

  return (
    <div>
      {/* v2 admin-redesign — Settings → Pricing rules page chrome.
          Matches docs/zulu-admin-v2.html page-view#settings (lines 1124-1160). */}
      <V2PageHeader
        breadcrumb={[
          { label: "Home", href: "/dashboard" },
          { label: "Settings", href: "/settings/pricing-rules" },
          { label: tr("admin.settings.pricing_rules.title", "Pricing rules") },
        ]}
        title={tr("admin.settings.pricing_rules.title", "Pricing rules")}
        subtitle={tr(
          "admin.settings.pricing_rules.subtitle",
          "Unified Markup + Commission rules table"
        )}
        actions={
          <>
            <V2Button onClick={() => setTestPanelOpen(true)}>
              🧪 {tr("admin.settings.pricing_rules.test_panel", "Test a rule")}
            </V2Button>
            {isSuper && (
              <V2Button onClick={openCreate} variant="primary">
                + {tr("admin.settings.pricing_rules.new", "New rule")}
              </V2Button>
            )}
          </>
        }
      />

      <SectionTabs
        activeHref="/settings/pricing-rules"
        items={[
          { href: "/settings/pricing-rules", label: "Pricing rules" },
          { href: "/settings/money-flow", label: "Money flow" },
          { href: "/localization/languages", label: "Languages" },
          { href: "/localization/templates", label: "Email templates" },
          { href: "/platform/banners", label: "Banners" },
          { href: "/pages", label: "CMS pages" },
          { href: "/platform/notifications", label: "System notifications" },
          { href: "/platform/newsletter", label: "Newsletter" },
          { href: "/platform/loyalty", label: "Loyalty" },
          { href: "/bucket3/block-dates", label: "Block dates" },
          { href: "/bucket3/custom-fields", label: "Custom fields" },
          { href: "/platform/security", label: "Security" },
          { href: "/platform/webhooks", label: "Webhooks" },
          { href: "/platform/locations", label: "Locations" },
          { href: "/platform/settings/brand", label: "Brand" },
          { href: "/connections", label: "Connections" },
          { href: "/support/tickets", label: "Support" },
          { href: "/platform/reviews", label: "Reviews" },
        ]}
      />

      <FilterCard>
        <FilterField label="Scope">
          <Select
            id="filter-scope"
            value={filterScope}
            onChange={(e) => setFilterScope(e.target.value as PricingRuleScope | "")}
            className="!h-[34px]"
          >
            <option value="">All</option>
            {SCOPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="Currency">
          <Select
            id="filter-currency"
            value={filterCurrency}
            onChange={(e) => setFilterCurrency(e.target.value)}
            className="!h-[34px]"
          >
            <option value="">All</option>
            {CURRENCY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="Status">
          <Select
            id="filter-active"
            value={filterActive}
            onChange={(e) => setFilterActive(e.target.value as "" | "true" | "false")}
            className="!h-[34px]"
          >
            <option value="">All</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </Select>
        </FilterField>
      </FilterCard>

      {error && (
        <div className="mb-4 rounded-md border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">
          {error}
        </div>
      )}

      {/* Rules table — wrapped in v2 card for rounded chrome */}
      <V2Card>
        <Table>
          <THead>
            <TR>
              <TH>Scope</TH>
              <TH>Markup</TH>
              <TH>Bounds</TH>
              <TH>Currency</TH>
              <TH>Priority</TH>
              <TH>Status</TH>
              <TH>Effective</TH>
              <TH className="text-right">Actions</TH>
            </TR>
          </THead>
          <TBody>
            {loading ? (
              <TEmpty colSpan={8}>{tr("common.loading", "Loading…")}</TEmpty>
            ) : rows.length === 0 ? (
              <TEmpty colSpan={8}>
                {tr(
                  "admin.settings.pricing_rules.empty",
                  "No pricing rules yet. Click + New rule to create your first one."
                )}
              </TEmpty>
            ) : (
              rows.map((rule) => (
                <TR
                  key={rule.id}
                  className={isSuper ? "cursor-pointer" : undefined}
                  onClick={isSuper ? () => openEdit(rule) : undefined}
                >
                  <TD className="font-medium">{formatRule(rule)}</TD>
                  <TD>
                    {rule.markup_type === "percentage"
                      ? `+${rule.markup_value}%`
                      : `+${rule.markup_value} ${rule.currency}`}
                  </TD>
                  <TD className="text-xs text-fg-t6">
                    {rule.min_sell_amount !== null ? `min ${rule.min_sell_amount}` : ""}
                    {rule.min_sell_amount !== null && rule.max_sell_amount !== null ? " · " : ""}
                    {rule.max_sell_amount !== null ? `max ${rule.max_sell_amount}` : ""}
                    {rule.min_sell_amount === null && rule.max_sell_amount === null ? "—" : ""}
                  </TD>
                  <TD>{rule.currency}</TD>
                  <TD>{rule.priority}</TD>
                  <TD>
                    <Badge tone={rule.is_active ? "success" : "gray"}>
                      {rule.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TD>
                  <TD className="text-xs text-fg-t6">
                    {new Date(rule.effective_from).toLocaleDateString()}
                    {rule.effective_until
                      ? ` → ${new Date(rule.effective_until).toLocaleDateString()}`
                      : ""}
                  </TD>
                  <TD className="text-right">
                    <div className="flex justify-end gap-1">
                      {isSuper ? (
                        <IconButton
                          onClick={(e) => {
                            e.stopPropagation();
                            setPendingDelete(rule);
                          }}
                          aria-label="Delete"
                        >
                          <Trash2 />
                        </IconButton>
                      ) : (
                        <span className="text-[11px] text-fg-t6">Read-only</span>
                      )}
                    </div>
                  </TD>
                </TR>
              ))
            )}
          </TBody>
        </Table>
      </V2Card>

      {/* Create/Edit drawer */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editingRule ? "Edit pricing rule" : "New pricing rule"}
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDrawerOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={saving} variant="primary">
              {saving ? "Saving…" : editingRule ? "Save changes" : "Create rule"}
            </Button>
          </div>
        }
      >
        <DrawerSection title="Scope">
          <FormField label="Scope type" htmlFor="form-scope">
            <Select
              id="form-scope"
              value={form.scope_type}
              onChange={(e) =>
                setForm({ ...form, scope_type: e.target.value as PricingRuleScope })
              }
            >
              {SCOPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </FormField>

          {(form.scope_type === "operator" || form.scope_type === "partnership") && (
            <FormField
              label="Operator company ID"
              htmlFor="form-operator"
              required
              helperText="Numeric company id (from Marketplace ops → Companies)"
            >
              <Input
                id="form-operator"
                type="number"
                value={form.operator_id}
                onChange={(e) => setForm({ ...form, operator_id: e.target.value })}
                required
              />
            </FormField>
          )}

          {form.scope_type === "partnership" && (
            <FormField label="Agent company ID" htmlFor="form-agent" required>
              <Input
                id="form-agent"
                type="number"
                value={form.agent_id}
                onChange={(e) => setForm({ ...form, agent_id: e.target.value })}
                required
              />
            </FormField>
          )}

          <FormField
            label="Service category (optional filter)"
            htmlFor="form-category"
            required={form.scope_type === "category"}
          >
            <Select
              id="form-category"
              value={form.service_category}
              onChange={(e) =>
                setForm({
                  ...form,
                  service_category: e.target.value as PricingRuleServiceCategory | "",
                })
              }
            >
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c.value || "any"} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField
            label="Destination id (optional)"
            htmlFor="form-destination"
            helperText="Hierarchical — France id matches Paris offers automatically"
          >
            <Input
              id="form-destination"
              type="number"
              value={form.destination_id}
              onChange={(e) => setForm({ ...form, destination_id: e.target.value })}
            />
          </FormField>
        </DrawerSection>

        <DrawerSection title="Markup">
          <FormField label="Markup type" htmlFor="form-markup-type">
            <Select
              id="form-markup-type"
              value={form.markup_type}
              onChange={(e) =>
                setForm({ ...form, markup_type: e.target.value as PricingRuleMarkupType })
              }
            >
              <option value="percentage">Percentage (e.g. 15 → +15%)</option>
              <option value="fixed">Fixed amount (e.g. 25 → +25 in currency)</option>
            </Select>
          </FormField>

          <FormField label="Markup value" htmlFor="form-markup-value" required>
            <Input
              id="form-markup-value"
              type="number"
              step="0.0001"
              value={form.markup_value}
              onChange={(e) => setForm({ ...form, markup_value: e.target.value })}
              required
            />
          </FormField>

          <FormField label="Currency" htmlFor="form-currency" required>
            <Select
              id="form-currency"
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value })}
            >
              {CURRENCY_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Min sell amount" htmlFor="form-min">
              <Input
                id="form-min"
                type="number"
                step="0.0001"
                value={form.min_sell_amount}
                onChange={(e) => setForm({ ...form, min_sell_amount: e.target.value })}
              />
            </FormField>
            <FormField label="Max sell amount" htmlFor="form-max">
              <Input
                id="form-max"
                type="number"
                step="0.0001"
                value={form.max_sell_amount}
                onChange={(e) => setForm({ ...form, max_sell_amount: e.target.value })}
              />
            </FormField>
          </div>
        </DrawerSection>

        <DrawerSection title="Schedule">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Effective from" htmlFor="form-from" required>
              <Input
                id="form-from"
                type="datetime-local"
                value={form.effective_from}
                onChange={(e) => setForm({ ...form, effective_from: e.target.value })}
                required
              />
            </FormField>
            <FormField label="Effective until (optional)" htmlFor="form-until">
              <Input
                id="form-until"
                type="datetime-local"
                value={form.effective_until}
                onChange={(e) => setForm({ ...form, effective_until: e.target.value })}
              />
            </FormField>
          </div>
          <FormField
            label="Priority (higher wins within same scope)"
            htmlFor="form-priority"
            helperText="Default 100. Range 0–1000."
          >
            <Input
              id="form-priority"
              type="number"
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
            />
          </FormField>
          <div className="flex items-center gap-3">
            <Switch
              id="form-active"
              checked={form.is_active}
              onCheckedChange={(checked: boolean) => setForm({ ...form, is_active: checked })}
            />
            <label htmlFor="form-active" className="text-sm">
              Active
            </label>
          </div>
        </DrawerSection>

        <DrawerSection title="Audit note (optional)">
          <FormField label="Reason for change" htmlFor="form-reason">
            <Input
              id="form-reason"
              type="text"
              maxLength={500}
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="e.g. EOY promo, partner agreement signed, etc."
            />
          </FormField>
        </DrawerSection>

        {saveError && (
          <div className="rounded-zulu border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">
            {saveError}
          </div>
        )}
      </Drawer>

      {/* D.4 — Test panel: dry-run a hypothetical booking against the resolver */}
      <Drawer
        open={testPanelOpen}
        onClose={() => setTestPanelOpen(false)}
        title="Test a pricing rule"
        subtitle="Pick an offer; see which rule the resolver picks and the prices it produces"
        size="md"
        footer={
          <div className="flex justify-between gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setTestOfferId("");
                setTestQuantity("1");
                setTestAgentId("");
                setTestDestinationId("");
                setTestPriceOverride("");
                setTestResult(null);
                setTestError(null);
              }}
            >
              Reset
            </Button>
            <Button onClick={runTest} disabled={testLoading || !testOfferId} variant="primary">
              {testLoading ? "Resolving…" : "Run test"}
            </Button>
          </div>
        }
      >
        <DrawerSection title="Inputs">
          <FormField label="Offer ID" htmlFor="test-offer" required>
            <Input
              id="test-offer"
              type="number"
              value={testOfferId}
              onChange={(e) => setTestOfferId(e.target.value)}
              placeholder="e.g. 12 (the Atlantis The Palm hotel offer)"
              required
            />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Quantity" htmlFor="test-qty">
              <Input
                id="test-qty"
                type="number"
                min="1"
                value={testQuantity}
                onChange={(e) => setTestQuantity(e.target.value)}
              />
            </FormField>
            <FormField label="Agent company id (optional)" htmlFor="test-agent">
              <Input
                id="test-agent"
                type="number"
                value={testAgentId}
                onChange={(e) => setTestAgentId(e.target.value)}
                placeholder="for partnership rules"
              />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Destination id (optional)" htmlFor="test-dest">
              <Input
                id="test-dest"
                type="number"
                value={testDestinationId}
                onChange={(e) => setTestDestinationId(e.target.value)}
              />
            </FormField>
            <FormField label="Price override (optional)" htmlFor="test-override">
              <Input
                id="test-override"
                type="number"
                step="0.01"
                value={testPriceOverride}
                onChange={(e) => setTestPriceOverride(e.target.value)}
                placeholder="replaces supplier net"
              />
            </FormField>
          </div>
        </DrawerSection>

        {testError && (
          <div className="rounded-zulu border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">
            {testError}
          </div>
        )}

        {testResult && (
          <DrawerSection title="Resolver output">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between border-b border-default pb-2">
                <span className="text-fg-t6">Supplier net</span>
                <span className="font-mono font-medium">
                  {testResult.supplier_net.toFixed(2)} {testResult.currency}
                </span>
              </div>
              <div className="flex justify-between border-b border-default pb-2">
                <span className="text-fg-t6">Customer pays (per unit)</span>
                <span className="font-mono font-medium" style={{ color: "var(--admin-primary)" }}>
                  {testResult.customer_price.toFixed(2)} {testResult.currency}
                </span>
              </div>
              <div className="flex justify-between border-b border-default pb-2">
                <span className="text-fg-t6">Line total ({testResult.quantity} × unit)</span>
                <span className="font-mono font-bold text-lg">
                  {testResult.line_total.toFixed(2)} {testResult.currency}
                </span>
              </div>
              <div className="flex justify-between border-b border-default pb-2">
                <span className="text-fg-t6">Rule applied</span>
                <span className="font-mono text-xs">
                  {testResult.rule_id_applied ?? (
                    <Badge tone="warning">Fallback (no rule matched)</Badge>
                  )}
                </span>
              </div>
            </div>

            <details className="mt-3 rounded-zulu border border-default p-3">
              <summary className="cursor-pointer text-xs font-semibold text-fg-t7">
                Resolver snapshot (raw JSON)
              </summary>
              <pre className="mt-2 overflow-x-auto text-[10px] font-mono text-fg-t6">
                {JSON.stringify(testResult.snapshot, null, 2)}
              </pre>
            </details>
          </DrawerSection>
        )}
      </Drawer>

      <ConfirmDialog
        isOpen={pendingDelete !== null}
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        busy={deleting}
        title="Delete pricing rule?"
        message={
          pendingDelete
            ? `Soft-delete this ${pendingDelete.scope_type} rule? You can restore later via the database. Audit log will record the deletion with your user id.`
            : ""
        }
        variant="danger"
      />
    </div>
  );
}
