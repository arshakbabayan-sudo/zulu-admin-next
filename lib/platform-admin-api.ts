import { apiFetchJson } from "./api-client";
import type { ApiListMeta, ApiSuccessEnvelope } from "./api-envelope";

const PA = "/platform-admin";

/**
 * Brand settings — single document stored in platform_settings.brand_settings (JSON).
 * Mixes reserved imagery/contact/social keys with an open custom_fields[] list.
 */
export type BrandCustomField = {
  key: string;
  label: string;
  type: "text" | "url" | "email" | "phone" | "image" | "tel";
  value: string | null;
};

export type BrandSettings = {
  logo_url: string | null;
  emblem_url: string | null;
  favicon_url: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  address_city: string | null;
  address_country: string | null;
  social_links: Record<string, string | null>;
  custom_fields: BrandCustomField[];
};

export const BRAND_SOCIAL_PLATFORMS: Array<{ key: string; label: string }> = [
  { key: "facebook", label: "Facebook" },
  { key: "instagram", label: "Instagram" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "tiktok", label: "TikTok" },
  { key: "youtube", label: "YouTube" },
  { key: "telegram", label: "Telegram" },
  { key: "whatsapp", label: "WhatsApp" },
];

export async function apiBrandSettings(): Promise<ApiSuccessEnvelope<BrandSettings>> {
  return apiFetchJson("/brand-settings", { method: "GET" });
}

export async function apiPatchBrandSettings(
  token: string,
  body: Partial<BrandSettings>
): Promise<ApiSuccessEnvelope<BrandSettings>> {
  return apiFetchJson(`${PA}/brand-settings`, {
    method: "PATCH",
    token,
    body: body as Record<string, unknown>,
  });
}

export type HeaderMenuAdminRow = {
  id: number;
  parent_id: number | null;
  label_en: string;
  label_ru: string | null;
  label_hy: string | null;
  url: string;
  position: number;
  is_visible: boolean;
  icon: string | null;
  open_in_new_tab: boolean;
};

export async function apiAdminHeaderMenu(
  token: string
): Promise<ApiSuccessEnvelope<{ items: HeaderMenuAdminRow[] }>> {
  return apiFetchJson(`${PA}/header-menu`, { method: "GET", token });
}

export async function apiSyncHeaderMenu(
  token: string,
  items: Array<Omit<HeaderMenuAdminRow, "id"> & { id?: number | string | null }>
): Promise<ApiSuccessEnvelope<{ items: HeaderMenuAdminRow[] }>> {
  return apiFetchJson(`${PA}/header-menu`, {
    method: "PUT",
    token,
    body: { items },
  });
}

export type FooterLinkAdminRow = {
  id: number;
  column_id: number;
  label_en: string;
  label_ru: string | null;
  label_hy: string | null;
  url: string;
  position: number;
  is_visible: boolean;
  open_in_new_tab: boolean;
};

export type FooterColumnAdminRow = {
  id: number;
  slug: string;
  title_en: string;
  title_ru: string | null;
  title_hy: string | null;
  position: number;
  is_visible: boolean;
  links: FooterLinkAdminRow[];
};

export async function apiAdminFooter(
  token: string
): Promise<ApiSuccessEnvelope<{ columns: FooterColumnAdminRow[] }>> {
  return apiFetchJson(`${PA}/footer`, { method: "GET", token });
}

export type FooterSyncColumnPayload = {
  id?: number | null;
  slug?: string | null;
  title_en: string;
  title_ru: string | null;
  title_hy: string | null;
  position: number;
  is_visible: boolean;
  links: Array<{
    id?: number | null;
    label_en: string;
    label_ru: string | null;
    label_hy: string | null;
    url: string;
    position: number;
    is_visible: boolean;
    open_in_new_tab: boolean;
  }>;
};

