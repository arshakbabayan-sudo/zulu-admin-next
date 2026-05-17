"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { ApiRequestError } from "@/lib/api-client";
import {
  apiGetPackageHomepageFeatures,
  apiSyncPackageHomepageFeatures,
  type PackageHomepageFeatureRow,
  type PackageHomepageFeatureSlug,
} from "@/lib/platform-admin-api";

type Props = {
  packageId: number | null;
  packageTitle?: string | null;
  onClose: () => void;
};

type Row = { enabled: boolean; position: number; is_active: boolean };

type State = Record<PackageHomepageFeatureSlug, Row>;

const SECTION_LABELS: Record<PackageHomepageFeatureSlug, string> = {
  special_offers: "Special offers (Հատուկ առաջարկներ)",
  popular_destinations: "Popular destinations (Հանրաճանաչ ուղղություններ)",
};

const EMPTY: State = {
  special_offers: { enabled: false, position: 1, is_active: true },
  popular_destinations: { enabled: false, position: 1, is_active: true },
};

export function PackageHomepageFeatureModal({ packageId, packageTitle, onClose }: Props) {
  const { token } = useAdminAuth();
  const [state, setState] = useState<State>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!token || packageId === null) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await apiGetPackageHomepageFeatures(token, packageId);
      const next: State = {
        special_offers: { enabled: false, position: 1, is_active: true },
        popular_destinations: { enabled: false, position: 1, is_active: true },
      };
      for (const f of res.data.features) {
        next[f.section_slug] = {
          enabled: true,
          position: f.position || 1,
          is_active: f.is_active,
        };
      }
      setState(next);
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [token, packageId]);

  useEffect(() => {
    if (packageId !== null) void load();
  }, [packageId, load]);

  if (packageId === null) return null;

  async function handleSave() {
    if (!token || packageId === null) return;
    setBusy(true);
    setErr(null);
    try {
      const features: PackageHomepageFeatureRow[] = [];
      (Object.keys(state) as PackageHomepageFeatureSlug[]).forEach((slug) => {
        const row = state[slug];
        if (row.enabled) {
          features.push({
            section_slug: slug,
            position: row.position,
            is_active: row.is_active,
          });
        }
      });
      await apiSyncPackageHomepageFeatures(token, packageId, features);
      setSavedAt(Date.now());
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-fg-t11">Homepage feature</h2>
            <p className="text-xs text-fg-t7">
              {packageTitle ? `${packageTitle} — ` : ""}package #{packageId}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-default px-3 py-1 text-xs hover:bg-figma-bg-1"
          >
            Close
          </button>
        </div>

        <div className={loading ? "opacity-60" : ""}>
          {(Object.keys(SECTION_LABELS) as PackageHomepageFeatureSlug[]).map((slug) => {
            const row = state[slug];
            return (
              <div
                key={slug}
                className="mb-3 rounded border border-default bg-figma-bg-1 p-3"
              >
                <label className="flex items-center gap-2 text-sm font-medium text-fg-t6">
                  <input
                    type="checkbox"
                    checked={row.enabled}
                    onChange={(e) =>
                      setState((p) => ({
                        ...p,
                        [slug]: { ...p[slug], enabled: e.target.checked },
                      }))
                    }
                    className="h-4 w-4"
                  />
                  Show in <span className="text-primary-700">{SECTION_LABELS[slug]}</span>
                </label>
                {row.enabled && (
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <label className="text-xs text-fg-t7">
                      Position{" "}
                      <span className="text-fg-t6 font-normal">
                        (ցույց է տրվում փոքր թիվը` ձախ սկզբից)
                      </span>
                      <input
                        type="number"
                        min={0}
                        value={row.position}
                        onChange={(e) =>
                          setState((p) => ({
                            ...p,
                            [slug]: {
                              ...p[slug],
                              position: Number(e.target.value) || 0,
                            },
                          }))
                        }
                        className="ml-2 w-20 rounded border border-default px-2 py-1 text-sm tabular-nums"
                      />
                    </label>
                    <label className="inline-flex items-center gap-1 text-xs text-fg-t7">
                      <input
                        type="checkbox"
                        checked={row.is_active}
                        onChange={(e) =>
                          setState((p) => ({
                            ...p,
                            [slug]: { ...p[slug], is_active: e.target.checked },
                          }))
                        }
                        className="h-3.5 w-3.5"
                      />
                      Active
                    </label>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {err && <p className="text-xs text-error-700">{err}</p>}
        {savedAt && <p className="text-xs text-emerald-700">Saved.</p>}

        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-default bg-white px-4 py-1.5 text-sm hover:bg-figma-bg-1"
          >
            Close
          </button>
          <button
            type="button"
            disabled={busy || loading}
            onClick={() => void handleSave()}
            className="admin-btn-primary"
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
