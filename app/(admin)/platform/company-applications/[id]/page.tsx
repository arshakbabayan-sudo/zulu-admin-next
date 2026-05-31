"use client";

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useConfirm } from "@/contexts/ConfirmDialogContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import {
  apiApproveCompanyApplication,
  apiCompanyApplication,
  apiRejectCompanyApplication,
  type CompanyApplicationRow,
} from "@/lib/platform-admin-api";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { PageHeader as V2PageHeader, V2Card, V2Button } from "@/components/ui/v2";

function canActOnApplication(status: string): boolean {
  return status === "pending" || status === "under_review";
}

export default function CompanyApplicationDetailPage() {
  const params = useParams();
  const id = Number(params.id);
  const { token, user } = useAdminAuth();
  const { t } = useLanguage();
  const confirm = useConfirm();
  const allowed = canAccessPlatformAdminNav(user);
  const [row, setRow] = useState<CompanyApplicationRow | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token || !allowed || !Number.isFinite(id) || id < 1) return;
    setErr(null);
    setForbidden(false);
    try {
      const res = await apiCompanyApplication(token, id);
      setRow(res.data);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else if (e instanceof ApiRequestError && e.status === 404) setErr(t("admin.company_application_detail.err_not_found"));
      else setErr(e instanceof ApiRequestError ? e.message : t("admin.company_applications.err_load"));
    }
  }, [token, allowed, id, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function approve() {
    if (!token || !row) return;
    const ok = await confirm({ messageKey: "admin.company_application_detail.confirm_approve" });
    if (!ok) return;
    setBusy(true);
    try {
      await apiApproveCompanyApplication(token, row.id);
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : t("admin.pending_review.err_approve"));
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    if (!token || !row) return;
    const rejection_reason = window.prompt(t("admin.company_application_detail.prompt_rejection_reason")) ?? "";
    if (!rejection_reason.trim()) {
      alert(t("admin.company_application_detail.err_rejection_reason_required"));
      return;
    }
    setBusy(true);
    try {
      await apiRejectCompanyApplication(token, row.id, rejection_reason.trim());
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : t("admin.pending_review.err_reject"));
    } finally {
      setBusy(false);
    }
  }

  if (!allowed || forbidden) {
    return (
      <div>
        <h1 className="admin-page-title">{t("admin.company_application_detail.title")}</h1>
        <div className="mt-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  if (err && !row) {
    return (
      <div>
        <p className="text-sm text-red-600">{err}</p>
        <Link href="/platform/company-applications" className="mt-4 inline-block text-sm text-blue-700 underline">
          {t("admin.company_application_detail.back_to_list")}
        </Link>
      </div>
    );
  }

  if (!row) {
    return <p className="text-sm text-slate-600">{t("common.loading")}</p>;
  }

  return (
    <div>
      <V2PageHeader
        breadcrumb={[
          { label: "Home", href: "/dashboard" },
          { label: "Management", href: "/platform/company-applications" },
          { label: t("admin.company_applications.title"), href: "/platform/company-applications" },
          { label: `#${row.id}` },
        ]}
        title={t("admin.company_application_detail.application_number").replace("{id}", String(row.id))}
        subtitle={row.company_name}
        actions={
          canActOnApplication(row.status) ? (
            <>
              <V2Button onClick={() => reject()} disabled={busy} variant="danger">
                {t("admin.pending_review.btn_reject")}
              </V2Button>
              <V2Button onClick={() => approve()} disabled={busy} variant="success">
                {t("admin.pending_review.btn_approve")}
              </V2Button>
            </>
          ) : undefined
        }
      />
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}

      <V2Card className="p-5">
      <dl className="grid max-w-2xl gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase text-slate-700">{t("admin.company_application_detail.label_status")}</dt>
          <dd className="font-medium">{row.status}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-slate-700">{t("admin.company_application_detail.label_company_name")}</dt>
          <dd>{row.company_name}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-slate-700">{t("admin.company_application_detail.label_business_email")}</dt>
          <dd>{row.business_email}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-slate-700">{t("admin.company_application_detail.label_contact")}</dt>
          <dd>
            {row.contact_person} - {row.position}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs uppercase text-slate-700">{t("admin.company_application_detail.label_legal_address")}</dt>
          <dd>{row.legal_address}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs uppercase text-slate-700">{t("admin.company_application_detail.label_actual_address")}</dt>
          <dd>{row.actual_address}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-slate-700">{t("admin.company_application_detail.label_country_city")}</dt>
          <dd>
            {row.country} / {row.city}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-slate-700">{t("admin.company_application_detail.label_phone_tax")}</dt>
          <dd>
            {row.phone} / {row.tax_id}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-slate-700">{t("admin.company_applications.col_submitted")}</dt>
          <dd className="text-slate-600">{row.submitted_at ?? "-"}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-slate-700">{t("admin.company_application_detail.label_reviewed")}</dt>
          <dd className="text-slate-600">
            {row.reviewed_at ?? "-"}
            {row.reviewer ? ` | ${row.reviewer.name}` : ""}
          </dd>
        </div>
        {row.rejection_reason && (
          <div className="sm:col-span-2">
            <dt className="text-xs uppercase text-slate-700">{t("admin.company_application_detail.label_rejection_reason")}</dt>
            <dd>{row.rejection_reason}</dd>
          </div>
        )}
        {row.notes && (
          <div className="sm:col-span-2">
            <dt className="text-xs uppercase text-slate-700">{t("admin.company_application_detail.label_notes")}</dt>
            <dd>{row.notes}</dd>
          </div>
        )}
        <div>
          <dt className="text-xs uppercase text-slate-700">{t("admin.company_application_detail.label_documents")}</dt>
          <dd>
            {t("admin.company_application_detail.label_state_cert")}: {row.state_certificate_path ? t("admin.inventory_hotels.opt_yes") : t("admin.inventory_hotels.opt_no")} | {t("admin.company_application_detail.label_license")}:{" "}
            {row.license_path ? t("admin.inventory_hotels.opt_yes") : t("admin.inventory_hotels.opt_no")}
          </dd>
        </div>
      </dl>
      </V2Card>
    </div>
  );
}
