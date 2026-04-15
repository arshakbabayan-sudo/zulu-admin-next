"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { apiTreeLocationChildren, apiTreeLocationNode, type TreeLocationNode } from "@/lib/locations-api";

type LocationSelectionMeta = {
  country?: TreeLocationNode | null;
  region?: TreeLocationNode | null;
  city?: TreeLocationNode | null;
  final?: TreeLocationNode | null;
};

type Props = {
  token: string | null;
  value: number | null | undefined;
  onChange: (locationId: number | null, meta: LocationSelectionMeta) => void;
  label?: string;
};

export function LocationCascadeSelect({ token, value, onChange, label = "Location" }: Props) {
  const lastEmitKeyRef = useRef<string>("");
  const [loading, setLoading] = useState(false);
  const [countries, setCountries] = useState<TreeLocationNode[]>([]);
  const [regions, setRegions] = useState<TreeLocationNode[]>([]);
  const [cities, setCities] = useState<TreeLocationNode[]>([]);

  const [countryId, setCountryId] = useState<number | "">("");
  const [regionId, setRegionId] = useState<number | "">("");
  const [cityId, setCityId] = useState<number | "">("");

  useEffect(() => {
    if (!token) return;
    let active = true;
    setLoading(true);
    void apiTreeLocationChildren(token, null)
      .then((res) => {
        if (!active) return;
        setCountries(res.data ?? []);
      })
      .catch(() => {
        if (!active) return;
        setCountries([]);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    if (!token || !value) return;
    let active = true;
    setLoading(true);
    void apiTreeLocationNode(token, value)
      .then(async (res) => {
        if (!active) return;
        const node = res.data;
        const ancestors = node.ancestors ?? [];
        const country = ancestors.find((a) => a.type === "country") ?? (node.type === "country" ? node : undefined);
        const region = ancestors.find((a) => a.type === "region") ?? (node.type === "region" ? node : undefined);
        const city = ancestors.find((a) => a.type === "city") ?? (node.type === "city" ? node : undefined);

        if (country) {
          setCountryId(country.id);
          const regionRes = await apiTreeLocationChildren(token, country.id);
          if (!active) return;
          setRegions(regionRes.data ?? []);
        } else {
          setCountryId("");
          setRegions([]);
        }

        if (region) {
          setRegionId(region.id);
          const cityRes = await apiTreeLocationChildren(token, region.id);
          if (!active) return;
          setCities(cityRes.data ?? []);
        } else {
          setRegionId("");
          setCities([]);
        }

        if (city) {
          setCityId(city.id);
        } else {
          setCityId("");
        }
      })
      .catch(() => {
        if (!active) return;
        setCountryId("");
        setRegionId("");
        setCityId("");
        setRegions([]);
        setCities([]);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token, value]);

  const selected = useMemo(() => {
    const country = countries.find((row) => row.id === countryId) ?? null;
    const region = regions.find((row) => row.id === regionId) ?? null;
    const city = cities.find((row) => row.id === cityId) ?? null;
    const final = city ?? region ?? country;
    return { country, region, city, final };
  }, [countries, regions, cities, countryId, regionId, cityId]);

  useEffect(() => {
    if (value && !selected.final && countryId === "" && regionId === "" && cityId === "") {
      return;
    }
    const emitKey = `${selected.country?.id ?? "x"}:${selected.region?.id ?? "x"}:${selected.city?.id ?? "x"}:${selected.final?.id ?? "x"}`;
    if (lastEmitKeyRef.current === emitKey) {
      return;
    }
    lastEmitKeyRef.current = emitKey;
    onChange(selected.final?.id ?? null, selected);
  }, [selected, onChange, value, countryId, regionId, cityId]);

  async function handleCountryChange(nextRaw: string) {
    if (!token) return;
    const nextId = nextRaw ? Number(nextRaw) : "";
    setCountryId(nextId);
    setRegionId("");
    setCityId("");
    setCities([]);
    if (nextId === "") {
      setRegions([]);
      return;
    }
    setLoading(true);
    try {
      const res = await apiTreeLocationChildren(token, nextId);
      setRegions(res.data ?? []);
    } catch {
      setRegions([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleRegionChange(nextRaw: string) {
    if (!token) return;
    const nextId = nextRaw ? Number(nextRaw) : "";
    setRegionId(nextId);
    setCityId("");
    if (nextId === "") {
      setCities([]);
      return;
    }
    setLoading(true);
    try {
      const res = await apiTreeLocationChildren(token, nextId);
      setCities(res.data ?? []);
    } catch {
      setCities([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2 sm:col-span-2">
      <span className="text-sm font-medium text-slate-600">{label}</span>
      <div className="grid gap-2 sm:grid-cols-3">
        <select
          value={countryId === "" ? "" : String(countryId)}
          onChange={(e) => void handleCountryChange(e.target.value)}
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
        >
          <option value="">Select country</option>
          {countries.map((row) => (
            <option key={row.id} value={row.id}>
              {row.name}
            </option>
          ))}
        </select>
        <select
          value={regionId === "" ? "" : String(regionId)}
          onChange={(e) => void handleRegionChange(e.target.value)}
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          disabled={countryId === "" || regions.length === 0}
        >
          <option value="">Select region (optional)</option>
          {regions.map((row) => (
            <option key={row.id} value={row.id}>
              {row.name}
            </option>
          ))}
        </select>
        <select
          value={cityId === "" ? "" : String(cityId)}
          onChange={(e) => setCityId(e.target.value ? Number(e.target.value) : "")}
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          disabled={regionId === "" || cities.length === 0}
        >
          <option value="">Select city (optional)</option>
          {cities.map((row) => (
            <option key={row.id} value={row.id}>
              {row.name}
            </option>
          ))}
        </select>
      </div>
      {loading && <p className="text-xs text-slate-500">Loading locations…</p>}
      {selected.final && (
        <p className="text-xs text-slate-500">
          Selected: {selected.final.name} ({selected.final.type})
        </p>
      )}
    </div>
  );
}