export async function apiSyncFooter(
  token: string,
  columns: FooterSyncColumnPayload[]
): Promise<ApiSuccessEnvelope<{ columns: FooterColumnAdminRow[] }>> {
  return apiFetchJson(`${PA}/footer`, {
    method: "PUT",
    token,
    body: { columns },
  });
}


/** Company onboarding application row (`CompanyApplicationResource`). */
export type CompanyApplicationRow = {
  id: number;
  user_id?: number | null;
  user?: {
    id: number;
    name?: string | null;
    email?: string | null;
    intended_role?: "operator" | "agent" | null;
  } | null;
  company_name: string;
  company_type?: "agent" | "operator" | null;
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
  params: { page?: number; status?: string; company_id?: number }
): Promise<ApiSuccessEnvelope<CompanyApplicationRow[]> & { meta: ApiListMeta }> {
  const q = new URLSearchParams();
  if (params.page != null) q.set("page", String(params.page));
  if (params.status) q.set("status", params.status);
  // 2026-06-03 `9cc8e36` — applications can now be filtered by company_id,
  // used by the Companies detail page's Applications tab.
  if (params.company_id != null) q.set("company_id", String(params.company_id));
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
  // `status` (free-text active/pending/suspended) was dropped from
  // `companies` 2026-06-03 (backend `9cc8e36`). Use `governance_status` —
  // it's the single source of truth now.
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
  is_partner_visible?: boolean;
  governance_status: string;
  is_seller: boolean;
  seller_activated_at?: string | null;
  profile_completed?: boolean;
  active_seller_permissions_count?: number;
  created_at?: string | null;
  updated_at?: string | null;
  // Phase 7.2 — admin archive markers
  archived_at?: string | null;
  archived_by_user_id?: number | null;
  archived_reason?: string | null;
  // Stripe Connect status (exposed by CompanyResource since `9cc8e36` —
  // 2026-06-03). Drives the "Payments-ready" column on the list.
  stripe_connect_id?: string | null;
  stripe_charges_enabled?: boolean | null;
  stripe_payouts_enabled?: boolean | null;
  stripe_details_submitted?: boolean | null;
};

export type CompanyArchiveFilter = "active" | "archived" | "all";

export async function apiPlatformCompany(
  token: string,
  companyId: number
): Promise<ApiSuccessEnvelope<PlatformCompanyRow>> {
  return apiFetchJson(`${PA}/companies/${companyId}`, { method: "GET", token });
}

