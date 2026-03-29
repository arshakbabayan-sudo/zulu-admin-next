import { apiFetchJson } from "./api-client";
import type { ApiListMeta, ApiSuccessEnvelope } from "./api-envelope";

const PA = "/platform-admin";

/** Company onboarding application row (`CompanyApplicationResource`). */
export type CompanyApplicationRow = {
  id: number;
  company_name: string;
  business_email: string;
  legal_address?: string | null;
  actual_address?: string | null;
  country?: string | null;
  city?: string | null;
  phone?: string | null;
  tax_id?: string | null;
  contact_person?: string | null;
  position?: string | null;
  state_certificate_path: boolean;
  license_path: boolean;
  status: string;
  rejection_reason?: string | null;
  notes?: string | null;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  reviewer?: { id: number; name: string } | null;
};

export async function apiCompanyApplications(
  token: string,
  params: { page?: number; status?: string }
): Promise<ApiSuccessEnvelope<CompanyApplicationRow[]> & { meta: ApiListMeta }> {
  const q = new URLSearchParams();
  if (params.page != null) q.set("page", String(params.page));
  if (params.status) q.set("status", params.status);
  const qs = q.toString();
  return apiFetchJson(`${PA}/applications${qs ? `?${qs}` : ""}`, { method: "GET", token });
}

export async function apiCompanyApplication(
  token: string,
  id: number
): Promise<ApiSuccessEnvelope<CompanyApplicationRow>> {
  return apiFetchJson(`${PA}/applications/${id}`, { method: "GET", token });
}

export async function apiApproveCompanyApplication(
  token: string,
  id: number
): Promise<
  ApiSuccessEnvelope<{ company_id: number; user_id: number; message: string }> & { message?: string }
> {
  return apiFetchJson(`${PA}/applications/${id}/approve`, { method: "POST", token, body: {} });
}

export async function apiRejectCompanyApplication(
  token: string,
  id: number,
  rejection_reason: string
): Promise<ApiSuccessEnvelope<{ message: string }> & { message?: string }> {
  return apiFetchJson(`${PA}/applications/${id}/reject`, {
    method: "POST",
    token,
    body: { rejection_reason },
  });
}

/** Platform company list row (`CompanyResource`). */
export type PlatformCompanyRow = {
  id: number;
  name: string;
  type?: string | null;
  status?: string | null;
  legal_name?: string | null;
  slug?: string | null;
  tax_id?: string | null;
  country?: string | null;
  city?: string | null;
  address?: string | null;
  phone?: string | null;
  website?: string | null;
  description?: string | null;
  logo?: string | null;
  governance_status: string;
  is_seller: boolean;
  seller_activated_at?: string | null;
  profile_completed?: boolean;
  active_seller_permissions_count?: number;
  created_at?: string | null;
  updated_at?: string | null;
};

export async function apiPlatformCompanies(
  token: string,
  params: {
    page?: number;
    per_page?: number;
    governance_status?: string;
    is_seller?: boolean;
    search?: string;
    type?: string;
  }
): Promise<ApiSuccessEnvelope<PlatformCompanyRow[]> & { meta: ApiListMeta }> {
  const q = new URLSearchParams();
  if (params.page != null) q.set("page", String(params.page));
  if (params.per_page != null) q.set("per_page", String(params.per_page));
  if (params.governance_status) q.set("governance_status", params.governance_status);
  if (params.is_seller === true) q.set("is_seller", "1");
  if (params.is_seller === false) q.set("is_seller", "0");
  if (params.search) q.set("search", params.search);
  if (params.type) q.set("type", params.type);
  const qs = q.toString();
  return apiFetchJson(`${PA}/companies${qs ? `?${qs}` : ""}`, { method: "GET", token });
}

