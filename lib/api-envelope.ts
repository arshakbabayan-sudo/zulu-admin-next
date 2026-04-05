export type ApiListMeta = {
  current_page: number;
  last_page: number;
  total: number;
  per_page: number;
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
