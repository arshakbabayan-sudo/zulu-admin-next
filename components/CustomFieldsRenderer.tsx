"use client";

/**
 * Phase Զ.16 / Item 12 — Custom Fields Renderer.
 *
 * Generic component that reads custom field definitions from
 * /api/custom-fields?scope=X and renders form inputs by field_type
 * (text / number / boolean / select / multi_select / date).
 *
 * Drop into any offer form to add operator-defined fields:
 *
 *   <CustomFieldsRenderer
 *     scope="hotel"
 *     values={form.custom}
 *     onChange={(custom) => setForm({ ...form, custom })}
 *   />
 *
 * The component fetches definitions on mount + filters to scope='all'
 * + scope=X. Values are stored as { [field.key]: any }.
 */

import { useEffect, useMemo, useState } from "react";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { apiFetchJson } from "@/lib/api-client";
import { Input, Select, Switch, FormField } from "@/components/ui";

type FieldDef = {
  id: number;
  scope: string;
  key: string;
  label: string;
  field_type: "text" | "number" | "boolean" | "select" | "multi_select" | "date";
  options: string[] | null;
  help_text: string | null;
  is_required: boolean;
  display_order: number;
  is_active: boolean;
};

type Props = {
  /** Vertical scope: hotel / flight / car / transfer / excursion / visa / package — or "all" for any. */
  scope: "hotel" | "flight" | "car" | "transfer" | "excursion" | "visa" | "package";
  /** Current values keyed by field.key */
  values: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  className?: string;
};

export function CustomFieldsRenderer({ scope, values, onChange, className }: Props) {
  const { token } = useAdminAuth();
  const [defs, setDefs] = useState<FieldDef[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiFetchJson<{
          success: boolean;
          data: { fields: FieldDef[] };
        }>(`/custom-fields?scope=${encodeURIComponent(scope)}&active_only=1`, { token });
        if (!cancelled) setDefs(res.data.fields ?? []);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load custom fields");
          setDefs([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, scope]);

  // Also include "all"-scoped fields (apply to every vertical).
  const visibleDefs = useMemo(() => {
    if (defs === null) return [];
    return defs.filter((d) => d.scope === scope || d.scope === "all");
  }, [defs, scope]);

  if (defs === null) {
    return (
      <p className={`text-xs text-fg-t6 ${className ?? ""}`}>Loading custom fields…</p>
    );
  }

  if (error) {
    return (
      <div
        className={`rounded-md border border-error-100 bg-error-50 px-3 py-2 text-xs text-error-700 ${className ?? ""}`}
      >
        {error}
      </div>
    );
  }

  if (visibleDefs.length === 0) {
    // Nothing defined yet — render nothing (not a placeholder).
    return null;
  }

  const update = (key: string, val: unknown) => {
    onChange({ ...values, [key]: val });
  };

  return (
    <div className={`space-y-3 ${className ?? ""}`}>
      <div className="text-[11px] uppercase tracking-[0.4px] text-fg-t6 font-semibold">
        Custom fields
      </div>
      {visibleDefs.map((def) => {
        const current = values[def.key];
        switch (def.field_type) {
          case "text":
            return (
              <FormField
                key={def.id}
                label={def.label + (def.is_required ? " *" : "")}
                htmlFor={`cf-${def.key}`}
                helperText={def.help_text ?? undefined}
              >
                <Input
                  id={`cf-${def.key}`}
                  value={typeof current === "string" ? current : ""}
                  onChange={(e) => update(def.key, e.target.value)}
                  required={def.is_required}
                />
              </FormField>
            );
          case "number":
            return (
              <FormField
                key={def.id}
                label={def.label + (def.is_required ? " *" : "")}
                htmlFor={`cf-${def.key}`}
                helperText={def.help_text ?? undefined}
              >
                <Input
                  id={`cf-${def.key}`}
                  type="number"
                  value={current == null ? "" : String(current)}
                  onChange={(e) => update(def.key, e.target.value === "" ? null : Number(e.target.value))}
                  required={def.is_required}
                />
              </FormField>
            );
          case "boolean":
            return (
              <Switch
                key={def.id}
                checked={current === true}
                onCheckedChange={(checked) => update(def.key, checked)}
                label={def.label}
                description={def.help_text ?? undefined}
              />
            );
          case "date":
            return (
              <FormField
                key={def.id}
                label={def.label + (def.is_required ? " *" : "")}
                htmlFor={`cf-${def.key}`}
                helperText={def.help_text ?? undefined}
              >
                <Input
                  id={`cf-${def.key}`}
                  type="date"
                  value={typeof current === "string" ? current : ""}
                  onChange={(e) => update(def.key, e.target.value)}
                  required={def.is_required}
                />
              </FormField>
            );
          case "select":
            return (
              <FormField
                key={def.id}
                label={def.label + (def.is_required ? " *" : "")}
                htmlFor={`cf-${def.key}`}
                helperText={def.help_text ?? undefined}
              >
                <Select
                  id={`cf-${def.key}`}
                  value={typeof current === "string" ? current : ""}
                  onChange={(e) => update(def.key, e.target.value)}
                  required={def.is_required}
                >
                  <option value="">—</option>
                  {(def.options ?? []).map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </Select>
              </FormField>
            );
          case "multi_select":
            return (
              <FormField
                key={def.id}
                label={def.label + (def.is_required ? " *" : "")}
                htmlFor={`cf-${def.key}`}
                helperText={def.help_text ?? undefined}
              >
                <div className="flex flex-wrap gap-2 rounded-md border p-2" style={{ borderColor: "var(--admin-border)" }}>
                  {(def.options ?? []).map((opt) => {
                    const arr = Array.isArray(current) ? current : [];
                    const picked = arr.includes(opt);
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => {
                          const next = picked ? arr.filter((x) => x !== opt) : [...arr, opt];
                          update(def.key, next);
                        }}
                        className="rounded-md px-2 py-1 text-[12px] font-medium transition"
                        style={
                          picked
                            ? {
                                backgroundColor: "var(--admin-primary)",
                                color: "white",
                              }
                            : {
                                backgroundColor: "var(--admin-bg-tertiary)",
                                color: "var(--admin-text-secondary)",
                              }
                        }
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </FormField>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
