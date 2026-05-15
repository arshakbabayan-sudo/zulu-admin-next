"use client";

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
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
import { useCallback, useEffect, useState } from "react";

export default function PlatformLocationsPage() {
  const { token, user } = useAdminAuth();
  const { t } = useLanguage();
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
      else setErr(e instanceof ApiRequestError ? e.message : t("admin.locations.err_load_countries"));
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
    if (!window.confirm(t("admin.locations.confirm_delete_country"))) return;
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
    if (!window.confirm(t("admin.locations.confirm_delete_region"))) return;
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
    if (!window.confirm(t("admin.locations.confirm_delete_city"))) return;
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
      <div>
        <h1 className="admin-page-title">{t("admin.locations.title")}</h1>
        <div className="mt-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="admin-page-title">{t("admin.locations.title_long")}</h1>
      <p className="mt-1 text-sm text-fg-t7">{t("admin.locations.subtitle")}</p>
      {err && <p className="mt-2 text-sm text-error-600">{err}</p>}

      <section className="mt-6 rounded border border-default bg-white p-4">
        <h2 className="text-sm font-semibold">{t("admin.locations.section_countries")}</h2>
        <div className="mt-3 flex flex-wrap items-end gap-2 text-sm">
          <label>
            {t("admin.locations.field_name")}
            <input
              value={cName}
              onChange={(e) => setCName(e.target.value)}
              className="ml-1 rounded border border-default px-2 py-1"
            />
          </label>
          <label>
            {t("admin.locations.field_code")}
            <input
              value={cCode}
              onChange={(e) => setCCode(e.target.value.toUpperCase())}
              maxLength={2}
              className="ml-1 w-14 rounded border border-default px-2 py-1 uppercase"
            />
          </label>
          <label>
            {t("admin.locations.field_flag")}
            <input
              value={cFlag}
              onChange={(e) => setCFlag(e.target.value)}
              className="ml-1 w-16 rounded border border-default px-2 py-1"
            />
          </label>
          <label>
            {t("admin.locations.field_sort")}
            <input
              value={cSort}
              onChange={(e) => setCSort(e.target.value)}
              className="ml-1 w-16 rounded border border-default px-2 py-1 tabular-nums"
            />
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => addCountry()}
            className="rounded border border-default bg-figma-bg-1 px-3 py-1 disabled:opacity-40"
          >
            {t("admin.locations.btn_add_country")}
          </button>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="border-b border-default bg-figma-bg-1 text-xs uppercase text-fg-t7">
              <tr>
                <th className="px-2 py-2">{t("admin.locations.col_id")}</th>
                <th className="px-2 py-2">{t("admin.locations.col_name")}</th>
                <th className="px-2 py-2">{t("admin.locations.col_code")}</th>
                <th className="px-2 py-2">{t("admin.locations.col_regions_cities")}</th>
                <th className="px-2 py-2">{t("admin.locations.col_actions")}</th>
              </tr>
            </thead>
            <tbody>
              {countries.map((c) => (
                <tr
                  key={c.id}
                  className={
                    "border-b border-default " +
                    (selectedCountryId === c.id ? "bg-figma-bg-1" : "")
                  }
                >
                  <td className="px-2 py-2 tabular-nums">{c.id}</td>
                  <td className="px-2 py-2">{c.name}</td>
                  <td className="px-2 py-2">{c.code}</td>
                  <td className="px-2 py-2 text-xs text-fg-t6">
                    {c.regions_count ?? "-"} / {c.cities_count ?? "-"}
                  </td>
                  <td className="px-2 py-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCountryId(c.id);
                        setSelectedRegionId(null);
                      }}
                      className="mr-2 text-xs text-fg-t7 underline"
                    >
                      {t("admin.locations.btn_select")}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => updCountry(c)}
                      className="mr-2 text-xs text-fg-t7 underline disabled:opacity-40"
                    >
                      {t("admin.locations.btn_edit")}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => delCountry(c.id)}
                      className="text-xs text-error-700 underline disabled:opacity-40"
                    >
                      {t("admin.locations.btn_delete")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {selectedCountryId != null && (
        <section className="mt-6 rounded border border-default bg-white p-4">
          <h2 className="text-sm font-semibold">
            {t("admin.locations.section_regions").replace("{id}", String(selectedCountryId))}
          </h2>
          <div className="mt-3 flex flex-wrap items-end gap-2 text-sm">
            <label>
              {t("admin.locations.field_name")}
              <input
                value={rName}
                onChange={(e) => setRName(e.target.value)}
                className="ml-1 rounded border border-default px-2 py-1"
              />
            </label>
            <label>
              {t("admin.locations.field_code")}
              <input
                value={rCode}
                onChange={(e) => setRCode(e.target.value)}
                className="ml-1 rounded border border-default px-2 py-1"
              />
            </label>
            <label>
              {t("admin.locations.field_sort")}
              <input
                value={rSort}
                onChange={(e) => setRSort(e.target.value)}
                className="ml-1 w-16 rounded border border-default px-2 py-1 tabular-nums"
              />
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={() => addRegion()}
              className="rounded border border-default bg-figma-bg-1 px-3 py-1 disabled:opacity-40"
            >
              {t("admin.locations.btn_add_region")}
            </button>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="border-b border-default bg-figma-bg-1 text-xs uppercase text-fg-t7">
                <tr>
                  <th className="px-2 py-2">{t("admin.locations.col_id")}</th>
                  <th className="px-2 py-2">{t("admin.locations.col_name")}</th>
                  <th className="px-2 py-2">{t("admin.locations.col_cities")}</th>
                  <th className="px-2 py-2">{t("admin.locations.col_actions")}</th>
                </tr>
              </thead>
              <tbody>
                {regions.map((r) => (
                  <tr
                    key={r.id}
                    className={
                      "border-b border-default " +
                      (selectedRegionId === r.id ? "bg-figma-bg-1" : "")
                    }
                  >
                    <td className="px-2 py-2 tabular-nums">{r.id}</td>
                    <td className="px-2 py-2">{r.name}</td>
                    <td className="px-2 py-2 tabular-nums">{r.cities_count ?? "-"}</td>
                    <td className="px-2 py-2">
                      <button
                        type="button"
                        onClick={() => setSelectedRegionId(r.id)}
                        className="mr-2 text-xs text-fg-t7 underline"
                      >
                        {t("admin.locations.btn_select")}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => updRegion(r)}
                        className="mr-2 text-xs text-fg-t7 underline disabled:opacity-40"
                      >
                        {t("admin.locations.btn_edit")}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => delRegion(r.id)}
                        className="text-xs text-error-700 underline disabled:opacity-40"
                      >
                        {t("admin.locations.btn_delete")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {selectedRegionId != null && (
        <section className="mt-6 rounded border border-default bg-white p-4">
          <h2 className="text-sm font-semibold">
            {t("admin.locations.section_cities").replace("{id}", String(selectedRegionId))}
          </h2>
          <div className="mt-3 flex flex-wrap items-end gap-2 text-sm">
            <label>
              {t("admin.locations.field_name")}
              <input
                value={ciName}
                onChange={(e) => setCiName(e.target.value)}
                className="ml-1 rounded border border-default px-2 py-1"
              />
            </label>
            <label>
              {t("admin.locations.field_sort")}
              <input
                value={ciSort}
                onChange={(e) => setCiSort(e.target.value)}
                className="ml-1 w-16 rounded border border-default px-2 py-1 tabular-nums"
              />
            </label>
            <label>
              {t("admin.locations.field_lat")}
              <input
                value={ciLat}
                onChange={(e) => setCiLat(e.target.value)}
                className="ml-1 w-24 rounded border border-default px-2 py-1 tabular-nums"
              />
            </label>
            <label>
              {t("admin.locations.field_lng")}
              <input
                value={ciLng}
                onChange={(e) => setCiLng(e.target.value)}
                className="ml-1 w-24 rounded border border-default px-2 py-1 tabular-nums"
              />
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={() => addCity()}
              className="rounded border border-default bg-figma-bg-1 px-3 py-1 disabled:opacity-40"
            >
              {t("admin.locations.btn_add_city")}
            </button>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[400px] text-left text-sm">
              <thead className="border-b border-default bg-figma-bg-1 text-xs uppercase text-fg-t7">
                <tr>
                  <th className="px-2 py-2">{t("admin.locations.col_id")}</th>
                  <th className="px-2 py-2">{t("admin.locations.col_name")}</th>
                  <th className="px-2 py-2">{t("admin.locations.col_actions")}</th>
                </tr>
              </thead>
              <tbody>
                {cities.map((x) => (
                  <tr key={x.id} className="border-b border-default">
                    <td className="px-2 py-2 tabular-nums">{x.id}</td>
                    <td className="px-2 py-2">{x.name}</td>
                    <td className="px-2 py-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => updCity(x)}
                        className="mr-2 text-xs text-fg-t7 underline disabled:opacity-40"
                      >
                        {t("admin.locations.btn_edit")}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => delCity(x.id)}
                        className="text-xs text-error-700 underline disabled:opacity-40"
                      >
                        {t("admin.locations.btn_delete")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
