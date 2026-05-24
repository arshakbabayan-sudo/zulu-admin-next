"use client";

/**
 * Phase Զ.15 / Item 16-17 — admin UI for manual FX rate overrides.
 *
 * Resolves the audit's "Phase 2 deferred" item — was SQL/tinker only,
 * now a proper /settings/exchange-rates page.
 *
 * - Read: any platform admin (operator+).
 * - Write (create / deactivate / reactivate): super-admin only.
 * - Lists all sources (cba/ecb/exchangerate_api/manual/partner_override),
 *   marks the active row per pair with a "Live" pill.
 *
 * Manual rates take precedence over CBA/ECB (per ExchangeRate model's
 * SOURCE_PRECEDENCE constant) so admins can pin a number for a
 * specific pair if the provider is broken.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { isSuperAdminRole } from "@/lib/access";
import {
  apiExchangeRatesList,
  apiExchangeRateCreate,
  apiExchangeRateUpdate,
  apiExchangeRateDeactivate,
  type ExchangeRateRow,
  type FxRateSource,
} from "@/lib/exchange-rates-api";
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
import { Plus, Power, Trash2 } from "lucide-react";
import { PinPromptDialog } from "@/components/PinPromptDialog";

const SOURCE_OPTIONS: { value: FxRateSource | ""; label: string }[] = [
  { value: "", label: "All" },
  { value: "manual", label: "Manual override" },
  { value: "partner_override", label: "Partner override" },
  { value: "cba", label: "CBA (Armenia)" },
  { value: "ecb", label: "ECB (Europe)" },
  { value: "exchangerate_api", label: "exchangerate-api" },
];

const CURRENCY_OPTIONS = ["USD", "EUR", "AMD", "RUB", "GBP"];

type FormState = {
  source_currency: string;
  target_currency: string;
  rate: string;
  is_active: boolean;
};

const BLANK_FORM: FormState = {
  source_currency: "USD",
  target_currency: "AMD",
  rate: "",
  is_active: true,
};

export default function ExchangeRatesPage() {
  const { token, user } = useAdminAuth();
  const { t } = useLanguage();
  const tr = (k: string, fallback: string): string => {
    const v = t(k);
    return v === k ? fallback : v;
  };

  const isSuper = isSuperAdminRole(user);

  const [rows, setRows] = useState<ExchangeRateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterSource, setFilterSource] = useState<FxRateSource | "">("");
  const [filterPair, setFilterPair] = useState<string>("");
  const [filterActive, setFilterActive] = useState<"" | "true" | "false">("");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState<FormState>(BLANK_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [pendingDeactivate, setPendingDeactivate] = useState<ExchangeRateRow | null>(null);
  const [deactivating, setDeactivating] = useState(false);
  // Phase Զ.15 / Item 15 — PIN gate state. Deactivation is destructive in
  // production (pricing resolver falls back to next-precedence rate) so we
  // gate it behind a PIN before the API call fires.
  const [pinGate, setPinGate] = useState<{
    title: string;
    description: React.ReactNode;
    onConfirm: () => Promise<void>;
  } | null>(null);

  const fetchRows = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiExchangeRatesList(token, {
        source: filterSource || undefined,
        pair: filterPair || undefined,
        is_active: filterActive === "" ? undefined : filterActive === "true",
        per_page: 100,
      });
      setRows(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load exchange rates");
    } finally {
      setLoading(false);
    }
  }, [token, filterSource, filterPair, filterActive]);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  const openCreate = () => {
    setForm(BLANK_FORM);
    setSaveError(null);
    setDrawerOpen(true);
  };

  const submit = async () => {
    if (!token) return;
    const numericRate = Number(form.rate);
    if (Number.isNaN(numericRate) || numericRate <= 0) {
      setSaveError("Rate must be a positive number");
      return;
    }
    if (form.source_currency === form.target_currency) {
      setSaveError("Source and target currencies must differ");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await apiExchangeRateCreate(token, {
        source_currency: form.source_currency,
        target_currency: form.target_currency,
        rate: numericRate,
        is_active: form.is_active,
      });
      setDrawerOpen(false);
      void fetchRows();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to save rate");
    } finally {
      setSaving(false);
    }
  };

  // Phase Զ.15 / Item 15 — instead of deactivating immediately, open the PIN
  // gate. Only after the PIN verifies does the actual deactivate call fire.
  const confirmDeactivate = async () => {
    if (!token || !pendingDeactivate) return;
    const target = pendingDeactivate;
    setPendingDeactivate(null);
    setPinGate({
      title: "Verify PIN to deactivate rate",
      description: (
        <>
          Enter your account PIN to deactivate the manual rate{" "}
          <strong>
            {target.source_currency} → {target.target_currency} = {target.rate}
          </strong>
          .
        </>
      ),
      onConfirm: async () => {
        setDeactivating(true);
        try {
          await apiExchangeRateDeactivate(token, target.id);
          setPinGate(null);
          void fetchRows();
        } catch (e) {
          setError(e instanceof Error ? e.message : "Failed to deactivate rate");
          setPinGate(null);
        } finally {
          setDeactivating(false);
        }
      },
    });
  };

  const toggleActive = async (rate: ExchangeRateRow) => {
    if (!token || !isSuper) return;
    try {
      await apiExchangeRateUpdate(token, rate.id, { is_active: !rate.is_active });
      void fetchRows();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to toggle rate");
    }
  };

  // Group rows so the "winning" rate per pair (active + highest precedence)
  // is highlighted. Simple visual cue — backend resolves precedence itself.
  const activePairKeys = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      if (r.is_active) {
        const key = `${r.source_currency}-${r.target_currency}-${r.source}`;
        set.add(key);
      }
    }
    return set;
  }, [rows]);

  return (
    <div>
      <V2PageHeader
        breadcrumb={[
          { label: "Home", href: "/dashboard" },
          { label: "Settings", href: "/settings/pricing-rules" },
          { label: tr("admin.settings.exchange_rates.title", "Exchange rates") },
        ]}
        title={tr("admin.settings.exchange_rates.title", "Exchange rates")}
        subtitle={tr(
          "admin.settings.exchange_rates.subtitle",
          "Manual overrides + provider history. Manual rates take precedence over CBA / ECB."
        )}
        actions={
          isSuper ? (
            <V2Button onClick={openCreate} variant="primary" icon={<Plus className="h-4 w-4" />}>
              {tr("admin.settings.exchange_rates.new", "New manual rate")}
            </V2Button>
          ) : undefined
        }
      />

      <SectionTabs
        activeHref="/settings/exchange-rates"
        items={[
          { href: "/settings/pricing-rules", label: "Pricing rules" },
          { href: "/settings/money-flow", label: "Money flow" },
          { href: "/settings/exchange-rates", label: "Exchange rates" },
        ]}
      />

      <FilterCard>
        <FilterField label="Pair (e.g. USD-AMD)" minWidth={200}>
          <Input
            id="filter-pair"
            value={filterPair}
            onChange={(e) => setFilterPair(e.target.value.toUpperCase())}
            placeholder="USD-AMD"
            className="!h-[34px]"
          />
        </FilterField>
        <FilterField label="Source">
          <Select
            id="filter-source"
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value as FxRateSource | "")}
            className="!h-[34px] !min-w-[160px]"
          >
            {SOURCE_OPTIONS.map((o) => (
              <option key={o.value || "all"} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="Active">
          <Select
            id="filter-active"
            value={filterActive}
            onChange={(e) => setFilterActive(e.target.value as "" | "true" | "false")}
            className="!h-[34px]"
          >
            <option value="">All</option>
            <option value="true">Active only</option>
            <option value="false">Inactive only</option>
          </Select>
        </FilterField>
      </FilterCard>

      {error && (
        <div className="mb-4 rounded-md border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">
          {error}
        </div>
      )}

      <V2Card>
        <Table>
          <THead>
            <TR>
              <TH>Pair</TH>
              <TH>Rate</TH>
              <TH>Source</TH>
              <TH>Fetched</TH>
              <TH>Status</TH>
              <TH align="right">Actions</TH>
            </TR>
          </THead>
          <TBody>
            {loading ? (
              <TEmpty colSpan={6}>{tr("common.loading", "Loading…")}</TEmpty>
            ) : rows.length === 0 ? (
              <TEmpty colSpan={6}>
                No exchange rates yet. {isSuper ? "Add a manual rate to get started." : ""}
              </TEmpty>
            ) : (
              rows.map((r) => {
                const key = `${r.source_currency}-${r.target_currency}-${r.source}`;
                const winning = r.is_active && activePairKeys.has(key);
                return (
                  <TR key={r.id}>
                    <TD>
                      <span className="font-mono text-xs">
                        {r.source_currency} → {r.target_currency}
                      </span>
                    </TD>
                    <TD className="font-mono">{r.rate}</TD>
                    <TD>
                      <span
                        className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.3px]"
                        style={sourceBadgeStyle(r.source)}
                      >
                        {r.source.replace(/_/g, " ")}
                      </span>
                    </TD>
                    <TD className="text-xs text-fg-t6">
                      {r.fetched_at ? new Date(r.fetched_at).toLocaleString() : "—"}
                    </TD>
                    <TD>
                      <Badge tone={r.is_active ? "success" : "gray"}>
                        {r.is_active ? (winning ? "Live" : "Active") : "Inactive"}
                      </Badge>
                    </TD>
                    <TD align="right">
                      <div className="flex justify-end gap-1">
                        {isSuper ? (
                          <>
                            <IconButton
                              onClick={() => void toggleActive(r)}
                              aria-label={r.is_active ? "Deactivate" : "Reactivate"}
                            >
                              <Power />
                            </IconButton>
                            {r.is_active && (
                              <IconButton
                                onClick={() => setPendingDeactivate(r)}
                                aria-label="Deactivate (confirm)"
                              >
                                <Trash2 />
                              </IconButton>
                            )}
                          </>
                        ) : (
                          <span className="text-[11px] text-fg-t6">Read-only</span>
                        )}
                      </div>
                    </TD>
                  </TR>
                );
              })
            )}
          </TBody>
        </Table>
      </V2Card>

      {isSuper && (
        <Drawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          title="New manual rate"
          size="md"
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDrawerOpen(false)}>
                Cancel
              </Button>
              <Button onClick={submit} disabled={saving} variant="primary">
                {saving ? "Saving…" : "Create rate"}
              </Button>
            </div>
          }
        >
          <DrawerSection title="Currency pair">
            <FormField label="Source" htmlFor="form-source">
              <Select
                id="form-source"
                value={form.source_currency}
                onChange={(e) => setForm((p) => ({ ...p, source_currency: e.target.value }))}
              >
                {CURRENCY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Target" htmlFor="form-target">
              <Select
                id="form-target"
                value={form.target_currency}
                onChange={(e) => setForm((p) => ({ ...p, target_currency: e.target.value }))}
              >
                {CURRENCY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </FormField>
          </DrawerSection>

          <DrawerSection title="Rate value">
            <FormField label="1 source unit = ? target units" htmlFor="form-rate">
              <Input
                id="form-rate"
                type="number"
                step="0.000001"
                value={form.rate}
                onChange={(e) => setForm((p) => ({ ...p, rate: e.target.value }))}
                placeholder="e.g. 387.250000 for USD→AMD"
              />
            </FormField>
            <p className="text-xs text-fg-t6">
              The rate is normalized so 1 unit of <span className="font-mono">{form.source_currency}</span>{" "}
              equals <span className="font-mono">{form.rate || "?"}</span>{" "}
              <span className="font-mono">{form.target_currency}</span>.
            </p>
          </DrawerSection>

          <DrawerSection title="Activation">
            <Switch
              checked={form.is_active}
              onCheckedChange={(checked) => setForm((p) => ({ ...p, is_active: checked }))}
              label="Active immediately"
            />
            <p className="text-xs text-fg-t6">
              Manual rates take precedence over CBA / ECB / exchangerate-api. When active, this
              rate will be used by the pricing resolver for the next conversion of this pair.
            </p>
          </DrawerSection>

          {saveError && (
            <div className="mt-4 rounded-md border border-error-100 bg-error-50 px-3 py-2 text-sm text-error-700">
              {saveError}
            </div>
          )}
        </Drawer>
      )}

      <ConfirmDialog
        isOpen={pendingDeactivate !== null}
        title="Deactivate rate?"
        message={
          pendingDeactivate ? (
            <>
              Deactivate the manual rate{" "}
              <span className="font-mono">
                {pendingDeactivate.source_currency} → {pendingDeactivate.target_currency} ={" "}
                {pendingDeactivate.rate}
              </span>
              ? The pricing resolver will fall back to the next-precedence active rate (provider
              rates: CBA / ECB / exchangerate-api).
            </>
          ) : null
        }
        variant="danger"
        busy={deactivating}
        onConfirm={() => void confirmDeactivate()}
        onCancel={() => setPendingDeactivate(null)}
      />

      {/* Phase Զ.15 / Item 15 — PIN gate for rate deactivation. */}
      <PinPromptDialog
        isOpen={pinGate !== null}
        title={pinGate?.title}
        description={pinGate?.description}
        onCancel={() => setPinGate(null)}
        onConfirm={async () => {
          if (pinGate) await pinGate.onConfirm();
        }}
      />
    </div>
  );
}

function sourceBadgeStyle(source: FxRateSource): React.CSSProperties {
  switch (source) {
    case "manual":
    case "partner_override":
      return {
        backgroundColor: "var(--admin-primary-light)",
        color: "var(--admin-primary-dark)",
      };
    case "cba":
      return {
        backgroundColor: "var(--admin-warning-light)",
        color: "var(--admin-warning-dark)",
      };
    case "ecb":
      return {
        backgroundColor: "var(--admin-info-light)",
        color: "var(--admin-info-dark)",
      };
    case "exchangerate_api":
      return {
        backgroundColor: "var(--admin-success-light)",
        color: "var(--admin-success-dark)",
      };
    default:
      return {
        backgroundColor: "var(--admin-bg-tertiary)",
        color: "var(--admin-text-secondary)",
      };
  }
}
