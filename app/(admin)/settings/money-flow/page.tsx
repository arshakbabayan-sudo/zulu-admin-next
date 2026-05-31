"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { isSuperAdminRole } from "@/lib/access";
import {
  apiMoneyFlowTermCreate,
  apiMoneyFlowTermDelete,
  apiMoneyFlowTermUpdate,
  apiMoneyFlowTermsList,
  type CollectionModel,
  type InvoicingPeriod,
  type MoneyFlowScope,
  type MoneyFlowTermCreate,
  type MoneyFlowTermRow,
} from "@/lib/money-flow-terms-api";
import {
  Badge,
  Button,
  ConfirmDialog,
  Drawer,
  DrawerSection,
  FormField,
  Input,
  PageHeader,
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
import { IconButton } from "@/components/ui/v2";
import { SettingsSubgroupTabs } from "@/components/settings/SettingsSubgroupTabs";
import { Trash2 } from "lucide-react";
import { ForbiddenNotice } from "@/components/ForbiddenNotice";

type FormState = {
  scope_type: MoneyFlowScope;
  operator_id: string;
  agent_id: string;
  collection_model: CollectionModel;
  remittance_days: string;
  invoicing_period: InvoicingPeriod | "";
  is_active: boolean;
  effective_from: string;
  effective_until: string;
  reason: string;
};

const blankForm: FormState = {
  scope_type: "global",
  operator_id: "",
  agent_id: "",
  collection_model: "zulu_collects",
  remittance_days: "15",
  invoicing_period: "",
  is_active: true,
  effective_from: new Date().toISOString().slice(0, 16),
  effective_until: "",
  reason: "",
};

const SCOPE_OPTIONS: { value: MoneyFlowScope; label: string }[] = [
  { value: "global", label: "Global (platform-wide default)" },
  { value: "operator", label: "Operator (one company)" },
  { value: "partnership", label: "Partnership (operator + agent)" },
];

const MODEL_OPTIONS: { value: CollectionModel; label: string }[] = [
  { value: "zulu_collects", label: "Zulu collects (Model A)" },
  { value: "operator_collects", label: "Operator collects (Model B)" },
  { value: "agent_collects", label: "Agent collects (Model C)" },
];

export default function MoneyFlowTermsPage() {
  const { token, user } = useAdminAuth();
  const { t } = useLanguage();
  const isSuper = isSuperAdminRole(user);

  const tr = (key: string, fallback: string): string => {
    const v = t(key);
    return v === key ? fallback : v;
  };

  const [rows, setRows] = useState<MoneyFlowTermRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterScope, setFilterScope] = useState<MoneyFlowScope | "">("");
  const [filterModel, setFilterModel] = useState<CollectionModel | "">("");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<MoneyFlowTermRow | null>(null);
  const [form, setForm] = useState<FormState>(blankForm);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [pendingDelete, setPendingDelete] = useState<MoneyFlowTermRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchRows = useCallback(async () => {
    if (!token || !isSuper) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiMoneyFlowTermsList(token, {
        scope_type: filterScope || undefined,
        collection_model: filterModel || undefined,
        per_page: 100,
      });
      setRows(res.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [token, isSuper, filterScope, filterModel]);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  const openCreate = () => {
    setEditing(null);
    setForm(blankForm);
    setSaveError(null);
    setDrawerOpen(true);
  };

  const openEdit = (term: MoneyFlowTermRow) => {
    setEditing(term);
    setForm({
      scope_type: term.scope_type,
      operator_id: term.operator_id?.toString() ?? "",
      agent_id: term.agent_id?.toString() ?? "",
      collection_model: term.collection_model,
      remittance_days: term.remittance_days?.toString() ?? "",
      invoicing_period: term.invoicing_period ?? "",
      is_active: term.is_active,
      effective_from: term.effective_from.slice(0, 16),
      effective_until: term.effective_until?.slice(0, 16) ?? "",
      reason: "",
    });
    setSaveError(null);
    setDrawerOpen(true);
  };

  const submit = async () => {
    if (!token) return;
    setSaving(true);
    setSaveError(null);

    const payload: MoneyFlowTermCreate = {
      scope_type: form.scope_type,
      collection_model: form.collection_model,
      is_active: form.is_active,
      effective_from: new Date(form.effective_from).toISOString(),
    };
    if (form.operator_id) payload.operator_id = Number(form.operator_id);
    if (form.agent_id) payload.agent_id = Number(form.agent_id);
    if (form.collection_model === "zulu_collects" && form.remittance_days) {
      payload.remittance_days = Number(form.remittance_days);
    }
    if (form.collection_model === "operator_collects" && form.invoicing_period) {
      payload.invoicing_period = form.invoicing_period;
    }
    if (form.effective_until) {
      payload.effective_until = new Date(form.effective_until).toISOString();
    }
    if (form.reason.trim()) payload.reason = form.reason.trim();

    try {
      if (editing) {
        await apiMoneyFlowTermUpdate(token, editing.id, payload);
      } else {
        await apiMoneyFlowTermCreate(token, payload);
      }
      setDrawerOpen(false);
      void fetchRows();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!token || !pendingDelete) return;
    setDeleting(true);
    try {
      await apiMoneyFlowTermDelete(token, pendingDelete.id, "Deleted via admin UI");
      setPendingDelete(null);
      void fetchRows();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  const formatTerm = (term: MoneyFlowTermRow): string => {
    if (term.scope_type === "global") return "All agent bookings";
    if (term.scope_type === "operator")
      return `Operator: ${term.operator_name ?? `#${term.operator_id}`}`;
    return `${term.operator_name ?? `#${term.operator_id}`} → ${term.agent_name ?? `#${term.agent_id}`}`;
  };

  const formatModel = (term: MoneyFlowTermRow): string => {
    if (term.collection_model === "zulu_collects")
      return `Zulu collects → operator T+${term.remittance_days}`;
    if (term.collection_model === "operator_collects")
      return `Operator collects → Zulu invoices ${term.invoicing_period}`;
    return "Agent collects → forwards to operator/Zulu";
  };

  if (!isSuper) {
    return (
      <div className="space-y-4">
        <PageHeader
          title={tr("admin.settings.money_flow.title", "Money flow terms")}
          subtitle="Configure how money moves on agent-mediated bookings"
        />
        <ForbiddenNotice />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={tr("admin.settings.money_flow.title", "Money flow terms")}
        subtitle={tr(
          "admin.settings.money_flow.subtitle",
          "Customer bookings always use Zulu collects. These terms apply to agent-mediated bookings only."
        )}
        actions={
          <Button onClick={openCreate} variant="primary">
            + New term
          </Button>
        }
      />

      <SettingsSubgroupTabs activeHref="/settings/money-flow" />

      <div className="flex flex-wrap items-end gap-3">
        <FormField label="Scope" htmlFor="filter-scope">
          <Select
            id="filter-scope"
            value={filterScope}
            onChange={(e) => setFilterScope(e.target.value as MoneyFlowScope | "")}
          >
            <option value="">All</option>
            {SCOPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Collection model" htmlFor="filter-model">
          <Select
            id="filter-model"
            value={filterModel}
            onChange={(e) => setFilterModel(e.target.value as CollectionModel | "")}
          >
            <option value="">All</option>
            {MODEL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      {error && (
        <div className="rounded-zulu border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">
          {error}
        </div>
      )}

      <div className="admin-card overflow-hidden">
        <Table>
          <THead>
            <TR>
              <TH>Scope</TH>
              <TH>Money flow</TH>
              <TH>Status</TH>
              <TH>Effective</TH>
              <TH className="text-right">Actions</TH>
            </TR>
          </THead>
          <TBody>
            {loading ? (
              <TEmpty colSpan={5}>{tr("common.loading", "Loading…")}</TEmpty>
            ) : rows.length === 0 ? (
              <TEmpty colSpan={5}>
                No money-flow terms yet. The default global Model A (T+15) is hard-coded
                until you create one.
              </TEmpty>
            ) : (
              rows.map((term) => (
                <TR key={term.id} className="cursor-pointer" onClick={() => openEdit(term)}>
                  <TD className="font-medium">{formatTerm(term)}</TD>
                  <TD>{formatModel(term)}</TD>
                  <TD>
                    <Badge tone={term.is_active ? "success" : "gray"}>
                      {term.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TD>
                  <TD className="text-xs text-fg-t6">
                    {new Date(term.effective_from).toLocaleDateString()}
                    {term.effective_until
                      ? ` → ${new Date(term.effective_until).toLocaleDateString()}`
                      : ""}
                  </TD>
                  <TD className="text-right">
                    <div className="flex justify-end gap-1">
                      <IconButton
                        onClick={(e) => {
                          e.stopPropagation();
                          setPendingDelete(term);
                        }}
                        aria-label="Delete"
                      >
                        <Trash2 />
                      </IconButton>
                    </div>
                  </TD>
                </TR>
              ))
            )}
          </TBody>
        </Table>
      </div>

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editing ? "Edit money-flow term" : "New money-flow term"}
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDrawerOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={saving} variant="primary">
              {saving ? "Saving…" : editing ? "Save changes" : "Create term"}
            </Button>
          </div>
        }
      >
        <DrawerSection title="Scope">
          <FormField label="Scope type" htmlFor="mf-scope">
            <Select
              id="mf-scope"
              value={form.scope_type}
              onChange={(e) => setForm({ ...form, scope_type: e.target.value as MoneyFlowScope })}
            >
              {SCOPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </FormField>

          {(form.scope_type === "operator" || form.scope_type === "partnership") && (
            <FormField label="Operator company ID" htmlFor="mf-operator" required>
              <Input
                id="mf-operator"
                type="number"
                value={form.operator_id}
                onChange={(e) => setForm({ ...form, operator_id: e.target.value })}
                required
              />
            </FormField>
          )}

          {form.scope_type === "partnership" && (
            <FormField label="Agent company ID" htmlFor="mf-agent" required>
              <Input
                id="mf-agent"
                type="number"
                value={form.agent_id}
                onChange={(e) => setForm({ ...form, agent_id: e.target.value })}
                required
              />
            </FormField>
          )}
        </DrawerSection>

        <DrawerSection title="Collection model">
          <FormField label="Model" htmlFor="mf-model">
            <Select
              id="mf-model"
              value={form.collection_model}
              onChange={(e) =>
                setForm({ ...form, collection_model: e.target.value as CollectionModel })
              }
            >
              {MODEL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </FormField>

          {form.collection_model === "zulu_collects" && (
            <FormField
              label="Remittance days (T+N)"
              htmlFor="mf-remit"
              required
              helperText="Days after booking before Zulu transfers the operator their share"
            >
              <Input
                id="mf-remit"
                type="number"
                min="0"
                max="365"
                value={form.remittance_days}
                onChange={(e) => setForm({ ...form, remittance_days: e.target.value })}
                required
              />
            </FormField>
          )}

          {form.collection_model === "operator_collects" && (
            <FormField
              label="Invoicing period"
              htmlFor="mf-invoice"
              required
              helperText="How often Zulu invoices the operator for the platform fee"
            >
              <Select
                id="mf-invoice"
                value={form.invoicing_period}
                onChange={(e) =>
                  setForm({ ...form, invoicing_period: e.target.value as InvoicingPeriod | "" })
                }
                required
              >
                <option value="">—</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </Select>
            </FormField>
          )}

          {form.collection_model === "agent_collects" && (
            <p className="text-xs text-fg-t6">
              Agent receives full payment from customer and forwards net+markup. No
              remittance window or invoicing period needed.
            </p>
          )}
        </DrawerSection>

        <DrawerSection title="Schedule">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Effective from" htmlFor="mf-from" required>
              <Input
                id="mf-from"
                type="datetime-local"
                value={form.effective_from}
                onChange={(e) => setForm({ ...form, effective_from: e.target.value })}
                required
              />
            </FormField>
            <FormField label="Effective until (optional)" htmlFor="mf-until">
              <Input
                id="mf-until"
                type="datetime-local"
                value={form.effective_until}
                onChange={(e) => setForm({ ...form, effective_until: e.target.value })}
              />
            </FormField>
          </div>
          <div className="flex items-center gap-3">
            <Switch
              id="mf-active"
              checked={form.is_active}
              onCheckedChange={(checked: boolean) => setForm({ ...form, is_active: checked })}
            />
            <label htmlFor="mf-active" className="text-sm">
              Active
            </label>
          </div>
        </DrawerSection>

        <DrawerSection title="Audit note (optional)">
          <FormField label="Reason for change" htmlFor="mf-reason">
            <Input
              id="mf-reason"
              type="text"
              maxLength={500}
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="e.g. Letour partnership signed, switched to Model B"
            />
          </FormField>
        </DrawerSection>

        {saveError && (
          <div className="rounded-zulu border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">
            {saveError}
          </div>
        )}
      </Drawer>

      <ConfirmDialog
        isOpen={pendingDelete !== null}
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        busy={deleting}
        title="Delete money-flow term?"
        message={
          pendingDelete
            ? `Hard-delete this ${pendingDelete.scope_type} term? Existing bookings keep their locked money-flow snapshot — only future bookings are affected. Audit log records the deletion with your user id.`
            : ""
        }
        variant="danger"
      />
    </div>
  );
}
