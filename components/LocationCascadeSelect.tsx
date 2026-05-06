"use client";
// Force Vercel rebuild — admin deploy was stuck on stale bundle.
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

  async function handleCountryChange(nextId: number | "") {
    if (!token) return;
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

  async function handleRegionChange(nextId: number | "") {
    if (!token) return;
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
        <Combobox
          items={countries}
          value={countryId}
          onChange={(id) => void handleCountryChange(id)}
          placeholder="Select country"
          showFlag
        />
        <Combobox
          items={regions}
          value={regionId}
          onChange={(id) => void handleRegionChange(id)}
          placeholder="Select region (optional)"
          disabled={countryId === "" || regions.length === 0}
        />
        <Combobox
          items={cities}
          value={cityId}
          onChange={(id) => setCityId(id)}
          placeholder="Select city (optional)"
          disabled={regionId === "" || cities.length === 0}
        />
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

// ──────────────────────────────────────────────────────────────────────────
// Type-ahead combobox: typing a letter filters the list (case-insensitive,
// works with Latin + Armenian + Cyrillic alphabets). Click to open,
// click outside to close, ↑/↓/Enter for keyboard navigation.
// ──────────────────────────────────────────────────────────────────────────

type ComboboxProps = {
  items: TreeLocationNode[];
  value: number | "";
  onChange: (id: number | "") => void;
  placeholder: string;
  disabled?: boolean;
  showFlag?: boolean;
};

function Combobox({ items, value, onChange, placeholder, disabled = false, showFlag = false }: ComboboxProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);

  const selectedItem = useMemo(
    () => (value === "" ? null : items.find((i) => i.id === value) ?? null),
    [items, value]
  );

  // Filter: items whose name starts with the typed prefix (case-insensitive).
  // Falls back to "contains" so partial typing still finds matches.
  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    if (!q) return items;
    const starts = items.filter((i) => i.name.toLocaleLowerCase().startsWith(q));
    if (starts.length > 0) return starts;
    return items.filter((i) => i.name.toLocaleLowerCase().includes(q));
  }, [items, query]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Keep highlight in range when filtered list changes
  useEffect(() => {
    setHighlight(0);
  }, [query, open]);

  function commit(id: number | "") {
    onChange(id);
    setOpen(false);
    setQuery("");
  }

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const pick = filtered[highlight];
      if (pick) commit(pick.id);
    } else if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
    } else if (e.key === "Backspace" && query === "" && selectedItem) {
      commit("");
    }
  }

  const displayValue = open ? query : selectedItem?.name ?? "";

  return (
    <div ref={wrapRef} className="relative">
      <div
        className={`flex items-center gap-1 rounded border px-2 py-1.5 text-sm ${
          disabled ? "border-slate-200 bg-slate-50 text-slate-400" : "border-slate-300 bg-white"
        }`}
      >
        {showFlag && selectedItem?.flag_emoji && !open && (
          <span className="text-base leading-none">{selectedItem.flag_emoji}</span>
        )}
        <input
          ref={inputRef}
          type="text"
          value={displayValue}
          placeholder={placeholder}
          disabled={disabled}
          onFocus={() => !disabled && setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={handleKey}
          className="w-full bg-transparent outline-none placeholder:text-slate-400 disabled:cursor-not-allowed"
        />
        {selectedItem && !open && !disabled && (
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              commit("");
            }}
            className="text-slate-400 hover:text-slate-600"
            aria-label="Clear selection"
          >
            ×
          </button>
        )}
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            if (disabled) return;
            setOpen((v) => !v);
            inputRef.current?.focus();
          }}
          className="text-slate-400"
          aria-label="Toggle dropdown"
          disabled={disabled}
        >
          ▾
        </button>
      </div>
      {open && filtered.length > 0 && (
        <ul
          ref={listRef}
          className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg"
        >
          {filtered.map((item, idx) => (
            <li
              key={item.id}
              onMouseDown={(e) => {
                e.preventDefault();
                commit(item.id);
              }}
              onMouseEnter={() => setHighlight(idx)}
              className={`flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm ${
                idx === highlight ? "bg-violet-50 text-violet-700" : "text-slate-700"
              }`}
            >
              {showFlag && item.flag_emoji && <span className="text-base leading-none">{item.flag_emoji}</span>}
              <span className="truncate">{item.name}</span>
            </li>
          ))}
        </ul>
      )}
      {open && filtered.length === 0 && (
        <div className="absolute z-30 mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 shadow-lg">
          No matches
        </div>
      )}
    </div>
  );
}
