"use client";

import { useEffect, useState } from "react";
import { ImageUploadField } from "@/components/ImageUploadField";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { ApiRequestError } from "@/lib/api-client";
import {
  apiPatchCompanyPartnerSettings,
  type PlatformCompanyRow,
} from "@/lib/platform-admin-api";

type Props = {
  company: PlatformCompanyRow | null;
  onClose: () => void;
  onSaved: (next: PlatformCompanyRow) => void;
};

export function PartnerSettingsModal({ company, onClose, onSaved }: Props) {
  const { token } = useAdminAuth();
  const [logo, setLogo] = useState<string>("");
  const [isPartnerVisible, setIsPartnerVisible] = useState<boolean>(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (company) {
      setLogo(company.logo ?? "");
      setIsPartnerVisible(Boolean(company.is_partner_visible));
      setErr(null);
    }
  }, [company]);

  if (!company) return null;

  async function handleSave() {
    if (!token || !company) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await apiPatchCompanyPartnerSettings(token, company.id, {
        logo: logo === "" ? null : logo,
        is_partner_visible: isPartnerVisible,
      });
      onSaved(res.data);
      onClose();
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
            <h2 className="text-base font-semibold text-fg-t11">Partner settings</h2>
            <p className="text-xs text-fg-t7">{company.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-default px-3 py-1 text-xs hover:bg-figma-bg-1"
          >
            Close
          </button>
        </div>

        <div className="grid gap-3">
          <ImageUploadField
            value={logo}
            onChange={setLogo}
            section="companies"
            label="Operator logo"
            hint="(կտտացրու «Upload image» ` ընտրի ֆայլ կամ paste URL)"
            altText={`${company.name} logo`}
          />

          <label className="inline-flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={isPartnerVisible}
              onChange={(e) => setIsPartnerVisible(e.target.checked)}
              className="mt-0.5 h-4 w-4"
            />
            <span>
              <span className="font-medium text-fg-t6">Show on home-page partner strip</span>
              <span className="ml-1 text-fg-t7 font-normal">
                (եթե միացնես և logo կա` կհայտնվի գլխավոր էջի «Partners» բաժնում)
              </span>
            </span>
          </label>

          {err && <p className="text-xs text-error-700">{err}</p>}

          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-default bg-white px-4 py-1.5 text-sm hover:bg-figma-bg-1"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleSave()}
              className="admin-btn-primary"
            >
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
