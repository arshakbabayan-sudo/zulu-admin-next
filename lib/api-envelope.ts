export type ApiListMeta = {
  current_page: number;
  last_page: number;
  total: number;
  per_page: number;
};

export type ApiSuccessEnvelope<T> = { success: true; data: T; message?: string };
export type ApiErrorEnvelope = { success: false; message: string };

export function isApiError(json: unknown): json is ApiErrorEnvelope {
  return (
    typeof json === "object" &&
    json !== null &&
    (json as ApiErrorEnvelope).success === false &&
    typeof (json as ApiErrorEnvelope).message === "string"
  );
}
