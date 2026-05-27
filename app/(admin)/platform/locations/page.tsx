"use client";

/** Phase-2 migration to shared @/components/ui primitives. */

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useConfirm } from "@/contexts/ConfirmDialogContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import { exportRowsAsCsv } from "@/lib/export-csv";
import {
  apiLocationCities,
  apiLocationCityCreate,
  apiLocationCityDelete,
  apiLocationCityUpdate,
  apiLocationCountries,
  apiLocationCountryCreate,
  apiLocationCountryDelete,
  apiLocationCountryUpdate,
  apiLocationRegionCreate,
  apiLocationRegionDelete,
  apiLocationRegions,
  apiLocationRegionUpdate,
  type LocationCityRow,
  type LocationCountryRow,
  type LocationRegionRow,
} from "@/lib/locations-api";
import {
  Button,
  FormField,
  Input,

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
  V2Card,
  V2Button,
  IconButton,
} from "@/components/ui/v2";
import { Download, Edit3, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

export default function PlatformLocationsPage() {
  const { token, user } = useAdminAuth();
  const { t } = useLanguage();
  const confirm = useConfirm();
  const allowed = canAccessPlatformAdminNav(user);
  const [countries, setCountries] = useState<LocationCountryRow[]>([]);
  const [regions, setRegions] = useState<LocationRegionRow[]>([]);
  const [cities, setCities] = useState<LocationCityRow[]>([]);
  const [selectedCountryId, setSelectedCountryId] = useState<number | null>(null);
  const [selectedRegionId, setSelectedRegionId] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [busy, setBusy] = useState(false);

  const [cName, setCName] = useState("");
  const [cCode, setCCode] = useState("");
  const [cFlag, setCFlag] = useState("");
  const [cSort, setCSort] = useState("0");

  const [rName, setRName] = useState("");
  const [rCode, setRCode] = useState("");
  const [rSort, setRSort] = useState("0");

  const [ciName, setCiName] = useState("");
  const [ciSort, setCiSort] = useState("0");
  const [ciLat, setCiLat] = useState("");
  const [ciLng, setCiLng] = useState("");

  const loadCountries = useCallback(async () => {
    if (!token || !allowed) return;
    setErr(null);
    setForbidden(false);
    try {
      const res = await apiLocationCountries(token);
      setCountries(res.data);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else
        setErr(
          e instanceof ApiRequestError ? e.message : t("admin.locations.err_load_countries")
        );
    }
  }, [token, allowed, t]);

  const loadRegions = useCallback(
    async (countryId: number) => {
      if (!token || !allowed) return;
      setErr(null);
      try {
        const res = await apiLocationRegions(token, countryId);
        setRegions(res.data);
      } catch (e) {
        setErr(e instanceof ApiRequestError ? e.message : t("admin.locations.err_load_regions"));
      }
    },
    [token, allowed, t]
  );

  const loadCities = useCallback(
    async (regionId: number) => {
      if (!token || !allowed) return;
      setErr(null);
      try {
        const res = await apiLocationCities(token, regionId);
        setCities(res.data);
      } catch (e) {
        setErr(e instanceof ApiRequestError ? e.message : t("admin.locations.err_load_cities"));
      }
    },
    [token, allowed, t]
  );

  useEffect(() => {
    loadCountries();
  }, [loadCountries]);

  useEffect(() => {
    if (selectedCountryId != null) loadRegions(selectedCountryId);
    else {
      setRegions([]);
      setSelectedRegionId(null);
      setCities([]);
    }
  }, [selectedCountryId, loadRegions]);

  useEffect(() => {
    if (selectedRegionId != null) loadCities(selectedRegionId);
    else setCities([]);
  }, [selectedRegionId, loadCities]);

  async function addCountry() {
    if (!token || !cName.trim() || cCode.trim().length !== 2) {
      alert(t("admin.locations.err_name_code_required"));
      return;
    }
    setBusy(true);
    try {
      await apiLocationCountryCreate(token, {
        name: cName.trim(),
        code: cCode.trim().toUpperCase(),
        flag_emoji: cFlag.trim() || null,
        sort_order: parseInt(cSort, 10) || 0,
        is_active: true,
      });
      setCName("");
      setCCode("");
      setCFlag("");
      setCSort("0");
      await loadCountries();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : t("admin.locations.err_create_country"));
    } finally {
      setBusy(false);
    }
  }

  async function updCountry(row: LocationCountryRow) {
    if (!token) return;
    const name = window.prompt(t("admin.locations.prompt_country_name"), row.name) ?? row.name;
    const code = window.prompt(t("admin.locations.prompt_country_code"), row.code) ?? row.code;
    if (code.trim().length !== 2) {
      alert(t("admin.locations.err_code_2_chars"));
      return;
    }
    setBusy(true);
    try {
      await apiLocationCountryUpdate(token, {
        id: row.id,
        name: name.trim(),
        code: code.trim().toUpperCase(),
        flag_emoji: row.flag_emoji ?? null,
        is_active: row.is_active !== false,
        sort_order: row.sort_order ?? 0,
      });
      await loadCountries();
      if (selectedCountryId === row.id) await loadRegions(row.id);
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : t("admin.locations.err_update"));
    } finally {
      setBusy(false);
    }
  }

  async function delCountry(id: number) {
    if (!token) return;
    const ok = await confirm({ messageKey: "admin.locations.confirm_delete_country", variant: "danger" });
    if (!ok) return;
    setBusy(true);
    try {
      await apiLocationCountryDelete(token, id);
      if (selectedCountryId === id) {
        setSelectedCountryId(null);
        setSelectedRegionId(null);
      }
      await loadCountries();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : t("admin.locations.err_delete"));
    } finally {
      setBusy(false);
    }
  }

  async function addRegion() {
    if (!token || selectedCountryId == null || !rName.trim()) return;
    setBusy(true);
    try {
      await apiLocationRegionCreate(token, {
        country_id: selectedCountryId,
        name: rName.trim(),
        code: rCode.trim() || null,
        sort_order: parseInt(rSort, 10) || 0,
        is_active: true,
      });
      setRName("");
      setRCode("");
      setRSort("0");
      await loadRegions(selectedCountryId);
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : t("admin.locations.err_create_region"));
    } finally {
      setBusy(false);
    }
  }

  async function updRegion(row: LocationRegionRow) {
    if (!token) return;
    const name = window.prompt(t("admin.locations.prompt_region_name"), row.name) ?? row.name;
    setBusy(true);
    try {
      await apiLocationRegionUpdate(token, {
        id: row.id,
        name: name.trim(),
        code: row.code ?? null,
        is_active: row.is_active !== false,
        sort_order: row.sort_order ?? 0,
      });
      if (selectedCountryId != null) await loadRegions(selectedCountryId);
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : t("admin.locations.err_update"));
    } finally {
      setBusy(false);
    }
  }

  async function delRegion(id: number) {
    if (!token) return;
    const ok = await confirm({ messageKey: "admin.locations.confirm_delete_region", variant: "danger" });
    if (!ok) return;
    setBusy(true);
    try {
      await apiLocationRegionDelete(token, id);
      if (selectedRegionId === id) setSelectedRegionId(null);
      if (selectedCountryId != null) await loadRegions(selectedCountryId);
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : t("admin.locations.err_delete"));
    } finally {
      setBusy(false);
    }
  }

  async function addCity() {
    if (!token || selectedRegionId == null || !ciName.trim()) return;
    setBusy(true);
    try {
      await apiLocationCityCreate(token, {
        region_id: selectedRegionId,
        name: ciName.trim(),
        sort_order: parseInt(ciSort, 10) || 0,
        is_active: true,
        latitude: ciLat.trim() === "" ? null : Number(ciLat),
        longitude: ciLng.trim() === "" ? null : Number(ciLng),
      });
      setCiName("");
      setCiSort("0");
      setCiLat("");
      setCiLng("");
      await loadCities(selectedRegionId);
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : t("admin.locations.err_create_city"));
    } finally {
      setBusy(false);
    }
  }

  async function updCity(row: LocationCityRow) {
    if (!token) return;
    const name = window.prompt(t("admin.locations.prompt_city_name"), row.name) ?? row.name;
    setBusy(true);
    try {
      const lat =
        row.latitude === null || row.latitude === undefined || row.latitude === ""
          ? null
          : Number(row.latitude);
      const lng =
        row.longitude === null || row.longitude === undefined || row.longitude === ""
          ? null
          : Number(row.longitude);
      await apiLocationCityUpdate(token, {
        id: row.id,
        name: name.trim(),
        is_active: row.is_active !== false,
        sort_order: row.sort_order ?? 0,
        latitude: Number.isFinite(lat as number) ? lat : null,
        longitude: Number.isFinite(lng as number) ? lng : null,
      });
      if (selectedRegionId != null) await loadCities(selectedRegionId);
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : t("admin.locations.err_update"));
    } finally {
      setBusy(false);
    }
  }

  async function delCity(id: number) {
    if (!token) return;
    const ok = await confirm({ messageKey: "admin.locations.confirm_delete_city", variant: "danger" });
    if (!ok) return;
    setBusy(true);
    try {
      await apiLocationCityDelete(token, id);
      if (selectedRegionId != null) await loadCities(selectedRegionId);
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : t("admin.locations.err_delete"));
    } finally {
      setBusy(false);
    }
  }

  if (!allowed || forbidden) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">{t("admin.locations.title")}</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* v2 admin-redesign — Locations page chrome (Settings section). */}
      <V2PageHeader
        breadcrumb={[
          { label: "Home", href: "/dashboard" },
          { label: "Settings", href: "/settings/pricing-rules" },
          { label: t("admin.locations.title") },
        ]}
        title={t("admin.locations.title_long")}
        subtitle={t("admin.locations.subtitle")}
        actions={
          <V2Button
            icon={<Download className="h-4 w-4" />}
            disabled={countries.length === 0}
            onClick={() =>
              exportRowsAsCsv("locations-countries", countries, [
                ["id", (r) => r.id],
                ["code", (r) => r.code],
                ["name", (r) => r.name],
                ["flag_emoji", (r) => r.flag_emoji ?? ""],
                ["is_active", (r) => (r.is_active ? "1" : "0")],
                ["sort_order", (r) => r.sort_order ?? 0],
                ["regions_count", (r) => r.regions_count ?? 0],
                ["cities_count", (r) => r.cities_count ?? 0],
              ])
            }
          >
            Export
          </V2Button>
        }
      />

      <SectionTabs
        activeHref="/platform/locations"
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

      <div className="space-y-6">
      {err && (
        <div className="rounded-md border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">
          {err}
        </div>
      )}

      {/* Countries */}
      <section className="admin-card p-4">
        <h2 className="text-sm font-semibold">{t("admin.locations.section_countries")}</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <FormField label={t("admin.locations.field_name")} htmlFor="loc-cname">
            <Input id="loc-cname" value={cName} onChange={(e) => setCName(e.target.value)} />
          </FormField>
          <FormField label={t("admin.locations.field_code")} htmlFor="loc-ccode">
            <Input
              id="loc-ccode"
              value={cCode}
              onChange={(e) => setCCode(e.target.value.toUpperCase())}
              maxLength={2}
              className="uppercase"
            />
          </FormField>
          <FormField label={t("admin.locations.field_flag")} htmlFor="loc-cflag">
            <Input id="loc-cflag" value={cFlag} onChange={(e) => setCFlag(e.target.value)} />
          </FormField>
          <FormField label={t("admin.locations.field_sort")} htmlFor="loc-csort">
            <Input
              id="loc-csort"
              value={cSort}
              onChange={(e) => setCSort(e.target.value)}
              className="tabular-nums"
            />
          </FormField>
          <div className="flex items-end">
            <Button size="sm" disabled={busy} onClick={addCountry}>
              {t("admin.locations.btn_add_country")}
            </Button>
          </div>
        </div>
        <div className="mt-4">
          <V2Card><Table>
            <THead>
              <TR>
                <TH>{t("admin.locations.col_id")}</TH>
                <TH>{t("admin.locations.col_name")}</TH>
                <TH>{t("admin.locations.col_code")}</TH>
                <TH>{t("admin.locations.col_regions_cities")}</TH>
                <TH>{t("admin.locations.col_actions")}</TH>
              </TR>
            </THead>
            <TBody>
              {countries.length === 0 ? (
                <TEmpty colSpan={5}>{t("admin.locations.empty_countries")}</TEmpty>
              ) : null}
              {countries.map((c) => {
                const initials = (c.name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
                const tone = pickAvatarTone(c.id);
                return (
                <TR
                  key={c.id}
                  className={selectedCountryId === c.id ? "bg-figma-bg-1" : undefined}
                >
                  <TD className="tabular-nums font-mono text-xs text-fg-t7">#{c.id}</TD>
                  <TD>
                    <div className="flex items-center gap-3">
                      <span
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                        style={avatarStyle(tone)}
                        aria-hidden
                      >
                        {c.flag_emoji || initials}
                      </span>
                      <div className="font-medium text-fg-t8 truncate">{c.name}</div>
                    </div>
                  </TD>
                  <TD>
                    <span
                      className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.3px] font-mono"
                      style={{
                        backgroundColor: "var(--admin-bg-tertiary)",
                        color: "var(--admin-text-secondary)",
                      }}
                    >
                      {c.code}
                    </span>
                  </TD>
                  <TD className="text-xs text-fg-t6 tabular-nums">
                    {c.regions_count ?? "-"} / {c.cities_count ?? "-"}
                  </TD>
                  <TD align="right">
                    <div className="flex justify-end items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCountryId(c.id);
                          setSelectedRegionId(null);
                        }}
                        className="text-xs text-primary-500 hover:underline mr-1"
                      >
                        {t("admin.locations.btn_select")}
                      </button>
                      <IconButton onClick={() => updCountry(c)} disabled={busy} aria-label={t("admin.locations.btn_edit")}>
                        <Edit3 className="h-4 w-4" />
                      </IconButton>
                      <IconButton onClick={() => delCountry(c.id)} disabled={busy} aria-label={t("admin.locations.btn_delete")}>
                        <Trash2 className="h-4 w-4" />
                      </IconButton>
                    </div>
                  </TD>
                </TR>
                );
              })}
            </TBody>
          </Table></V2Card>
        </div>
      </section>

      {/* Regions */}
      {selectedCountryId != null && (
        <section className="admin-card p-4">
          <h2 className="text-sm font-semibold">
            {t("admin.locations.section_regions").replace("{id}", String(selectedCountryId))}
          </h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <FormField label={t("admin.locations.field_name")} htmlFor="loc-rname">
              <Input id="loc-rname" value={rName} onChange={(e) => setRName(e.target.value)} />
            </FormField>
            <FormField label={t("admin.locations.field_code")} htmlFor="loc-rcode">
              <Input id="loc-rcode" value={rCode} onChange={(e) => setRCode(e.target.value)} />
            </FormField>
            <FormField label={t("admin.locations.field_sort")} htmlFor="loc-rsort">
              <Input
                id="loc-rsort"
                value={rSort}
                onChange={(e) => setRSort(e.target.value)}
                className="tabular-nums"
              />
            </FormField>
            <div className="flex items-end">
              <Button size="sm" disabled={busy} onClick={addRegion}>
                {t("admin.locations.btn_add_region")}
              </Button>
            </div>
          </div>
          <div className="mt-4">
            <V2Card><Table>
              <THead>
                <TR>
                  <TH>{t("admin.locations.col_id")}</TH>
                  <TH>{t("admin.locations.col_name")}</TH>
                  <TH>{t("admin.locations.col_cities")}</TH>
                  <TH>{t("admin.locations.col_actions")}</TH>
                </TR>
              </THead>
              <TBody>
                {regions.length === 0 ? (
                  <TEmpty colSpan={4}>{t("admin.locations.empty_regions")}</TEmpty>
                ) : null}
                {regions.map((r) => {
                  const initials = (r.name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
                  const tone = pickAvatarTone(r.id);
                  return (
                  <TR
                    key={r.id}
                    className={selectedRegionId === r.id ? "bg-figma-bg-1" : undefined}
                  >
                    <TD className="tabular-nums font-mono text-xs text-fg-t7">#{r.id}</TD>
                    <TD>
                      <div className="flex items-center gap-3">
                        <span
                          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold"
                          style={avatarStyle(tone)}
                          aria-hidden
                        >
                          {initials}
                        </span>
                        <div className="font-medium text-fg-t8 truncate">{r.name}</div>
                      </div>
                    </TD>
                    <TD className="tabular-nums text-xs">{r.cities_count ?? "-"}</TD>
                    <TD align="right">
                      <div className="flex justify-end items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setSelectedRegionId(r.id)}
                          className="text-xs text-primary-500 hover:underline mr-1"
                        >
                          {t("admin.locations.btn_select")}
                        </button>
                        <IconButton onClick={() => updRegion(r)} disabled={busy} aria-label={t("admin.locations.btn_edit")}>
                          <Edit3 className="h-4 w-4" />
                        </IconButton>
                        <IconButton onClick={() => delRegion(r.id)} disabled={busy} aria-label={t("admin.locations.btn_delete")}>
                          <Trash2 className="h-4 w-4" />
                        </IconButton>
                      </div>
                    </TD>
                  </TR>
                  );
                })}
              </TBody>
            </Table></V2Card>
          </div>
        </section>
      )}

      {/* Cities */}
      {selectedRegionId != null && (
        <section className="admin-card p-4">
          <h2 className="text-sm font-semibold">
            {t("admin.locations.section_cities").replace("{id}", String(selectedRegionId))}
          </h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <FormField label={t("admin.locations.field_name")} htmlFor="loc-ciname">
              <Input
                id="loc-ciname"
                value={ciName}
                onChange={(e) => setCiName(e.target.value)}
              />
            </FormField>
            <FormField label={t("admin.locations.field_sort")} htmlFor="loc-cisort">
              <Input
                id="loc-cisort"
                value={ciSort}
                onChange={(e) => setCiSort(e.target.value)}
                className="tabular-nums"
              />
            </FormField>
            <FormField label={t("admin.locations.field_lat")} htmlFor="loc-cilat">
              <Input
                id="loc-cilat"
                value={ciLat}
                onChange={(e) => setCiLat(e.target.value)}
                className="tabular-nums"
              />
            </FormField>
            <FormField label={t("admin.locations.field_lng")} htmlFor="loc-cilng">
              <Input
                id="loc-cilng"
                value={ciLng}
                onChange={(e) => setCiLng(e.target.value)}
                className="tabular-nums"
              />
            </FormField>
            <div className="flex items-end">
              <Button size="sm" disabled={busy} onClick={addCity}>
                {t("admin.locations.btn_add_city")}
              </Button>
            </div>
          </div>
          <div className="mt-4">
            <V2Card><Table>
              <THead>
                <TR>
                  <TH>{t("admin.locations.col_id")}</TH>
                  <TH>{t("admin.locations.col_name")}</TH>
                  <TH>{t("admin.locations.col_actions")}</TH>
                </TR>
              </THead>
              <TBody>
                {cities.length === 0 ? (
                  <TEmpty colSpan={3}>{t("admin.locations.empty_cities")}</TEmpty>
                ) : null}
                {cities.map((x) => {
                  const initials = (x.name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
                  const tone = pickAvatarTone(x.id);
                  return (
                  <TR key={x.id}>
                    <TD className="tabular-nums font-mono text-xs text-fg-t7">#{x.id}</TD>
                    <TD>
                      <div className="flex items-center gap-3">
                        <span
                          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold"
                          style={avatarStyle(tone)}
                          aria-hidden
                        >
                          {initials}
                        </span>
                        <div className="font-medium text-fg-t8 truncate">{x.name}</div>
                      </div>
                    </TD>
                    <TD align="right">
                      <div className="flex justify-end items-center gap-1">
                        <IconButton onClick={() => updCity(x)} disabled={busy} aria-label={t("admin.locations.btn_edit")}>
                          <Edit3 className="h-4 w-4" />
                        </IconButton>
                        <IconButton onClick={() => delCity(x.id)} disabled={busy} aria-label={t("admin.locations.btn_delete")}>
                          <Trash2 className="h-4 w-4" />
                        </IconButton>
                      </div>
                    </TD>
                  </TR>
                  );
                })}
              </TBody>
            </Table></V2Card>
          </div>
        </section>
      )}
      </div>
    </div>
  );
}

// v2 admin-redesign helpers — avatar tone picker.
function pickAvatarTone(id: number): "purple" | "teal" | "amber" | "blue" {
  const tones: Array<"purple" | "teal" | "amber" | "blue"> = ["purple", "teal", "amber", "blue"];
  return tones[id % tones.length]!;
}

function avatarStyle(tone: "purple" | "teal" | "amber" | "blue"): React.CSSProperties {
  const map: Record<"purple" | "teal" | "amber" | "blue", React.CSSProperties> = {
    purple: { backgroundColor: "var(--admin-primary-light)", color: "var(--admin-primary-dark)" },
    teal: { backgroundColor: "var(--admin-success-light)", color: "var(--admin-success-dark)" },
    amber: { backgroundColor: "var(--admin-warning-light)", color: "var(--admin-warning-dark)" },
    blue: { backgroundColor: "var(--admin-info-light)", color: "var(--admin-info-dark)" },
  };
  return map[tone];
}