export async function apiPatchCompanyGovernance(
  token: string,
  companyId: number,
  body: { governance_status: string; reason?: string | null }
): Promise<ApiSuccessEnvelope<PlatformCompanyRow>> {
  return apiFetchJson(`${PA}/companies/${companyId}/governance`, {
    method: "PATCH",
    token,
    body,
  });
}

/** Mirrors `CompanySellerPermission::SERVICE_TYPES` (Laravel). */
export const SELLER_SERVICE_TYPES = [
  "flight",
  "hotel",
  "transfer",
  "package",
  "excursion",
  "car",
  "visa",
] as const;

export type SellerServiceType = (typeof SELLER_SERVICE_TYPES)[number];

export type CompanySellerPermissionApiRow = {
  id: number;
  service_type: string;
  status: string;
  granted_at?: string | null;
  notes?: string | null;
};

/** Super admin may read any company; same payload as company-admin seller matrix. */
export async function apiCompanySellerPermissions(
  token: string,
  companyId: number
): Promise<
  ApiSuccessEnvelope<{
    permissions: CompanySellerPermissionApiRow[];
    applications: unknown[];
  }>
> {
  return apiFetchJson(`/companies/${companyId}/seller-permissions`, { method: "GET", token });
}

export async function apiPatchCompanySellerPermissions(
  token: string,
  companyId: number,
  permissions: string[]
): Promise<
  ApiSuccessEnvelope<{
    company: PlatformCompanyRow;
    active_permissions: string[];
  }> & { message?: string }
> {
  return apiFetchJson(`${PA}/companies/${companyId}/permissions`, {
    method: "PATCH",
    token,
    body: { permissions },
  });
}

export async function apiToggleCompanySeller(
  token: string,
  companyId: number
): Promise<
  ApiSuccessEnvelope<{
    is_seller: boolean;
    company: PlatformCompanyRow;
  }> & { message?: string }
> {
  return apiFetchJson(`${PA}/companies/${companyId}/toggle-seller`, {
    method: "PATCH",
    token,
    body: {},
  });
}

/** Generic approval queue row (`ApprovalResource`). */
export type GenericApprovalRow = {
  id: number;
  entity_type: string;
  entity_id: number;
  status: string;
  notes?: string | null;
  decision_notes?: string | null;
  priority?: string | null;
  approved_at?: string | null;
  reviewed_at?: string | null;
  created_at?: string | null;
  requested_by?: { id: number; name: string; email: string } | null;
  approved_by_user?: { id: number; name: string; email: string } | null;
  reviewed_by_user?: { id: number; name: string; email: string } | null;
};

export async function apiPlatformApprovals(
  token: string,
  params: { page?: number; per_page?: number; status?: string; entity_type?: string }
): Promise<ApiSuccessEnvelope<GenericApprovalRow[]> & { meta: ApiListMeta }> {
  const q = new URLSearchParams();
  if (params.page != null) q.set("page", String(params.page));
  if (params.per_page != null) q.set("per_page", String(params.per_page));
  if (params.status) q.set("status", params.status);
  if (params.entity_type) q.set("entity_type", params.entity_type);
  const qs = q.toString();
  return apiFetchJson(`${PA}/approvals${qs ? `?${qs}` : ""}`, { method: "GET", token });
}

export async function apiApproveGenericApproval(
  token: string,
  approvalId: number,
  decision_notes?: string | null
): Promise<ApiSuccessEnvelope<GenericApprovalRow>> {
  return apiFetchJson(`${PA}/approvals/${approvalId}/approve`, {
    method: "POST",
    token,
    body: decision_notes ? { decision_notes } : {},
  });
}

export async function apiRejectGenericApproval(
  token: string,
  approvalId: number,
  decision_notes?: string | null
): Promise<ApiSuccessEnvelope<GenericApprovalRow>> {
  return apiFetchJson(`${PA}/approvals/${approvalId}/reject`, {
    method: "POST",
    token,
    body: decision_notes ? { decision_notes } : {},
  });
}

export type PlatformStats = Record<string, number>;