export async function apiPlatformCompanies(
  token: string,
  params: {
    page?: number;
    per_page?: number;
    governance_status?: string;
    is_seller?: boolean;
    search?: string;
    type?: string;
    sort_by?: string;
    sort_dir?: "asc" | "desc";
    archive_filter?: CompanyArchiveFilter;
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
  if (params.sort_by) q.set("sort_by", params.sort_by);
  if (params.sort_dir) q.set("sort_dir", params.sort_dir);
  if (params.archive_filter) q.set("archive_filter", params.archive_filter);
  const qs = q.toString();
  return apiFetchJson(`${PA}/companies${qs ? `?${qs}` : ""}`, { method: "GET", token });
}

/** Phase 7.2 — super-admin only. Reason required (min 3, max 500 chars). */
export async function apiArchiveCompany(
  token: string,
  companyId: number,
  reason: string
): Promise<ApiSuccessEnvelope<{ id: number }>> {
  return apiFetchJson(`${PA}/companies/${companyId}/archive`, {
    method: "POST",
    token,
    body: { reason },
  });
}

/** Phase 7.2 — super-admin only. */
export async function apiRestoreCompany(
  token: string,
  companyId: number
): Promise<ApiSuccessEnvelope<{ id: number }>> {
  return apiFetchJson(`${PA}/companies/${companyId}/restore`, {
    method: "POST",
    token,
    body: {},
  });
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

// ─── Country permissions (multi-country seller licenses) ─────────────────
export type CompanyCountryPermissionApiRow = {
  id: number;
  country_code: string;
  country_name: string;
  status: "active" | "revoked";
  granted_at?: string | null;
  notes?: string | null;
};

export async function apiCompanyCountryPermissions(
  token: string,
  companyId: number
): Promise<
  ApiSuccessEnvelope<{
    home_country: string | null;
    permissions: CompanyCountryPermissionApiRow[];
  }>
> {
  return apiFetchJson(`/companies/${companyId}/country-permissions`, { method: "GET", token });
}

export async function apiSyncCompanyCountryPermissions(
  token: string,
  companyId: number,
  countries: Array<{ country_code: string; country_name: string }>
): Promise<
  ApiSuccessEnvelope<{
    home_country: string | null;
    permissions: CompanyCountryPermissionApiRow[];
  }>
> {
  return apiFetchJson(`/companies/${companyId}/country-permissions`, {
    method: "PATCH",
    token,
    body: { countries },
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

export async function apiPatchCompanyPartnerSettings(
  token: string,
  companyId: number,
  body: { logo?: string | null; is_partner_visible?: boolean }
): Promise<ApiSuccessEnvelope<PlatformCompanyRow>> {
  return apiFetchJson(`${PA}/companies/${companyId}/partner-settings`, {
    method: "PATCH",
    token,
    body,
  });
}

/**
 * 2026-06-03 backend `9cc8e36` — PATCH `/platform-admin/companies/{id}/profile`.
 * Admin edits the company's identity/contact fields (NOT governance, NOT
 * partner toggle — those have their own endpoints). Ownership-gated.
 */
export type CompanyProfileEditable = {
  name?: string;
  legal_name?: string | null;
  type?: string | null;
  tax_id?: string | null;
  country?: string | null;
  city?: string | null;
  address?: string | null;
  phone?: string | null;
  website?: string | null;
  description?: string | null;
};

export async function apiPatchCompanyProfile(
  token: string,
  companyId: number,
  body: CompanyProfileEditable
): Promise<ApiSuccessEnvelope<PlatformCompanyRow>> {
  return apiFetchJson(`${PA}/companies/${companyId}/profile`, {
    method: "PATCH",
    token,
    body,
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

/**
 * Marketplace ops v2 (2026-05-26) — Users page 4-stat-card row.
 *
 * Backend: PlatformAdminController::userStats (Phase Զ.16).
 *   GET /api/platform-admin/users/stats
 *     → { total, active_today, new_7d, pending_verification }
 */
export type PlatformUsersStats = {
  total: number;
  active_today: number;
  new_7d: number;
  pending_verification: number;
};

export async function apiPlatformUsersStats(
  token: string
): Promise<ApiSuccessEnvelope<PlatformUsersStats>> {
  return apiFetchJson(`${PA}/users/stats`, { method: "GET", token });
}

export type PlatformAdminUserRow = {
  id: number;
  name: string;
  email: string;
  status: string;
  created_at?: string | null;
  updated_at?: string | null;
  /**
   * Phase 2 follow-up shipped 2026-05-24 (backend commit 138e19c). ISO timestamp
   * of the user's most recent successful login. May be null for users who have
   * never logged in (newly-created accounts, invitations-only, etc.).
   */
  last_login_at?: string | null;
  /**
   * Phase 4C+ (2026-05-31) — bookings count surfaced for the Directory
   * People B2C-customers column. Backend uses withCount('orders'); zero
   * for staff/agent rows (they don't own customer orders). Optional for
   * back-compat with consumers that haven't refreshed types yet.
   */
  bookings_count?: number;
  companies: { id: number; name: string; role: string }[];
};

/** Phase 6.4 — type filter merges customers / staff / unverified into one users page. */
export type PlatformUserTypeFilter = "" | "customers" | "staff" | "unverified";

export async function apiPlatformUsers(
  token: string,
  params: {
    page?: number;
    per_page?: number;
    search?: string;
    status?: string;
    type?: PlatformUserTypeFilter;
  }
): Promise<ApiSuccessEnvelope<PlatformAdminUserRow[]> & { meta: ApiListMeta }> {
  const q = new URLSearchParams();
  if (params.page != null) q.set("page", String(params.page));
  if (params.per_page != null) q.set("per_page", String(params.per_page));
  if (params.search) q.set("search", params.search);
  if (params.status) q.set("status", params.status);
  if (params.type) q.set("type", params.type);
  const qs = q.toString();
  return apiFetchJson(`${PA}/users${qs ? `?${qs}` : ""}`, { method: "GET", token });
}

export async function apiDeactivatePlatformUser(
  token: string,
  id: number
): Promise<ApiSuccessEnvelope<{ message: string; user: PlatformAdminUserRow }> & { message?: string }> {
  return apiFetchJson(`${PA}/users/${id}/deactivate`, { method: "PATCH", token, body: {} });
}

/** Phase Բ.3 — bulk resend email-verification reminders to unverified users. */
export async function apiBulkRemindUsers(
  token: string,
  ids: number[]
): Promise<ApiSuccessEnvelope<{ reminded: number; skipped: number }> & { message?: string }> {
  return apiFetchJson(`${PA}/users/bulk-remind`, { method: "POST", token, body: { ids } });
}

/** Phase Բ.3 — bulk anonymize (reversible-safe) users. */
export async function apiBulkDeleteUsers(
  token: string,
  ids: number[],
  reason?: string
): Promise<ApiSuccessEnvelope<{ processed: number; skipped: number }> & { message?: string }> {
  return apiFetchJson(`${PA}/users/bulk-delete`, { method: "POST", token, body: { ids, reason } });
}

/** Phase 7.1 — "Ջնջել" default action: anonymise PII + soft-delete. */
export async function apiAnonymizePlatformUser(
  token: string,
  id: number,
  reason?: string | null
): Promise<ApiSuccessEnvelope<{ id: number }>> {
  return apiFetchJson(`${PA}/users/${id}/anonymize`, {
    method: "POST",
    token,
    body: { reason: reason ?? null },
  });
}

/** Phase 7.1 — "Ամբողջությամբ ջնջել" super-admin action: force-delete row. */
export async function apiHardDeletePlatformUser(
  token: string,
  id: number,
  reason: string
): Promise<ApiSuccessEnvelope<null>> {
  return apiFetchJson(`${PA}/users/${id}/hard`, {
    method: "DELETE",
    token,
    body: { reason },
  });
}

export type PlatformAdminUserDetail = PlatformAdminUserRow & {
  phone: string | null;
  preferred_language: string | null;
  avatar: string | null;
  birth_date: string | null;
  nationality: string | null;
  is_super_admin: boolean;
};

export async function apiShowPlatformUser(
  token: string,
  id: number
): Promise<ApiSuccessEnvelope<PlatformAdminUserDetail>> {
  return apiFetchJson(`${PA}/users/${id}`, { method: "GET", token });
}

export type UpdatePlatformUserInput = {
  name?: string;
  phone?: string | null;
  preferred_language?: string | null;
  birth_date?: string | null;
  nationality?: string | null;
  status?: string;
};

export async function apiUpdatePlatformUser(
  token: string,
  id: number,
  input: UpdatePlatformUserInput
): Promise<ApiSuccessEnvelope<PlatformAdminUserDetail>> {
  return apiFetchJson(`${PA}/users/${id}`, { method: "PATCH", token, body: input });
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
    /** Finance group v2 — surfaced via invoice.order eager-load. */
    order_id?: number;
    company?: { id: number; name: string };
    agent_company?: { id: number; name: string };
  };
};

export async function apiPlatformPayments(
  token: string,
  params: { page?: number; per_page?: number; status?: string; from?: string; to?: string }
): Promise<ApiSuccessEnvelope<PlatformPaymentRow[]> & { meta: ApiListMeta }> {
  const q = new URLSearchParams();
  if (params.page != null) q.set("page", String(params.page));
  if (params.per_page != null) q.set("per_page", String(params.per_page));
  if (params.status) q.set("status", params.status);
  if (params.from) q.set("from", params.from);
  if (params.to) q.set("to", params.to);
  const qs = q.toString();
  return apiFetchJson(`${PA}/payments${qs ? `?${qs}` : ""}`, { method: "GET", token });
}

/** Phase 7.7 — CSV export for /platform/payments with same filters. */
export async function downloadPaymentsCsv(
  token: string,
  params: { status?: string; from?: string; to?: string }
): Promise<void> {
  const q = new URLSearchParams();
  if (params.status) q.set("status", params.status);
  if (params.from) q.set("from", params.from);
  if (params.to) q.set("to", params.to);
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8008/api";
  const url = `${base}/platform-admin/payments/export${q.toString() ? `?${q.toString()}` : ""}`;
  const resp = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}`, Accept: "text/csv" },
  });
  if (!resp.ok) throw new Error(`Export failed: HTTP ${resp.status}`);
  const blob = await resp.blob();
  const filename =
    resp.headers.get("Content-Disposition")?.match(/filename="?([^"]+)"?/)?.[1] ??
    `payments-${new Date().toISOString().slice(0, 10)}.csv`;
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(objectUrl);
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

export type PackageHomepageFeatureSlug = "special_offers" | "popular_destinations";

export type PackageHomepageFeatureRow = {
  section_slug: PackageHomepageFeatureSlug;
  position: number;
  is_active: boolean;
};

export type PackageHomepageFeaturesPayload = {
  package_id: number;
  sections: PackageHomepageFeatureSlug[];
  features: PackageHomepageFeatureRow[];
};

export async function apiGetPackageHomepageFeatures(
  token: string,
  packageId: number
): Promise<ApiSuccessEnvelope<PackageHomepageFeaturesPayload>> {
  return apiFetchJson(`${PA}/packages/${packageId}/homepage-features`, {
    method: "GET",
    token,
  });
}

export async function apiSyncPackageHomepageFeatures(
  token: string,
  packageId: number,
  features: PackageHomepageFeatureRow[]
): Promise<ApiSuccessEnvelope<PackageHomepageFeaturesPayload>> {
  return apiFetchJson(`${PA}/packages/${packageId}/homepage-features`, {
    method: "PUT",
    token,
    body: { features },
  });
}

export type NewsletterSubscriptionRow = {
  id: number;
  email: string;
  lang: string | null;
  source: string | null;
  subscribed_at: string | null;
  unsubscribed_at: string | null;
  ip: string | null;
};

export type NewsletterStats = {
  total_active: number;
  by_lang: Record<string, number>;
  by_source: Record<string, number>;
};

export async function apiNewsletterSubscriptions(
  token: string,
  params: {
    page?: number;
    per_page?: number;
    source?: string;
    lang?: string;
    search?: string;
    active_only?: boolean;
  }
): Promise<
  ApiSuccessEnvelope<NewsletterSubscriptionRow[]> & {
    meta: { current_page: number; per_page: number; total: number; last_page: number };
  }
> {
  const q = new URLSearchParams();
  if (params.page != null) q.set("page", String(params.page));
  if (params.per_page != null) q.set("per_page", String(params.per_page));
  if (params.source) q.set("source", params.source);
  if (params.lang) q.set("lang", params.lang);
  if (params.search) q.set("search", params.search);
  if (params.active_only !== undefined) q.set("active_only", params.active_only ? "1" : "0");
  const qs = q.toString();
  return apiFetchJson(`${PA}/newsletter/subscriptions${qs ? `?${qs}` : ""}`, {
    method: "GET",
    token,
  });
}

export async function apiNewsletterStats(
  token: string
): Promise<ApiSuccessEnvelope<NewsletterStats>> {
  return apiFetchJson(`${PA}/newsletter/subscriptions/stats`, { method: "GET", token });
}

export async function apiDeleteNewsletterSubscription(
  token: string,
  id: number
): Promise<ApiSuccessEnvelope<unknown>> {
  return apiFetchJson(`${PA}/newsletter/subscriptions/${id}`, { method: "DELETE", token });
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

/** Phase 7.8 — bulk delete multiple banners in one call. */
export async function apiBulkDeleteBanners(
  token: string,
  ids: number[]
): Promise<ApiSuccessEnvelope<{ deleted_count: number; requested_count: number }>> {
  return apiFetchJson(`${PA}/banners/bulk-delete`, {
    method: "POST",
    token,
    body: { ids },
  });
}

/** Phase 7.8 — persist new sort order from drag&drop reorder. */
export async function apiReorderBanners(
  token: string,
  orderedIds: number[]
): Promise<ApiSuccessEnvelope<{ count: number }>> {
  return apiFetchJson(`${PA}/banners/reorder`, {
    method: "POST",
    token,
    body: { ordered_ids: orderedIds },
  });
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

// ─── Offers review queue (Option 2 publishing workflow) ───────────────────
export type PendingReviewOfferRow = {
  id: number;
  type: string;
  title: string;
  status: string;
  company_id: number | null;
  submitted_for_review_at?: string | null;
  reviewed_at?: string | null;
  reviewed_by?: number | null;
  rejection_reason?: string | null;
  company?: { id: number; name: string; country?: string | null } | null;
  created_at?: string | null;
};

export async function apiPendingReviewOffers(
  token: string,
  params: { page?: number; per_page?: number; type?: string; company_id?: number; q?: string } = {}
): Promise<ApiSuccessEnvelope<PendingReviewOfferRow[]> & { meta: ApiListMeta }> {
  const q = new URLSearchParams();
  if (params.page) q.set("page", String(params.page));
  if (params.per_page) q.set("per_page", String(params.per_page));
  if (params.type) q.set("type", params.type);
  if (params.company_id) q.set("company_id", String(params.company_id));
  if (params.q) q.set("q", params.q);
  const qs = q.toString();
  return apiFetchJson(`/admin/offers/pending-review${qs ? `?${qs}` : ""}`, { method: "GET", token });
}

export async function apiApproveOffer(
  token: string,
  offerId: number
): Promise<ApiSuccessEnvelope<{ id: number; status: string }>> {
  return apiFetchJson(`/admin/offers/${offerId}/approve`, { method: "POST", token, body: {} });
}

/** Phase 7.5 — bulk-approve multiple pending-review offers in one call. */
export type BulkApproveResult = {
  approved_count: number;
  total: number;
  results: Array<{ id: number; status: "approved" | "failed" | "not_found"; error?: string }>;
};

export async function apiBulkApproveOffers(
  token: string,
  ids: number[]
): Promise<ApiSuccessEnvelope<BulkApproveResult>> {
  return apiFetchJson(`/admin/offers/bulk-approve`, {
    method: "POST",
    token,
    body: { ids },
  });
}

export async function apiRejectOffer(
  token: string,
  offerId: number,
  reason: string
): Promise<ApiSuccessEnvelope<{ id: number; status: string }>> {
  return apiFetchJson(`/admin/offers/${offerId}/reject`, {
    method: "POST",
    token,
    body: { reason },
  });
}

// Operator-side: submit own draft/rejected offer for super-admin review.
export async function apiSubmitOfferForReview(
  token: string,
  offerId: number
): Promise<ApiSuccessEnvelope<{ id: number; status: string }>> {
  return apiFetchJson(`/offers/${offerId}/submit-for-review`, { method: "POST", token, body: {} });
}
