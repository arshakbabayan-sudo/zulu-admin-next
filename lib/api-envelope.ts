export type ApiListMeta = {
  current_page: number;
  last_page: number;
  total: number;
  per_page: number;
  /**
   * Optional full-dataset aggregate counts some list endpoints attach so the
   * caller can render stat cards without a second request (e.g.
   * /platform-admin/unverified-accounts → stale_30d / new_7d / intended_staff).
   * Absent on endpoints that don't compute aggregates — read defensively.
   */
  stats?: Record<string, number>;
};

export type ApiSuccessEnvelope<T> = { success: true; data: T; message?: string };
/** Laravel JSON validation responses may include `errors` (field → messages). */
export type ApiErrorEnvelope = {
  success: false;
  message: string;
  errors?: Record<string, string[]>;
};

export function isApiError(json: unknown): json is ApiErrorEnvelope {
  return (
    typeof json === "object" &&
    json !== null &&
    (json as ApiErrorEnvelope).success === false &&
    typeof (json as ApiErrorEnvelope).message === "string"
  );
}