export async function apiPlatformStats(
  token: string
): Promise<ApiSuccessEnvelope<PlatformStats>> {
  return apiFetchJson(`${PA}/stats`, { method: "GET", token });
}

export type PlatformAdminUserRow = {
  id: number;
  name: string;
  email: string;
  status: string;
  created_at?: string | null;
  updated_at?: string | null;
  companies: { id: number; name: string; role: string }[];
};

export async function apiPlatformUsers(
  token: string,
  params: { page?: number; per_page?: number; search?: string; status?: string }
): Promise<ApiSuccessEnvelope<PlatformAdminUserRow[]> & { meta: ApiListMeta }> {
  const q = new URLSearchParams();
  if (params.page != null) q.set("page", String(params.page));
  if (params.per_page != null) q.set("per_page", String(params.per_page));
  if (params.search) q.set("search", params.search);
  if (params.status) q.set("status", params.status);
  const qs = q.toString();
  return apiFetchJson(`${PA}/users${qs ? `?${qs}` : ""}`, { method: "GET", token });
}

export async function apiDeactivatePlatformUser(
  token: string,
  id: number
): Promise<ApiSuccessEnvelope<{ message: string; user: PlatformAdminUserRow }> & { message?: string }> {
  return apiFetchJson(`${PA}/users/${id}/deactivate`, { method: "PATCH", token, body: {} });
}

