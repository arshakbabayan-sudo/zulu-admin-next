/**
 * File manager API client — wraps /api/files/* endpoints.
 *
 * Backend lives in `backend/app/Http/Controllers/Api/FileAssetController.php`
 * (added Phase Ե, 2026-05-25). Bytes are stored on Laravel's default disk
 * (env FILESYSTEM_DISK; default `local`). We migrate to S3 later by swapping
 * the env var — the API surface stays the same.
 */

import { getApiBaseUrl } from "./api-base";
import { apiFetchJson, ApiRequestError } from "./api-client";
import type { ApiSuccessEnvelope } from "./api-envelope";

export type FileVisibility = "private" | "company" | "public";

export type FileAssetRow = {
  id: number;
  uploaded_by: number;
  company_id: number | null;
  folder: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  visibility: FileVisibility;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
  updated_at: string | null;
};

export type FolderSummary = {
  folder: string;
  name: string;
  file_count: number;
  total_bytes: number;
};

export type FilesListData = {
  folder: string;
  files: FileAssetRow[];
  subfolders: FolderSummary[];
};

export type MimeBucket = "image" | "application" | "video" | "audio" | "text" | "other";

export type StorageStats = {
  total_bytes: number;
  total_count: number;
  quota_bytes: number;
  by_bucket: Record<MimeBucket, { count: number; bytes: number }>;
};

/** GET /files?folder=...&company_id=... */
export async function apiFilesList(
  token: string,
  opts: { folder?: string; company_id?: number } = {}
): Promise<ApiSuccessEnvelope<FilesListData>> {
  const q = new URLSearchParams();
  if (opts.folder) q.set("folder", opts.folder);
  if (opts.company_id != null) q.set("company_id", String(opts.company_id));
  const qs = q.toString();
  return apiFetchJson(`/files${qs ? `?${qs}` : ""}`, { method: "GET", token });
}

/**
 * Upload a single file. Uses FormData so the browser sets the multipart
 * boundary automatically; do NOT JSON-stringify.
 */
export async function apiFilesUpload(
  token: string,
  file: File,
  opts: { folder?: string; visibility?: FileVisibility; company_id?: number | null } = {}
): Promise<ApiSuccessEnvelope<FileAssetRow>> {
  const fd = new FormData();
  fd.append("file", file);
  if (opts.folder) fd.append("folder", opts.folder);
  if (opts.visibility) fd.append("visibility", opts.visibility);
  if (opts.company_id != null) fd.append("company_id", String(opts.company_id));
  return apiFetchJson(`/files/upload`, { method: "POST", token, body: fd });
}

/** POST /files/folder — create a folder marker. */
export async function apiFilesCreateFolder(
  token: string,
  folder: string,
  opts: { visibility?: FileVisibility; company_id?: number | null } = {}
): Promise<ApiSuccessEnvelope<{ folder: string; id: number }>> {
  return apiFetchJson(`/files/folder`, {
    method: "POST",
    token,
    body: {
      folder,
      visibility: opts.visibility,
      company_id: opts.company_id ?? undefined,
    },
  });
}

/** DELETE /files/{id} */
export async function apiFilesDelete(
  token: string,
  id: number
): Promise<ApiSuccessEnvelope<{ id: number }>> {
  return apiFetchJson(`/files/${id}`, { method: "DELETE", token });
}

/** GET /files/storage-stats */
export async function apiFilesStorageStats(
  token: string
): Promise<ApiSuccessEnvelope<StorageStats>> {
  return apiFetchJson(`/files/storage-stats`, { method: "GET", token });
}

/**
 * Trigger a browser download for the given file asset. Streams from
 * /api/files/{id}/download with the auth header attached.
 */
export async function apiFilesDownload(token: string, asset: FileAssetRow): Promise<void> {
  const base = getApiBaseUrl().replace(/\/$/, "");
  const url = `${base}/files/${asset.id}/download`;
  const res = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ApiRequestError(text || `HTTP ${res.status}`, res.status);
  }
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = asset.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  }
}

/**
 * Phase Ժ.2 — fetch a file's bytes with auth and return a blob object URL
 * for in-page preview (e.g. an image lightbox). The caller MUST revoke the
 * URL (URL.revokeObjectURL) when the preview closes to avoid a memory leak.
 */
export async function apiFilesObjectUrl(token: string, asset: FileAssetRow): Promise<string> {
  const base = getApiBaseUrl().replace(/\/$/, "");
  const url = `${base}/files/${asset.id}/download`;
  const res = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ApiRequestError(text || `HTTP ${res.status}`, res.status);
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

/** True when the mime type is a previewable image. */
export function isPreviewableImage(mime: string): boolean {
  return /^image\/(png|jpe?g|gif|webp|svg\+xml|bmp|avif)$/i.test(mime);
}

/** Format bytes as a human-friendly string. */
export function formatBytes(bytes: number): string {
  if (!bytes || bytes < 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = bytes;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v < 10 && i > 0 ? v.toFixed(1) : Math.round(v)} ${units[i]}`;
}

/** Classify a mime string into a UI-friendly bucket. */
export function mimeBucket(mime: string): MimeBucket {
  const prefix = (mime.split("/")[0] ?? "").toLowerCase();
  if (prefix === "image" || prefix === "video" || prefix === "audio" || prefix === "text" || prefix === "application") {
    return prefix as MimeBucket;
  }
  return "other";
}

/** Short label for a mime type ("PDF", "Image", "Spreadsheet", "Document", "File"). */
export function mimeLabel(mime: string): string {
  if (mime.startsWith("image/")) return "Image";
  if (mime === "application/pdf") return "PDF";
  if (
    mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mime === "application/vnd.ms-excel" ||
    mime === "text/csv"
  ) {
    return "Spreadsheet";
  }
  if (
    mime === "application/msword" ||
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "Document";
  }
  if (mime.startsWith("video/")) return "Video";
  if (mime.startsWith("audio/")) return "Audio";
  if (mime.startsWith("text/")) return "Text";
  return "File";
}
