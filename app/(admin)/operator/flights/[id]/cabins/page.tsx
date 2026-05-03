"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { SeatMapEditor } from "@/components/flights/SeatMapEditor";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { ApiRequestError } from "@/lib/api-client";
import { flightCabinClassLabel } from "@/lib/flight-cabin-class";
import {
  apiFlight,
  apiFlightCabinSeatMap,
  apiFlightCabins,
  apiUpsertFlightCabinSeatMap,
  type FlightCabinRow,
  type FlightCabinSeatMapPayload,
  type FlightCabinSeatMapRow,
  type FlightRow,
} from "@/lib/inventory-crud-api";

export default function FlightCabinsSeatMapPage() {
  const params = useParams<{ id: string }>();
  const { token } = useAdminAuth();
  const flightId = useMemo(() => Number(params?.id ?? 0), [params?.id]);

  const [forbidden, setForbidden] = useState(false);
  const [flight, setFlight] = useState<FlightRow | null>(null);
  const [cabins, setCabins] = useState<FlightCabinRow[]>([]);
  const [activeCabinId, setActiveCabinId] = useState<number | null>(null);
  const [seatMap, setSeatMap] = useState<FlightCabinSeatMapRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [seatMapLoading, setSeatMapLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [seatMapErr, setSeatMapErr] = useState<string | null>(null);

  const activeCabin = useMemo(
    () => cabins.find((item) => item.id === activeCabinId) ?? null,
    [activeCabinId, cabins]
  );

  const loadPageData = useCallback(async () => {
    if (!token || !Number.isFinite(flightId) || flightId <= 0) return;
    setLoading(true);
    setErr(null);
    setForbidden(false);
    try {
      const [flightRes, cabinsRes] = await Promise.all([
        apiFlight(token, flightId),
        apiFlightCabins(token, flightId),
      ]);
      setFlight(flightRes.data);
      const rows = cabinsRes.data ?? [];
      setCabins(rows);
      setActiveCabinId((prev) => prev ?? rows[0]?.id ?? null);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : "Failed to load flight cabins.");
    } finally {
      setLoading(false);
    }
  }, [flightId, token]);

  const loadSeatMap = useCallback(async () => {
    if (!token || !activeCabinId || !Number.isFinite(flightId) || flightId <= 0) return;
    setSeatMapLoading(true);
    setSeatMapErr(null);
    try {
      const res = await apiFlightCabinSeatMap(token, flightId, activeCabinId);
      setSeatMap(res.data ?? null);
    } catch (e) {
      setSeatMapErr(e instanceof ApiRequestError ? e.message : "Failed to load seat map.");
      setSeatMap(null);
    } finally {
      setSeatMapLoading(false);
    }
  }, [activeCabinId, flightId, token]);

  useEffect(() => {
    void loadPageData();
  }, [loadPageData]);

  useEffect(() => {
    if (!activeCabinId) {
      setSeatMap(null);
      return;
    }
    void loadSeatMap();
  }, [activeCabinId, loadSeatMap]);

  async function handleSaveSeatMap(payload: FlightCabinSeatMapPayload) {
    if (!token || !activeCabinId) return;
    setSaving(true);
    setSeatMapErr(null);
    try {
      const res = await apiUpsertFlightCabinSeatMap(token, flightId, activeCabinId, payload);
      setSeatMap(res.data);
      await loadPageData();
    } catch (e) {
      setSeatMapErr(e instanceof ApiRequestError ? e.message : "Failed to save seat map.");
    } finally {
      setSaving(false);
    }
  }

  if (forbidden) {
    return (
      <div>
        <div className="mb-4">
          <h1 className="admin-page-title">Flight cabin seat maps</h1>
          <p className="mt-1 text-sm text-fg-t6">Flight #{flightId}</p>
        </div>
        <ForbiddenNotice />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="admin-page-title">Flight cabin seat maps</h1>
          <p className="mt-1 text-sm text-fg-t6">
            {flight
              ? `Flight #${flight.id} - ${flight.flight_code_internal ?? flight.flight_number ?? "N/A"}`
              : `Flight #${flightId}`}
          </p>
        </div>
        <Link
          href="/operator/flights"
          className="rounded border border-default bg-white px-3 py-1.5 text-sm text-fg-t7 hover:bg-figma-bg-1"
        >
          Back to flights
        </Link>
      </div>

      {err && <p className="mb-3 text-sm text-error-600">{err}</p>}

      <div className="mb-4 overflow-x-auto rounded border border-default bg-white">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="border-b border-default bg-figma-bg-1 text-xs uppercase text-fg-t7">
            <tr>
              <th className="px-3 py-2">Cabin</th>
              <th className="px-3 py-2">Class</th>
              <th className="px-3 py-2">Seats</th>
              <th className="px-3 py-2">Adult price</th>
              <th className="px-3 py-2">Seat map</th>
              <th className="px-3 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {!loading && cabins.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-fg-t6">
                  No cabins found for this flight.
                </td>
              </tr>
            )}
            {cabins.map((cabin) => (
              <tr
                key={cabin.id}
                className={`border-b border-default ${activeCabinId === cabin.id ? "bg-blue-50" : "bg-white"}`}
              >
                <td className="px-3 py-2 font-medium">#{cabin.id}</td>
                <td className="px-3 py-2">{flightCabinClassLabel(cabin.cabin_class)}</td>
                <td className="px-3 py-2">
                  {cabin.seat_capacity_available} / {cabin.seat_capacity_total}
                </td>
                <td className="px-3 py-2">{cabin.adult_price}</td>
                <td className="px-3 py-2">{cabin.seat_map_available ? "Enabled" : "Not configured"}</td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => setActiveCabinId(cabin.id)}
                    className="rounded border border-default px-2 py-1 text-xs hover:bg-figma-bg-1"
                  >
                    {activeCabinId === cabin.id ? "Selected" : "Edit seat map"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {activeCabin ? (
        <SeatMapEditor
          seatMap={seatMap}
          loading={seatMapLoading}
          saving={saving}
          error={seatMapErr}
          onSave={handleSaveSeatMap}
        />
      ) : (
        <div className="rounded border border-default bg-white p-4 text-sm text-fg-t6">
          Select a cabin to manage its seat map.
        </div>
      )}
    </div>
  );
}