export type SellerApplicationRow = {
  id: number;
  company_id: number;
  company_name?: string | null;
  service_type: string;
  status: string;
  rejection_reason?: string | null;
  notes?: string | null;
  applied_at?: string | null;
  reviewed_at?: string | null;
  reviewed_by?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export async function apiSellerApplications(
  token: string,
  params: { page?: number; per_page?: number; status?: string }
): Promise<ApiSuccessEnvelope<SellerApplicationRow[]> & { meta: ApiListMeta }> {
  const q = new URLSearchParams();
  if (params.page != null) q.set("page", String(params.page));
  if (params.per_page != null) q.set("per_page", String(params.per_page));
  if (params.status !== undefined) q.set("status", params.status);
  const qs = q.toString();
  return apiFetchJson(`${PA}/seller-applications${qs ? `?${qs}` : ""}`, { method: "GET", token });
}

export async function apiApproveSellerApplication(
  token: string,
  id: number,
  notes?: string
): Promise<
  ApiSuccessEnvelope<{ message: string; application: SellerApplicationRow }> & { message?: string }
> {
  return apiFetchJson(`${PA}/seller-applications/${id}/approve`, {
    method: "POST",
    token,
    body: notes ? { notes } : {},
  });
}

export async function apiRejectSellerApplication(
  token: string,
  id: number,
  rejection_reason: string
): Promise<
  ApiSuccessEnvelope<{ message: string; application: SellerApplicationRow }> & { message?: string }
> {
  return apiFetchJson(`${PA}/seller-applications/${id}/reject`, {
    method: "POST",
    token,
    body: { rejection_reason },
  });
}

export type PlatformSettingRow = {
  id: number;
  key: string;
  value: string;
  type: string;
  description?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export async function apiPlatformSettings(
  token: string
): Promise<ApiSuccessEnvelope<PlatformSettingRow[]>> {
  return apiFetchJson(`${PA}/settings`, { method: "GET", token });
}

export async function apiPatchPlatformSetting(
  token: string,
  key: string,
  value: string
): Promise<ApiSuccessEnvelope<PlatformSettingRow> & { message?: string }> {
  const enc = encodeURIComponent(key);
  return apiFetchJson(`${PA}/settings/${enc}`, {
    method: "PATCH",
    token,
    body: { value },
  });
}

export type PlatformReviewRow = {
  id: number;
  rating: number;
  review_text?: string | null;
  status: string;
  target_entity_type: string;
  target_entity_id: number;
  moderation_notes?: string | null;
  created_at?: string | null;
  user?: { id: number; name: string };
};

export async function apiPlatformReviews(
  token: string,
  params: {
    page?: number;
    per_page?: number;
    status?: string;
    entity_type?: string;
    user_id?: number;
  }
): Promise<ApiSuccessEnvelope<PlatformReviewRow[]> & { meta: ApiListMeta }> {
  const q = new URLSearchParams();
  if (params.page != null) q.set("page", String(params.page));
  if (params.per_page != null) q.set("per_page", String(params.per_page));
  if (params.status) q.set("status", params.status);
  if (params.entity_type) q.set("entity_type", params.entity_type);
  if (params.user_id != null) q.set("user_id", String(params.user_id));
  const qs = q.toString();
  return apiFetchJson(`${PA}/reviews${qs ? `?${qs}` : ""}`, { method: "GET", token });
}

export async function apiModerateReview(
  token: string,
  reviewId: number,
  body: { status: "published" | "hidden" | "rejected"; notes?: string | null }
): Promise<ApiSuccessEnvelope<PlatformReviewRow> & { message?: string }> {
  return apiFetchJson(`${PA}/reviews/${reviewId}/moderate`, {
    method: "POST",
    token,
    body,
  });
}

export type PlatformPaymentRow = {
  id: number;
  invoice_id?: number | null;
  amount: number;
  currency: string;
  status: string;
  payment_method?: string | null;
  paid_at?: string | null;
  reference_code?: string | null;
  created_at?: string | null;
  invoice?: {
    id: number;
    total_amount: number;
    status: string;
    unique_booking_reference?: string | null;
  };
};

export async function apiPlatformPayments(
  token: string,
  params: { page?: number; per_page?: number; status?: string }
): Promise<ApiSuccessEnvelope<PlatformPaymentRow[]> & { meta: ApiListMeta }> {
  const q = new URLSearchParams();
  if (params.page != null) q.set("page", String(params.page));
  if (params.per_page != null) q.set("per_page", String(params.per_page));
  if (params.status) q.set("status", params.status);
  const qs = q.toString();
  return apiFetchJson(`${PA}/payments${qs ? `?${qs}` : ""}`, { method: "GET", token });
}

export async function apiOperatorStatistics(
  token: string,
  companyId?: number | null
): Promise<ApiSuccessEnvelope<unknown>> {
  const q = new URLSearchParams();
  if (companyId != null && companyId > 0) q.set("company_id", String(companyId));
  const qs = q.toString();
  return apiFetchJson(`/operator/statistics${qs ? `?${qs}` : ""}`, { method: "GET", token });
}

/** Platform package order row (`PackageOrderResource` with `package`, `user`, `company` eager-loaded). */
export type PlatformPackageOrderRow = {
  id: number;
  package_id: number;
  user_id: number;
  company_id: number;
  order_number: string;
  booking_channel?: string | null;
  status: string;
  payment_status: string;
  adults_count: number;
  children_count: number;
  infants_count: number;
  currency: string;
  final_total_snapshot: number;
  created_at?: string | null;
  updated_at?: string | null;
  package?: {
    id: number;
    package_type: string;
    package_title: string;
    destination_city?: string | null;
    destination_country?: string | null;
    duration_days?: number | null;
    status: string;
  };
  user?: { id: number; name: string; email: string };
  company?: { id: number; name: string; slug?: string | null };
};

export async function apiPlatformPackageOrders(
  token: string,
  params: {
    page?: number;
    per_page?: number;
    status?: string;
    payment_status?: string;
    company_id?: number;
  }
): Promise<ApiSuccessEnvelope<PlatformPackageOrderRow[]> & { meta: ApiListMeta }> {
  const q = new URLSearchParams();
  if (params.page != null) q.set("page", String(params.page));
  if (params.per_page != null) q.set("per_page", String(params.per_page));
  if (params.status) q.set("status", params.status);
  if (params.payment_status) q.set("payment_status", params.payment_status);
  if (params.company_id != null && params.company_id > 0) {
    q.set("company_id", String(params.company_id));
  }
  const qs = q.toString();
  return apiFetchJson(`${PA}/package-orders${qs ? `?${qs}` : ""}`, { method: "GET", token });
}

/** `PlatformAdminService::getFinanceSummary()` payload. */
export type PlatformFinanceSummary = {
  total_payments_paid: number;
  total_commission_accrued: number;
  total_commission_pending: number;
  payments_count_paid: number;
  commission_records_count: number;
};

export async function apiPlatformFinanceSummary(
  token: string
): Promise<ApiSuccessEnvelope<PlatformFinanceSummary>> {
  return apiFetchJson(`${PA}/finance-summary`, { method: "GET", token });
}

/** Platform packages governance row (`PackageResource` with `offer`, `company` eager-loaded). */
export type PlatformGovernancePackageRow = {
  id: number;
  offer_id?: number | null;
  company_id: number;
  package_type: string;
  package_title: string;
  destination_country?: string | null;
  destination_city?: string | null;
  duration_days?: number | null;
  currency: string;
  status: string;
  is_public: boolean;
  is_bookable: boolean;
  created_at?: string | null;
  updated_at?: string | null;
  offer?: {
    id: number;
    title: string;
    price: number | null;
    currency: string;
    status: string;
  } | null;
  company?: { id: number; name: string; slug?: string | null };
};

export async function apiPlatformPackages(
  token: string,
  params: {
    page?: number;
    per_page?: number;
    status?: string;
    company_id?: number;
  }
): Promise<ApiSuccessEnvelope<PlatformGovernancePackageRow[]> & { meta: ApiListMeta }> {
  const q = new URLSearchParams();
  if (params.page != null) q.set("page", String(params.page));
  if (params.per_page != null) q.set("per_page", String(params.per_page));
  if (params.status) q.set("status", params.status);
  if (params.company_id != null && params.company_id > 0) {
    q.set("company_id", String(params.company_id));
  }
  const qs = q.toString();
  return apiFetchJson(`${PA}/packages${qs ? `?${qs}` : ""}`, { method: "GET", token });
}

export async function apiDeactivatePlatformPackage(
  token: string,
  packageId: number,
  reason?: string | null
): Promise<ApiSuccessEnvelope<PlatformGovernancePackageRow>> {
  return apiFetchJson(`${PA}/packages/${packageId}/deactivate`, {
    method: "POST",
    token,
    body: reason ? { reason } : {},
  });
}

export type PlatformBannerRow = {
  id: number;
  image_path?: string | null;
  image_url?: string | null;
  title_en?: string | null;
  title_ru?: string | null;
  title_hy?: string | null;
  link_url?: string | null;
  sort_order: number;
  is_active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

export async function apiPlatformBanners(
  token: string
): Promise<ApiSuccessEnvelope<PlatformBannerRow[]>> {
  return apiFetchJson(`${PA}/banners`, { method: "GET", token });
}

export async function apiCreatePlatformBanner(
  token: string,
  formData: FormData
): Promise<ApiSuccessEnvelope<PlatformBannerRow> & { message?: string }> {
  return apiFetchJson(`${PA}/banners`, { method: "POST", token, body: formData });
}

export async function apiUpdatePlatformBanner(
  token: string,
  bannerId: number,
  formData: FormData
): Promise<ApiSuccessEnvelope<PlatformBannerRow> & { message?: string }> {
  return apiFetchJson(`${PA}/banners/${bannerId}`, {
    method: "PATCH",
    token,
    body: formData,
  });
}

export async function apiDeletePlatformBanner(
  token: string,
  bannerId: number
): Promise<ApiSuccessEnvelope<{ id: number }> & { message?: string }> {
  return apiFetchJson(`${PA}/banners/${bannerId}`, { method: "DELETE", token });
}
