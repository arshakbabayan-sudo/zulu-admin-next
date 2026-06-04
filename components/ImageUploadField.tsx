"use client";

import { useRef, useState } from "react";
import { getApiBaseUrl } from "@/lib/api-base";
import { useAdminAuth } from "@/contexts/AdminAuthContext";

export type MediaSection =
  | "hotels"
  | "flights"
  | "transfers"
  | "cars"
  | "excursions"
  | "visas"
  | "packages"
  | "offers"
  | "banners"
  | "companies"
  | "users";

export type ImageUploadFieldProps = {
  value: string;
  onChange: (url: string) => void;
  section: MediaSection;
  label?: string;
  hint?: string;
  altText?: string;
  /** Show the URL input alongside the upload button for paste fallback. */
  allowPasteUrl?: boolean;
};

/**
 * Image upload field. Click "Upload" → browser picker → POST multipart
 * to /api/media/upload → server returns absolute URL → write that URL
 * back into the form's existing string column (e.g. hotels.main_image).
 *
 * No DB schema change required: the column has always stored a URL.
 *
 * When `allowPasteUrl` is true a small URL input shows next to the
 * button so admins can still paste a CDN link if they prefer (Unsplash,
 * Imgur, etc.). Useful while migrating away from URL-only inputs.
 */
export function ImageUploadField({
  value,
  onChange,
  section,
  label = "Image",
  hint,
  altText = "Preview",
  allowPasteUrl = true,
}: ImageUploadFieldProps) {
  const { token } = useAdminAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    if (!token) {
      setError("Not authenticated");
      return;
    }
    setUploading(true);
    setError(null);

    const form = new FormData();
    form.append("file", file);
    form.append("section", section);

    try {
      // 2026-06-04 — was `/api/media/upload`. getApiBaseUrl() already returns the
      // API base (which already ends with `/api` on prod and `/api/proxy` on dev),
      // so prefixing the path with another `/api/` produced `…/api/api/media/upload`
      // and a 404 "Not found" red error on the Partner-settings modal Save flow.
      // Mirrors how every other API call composes paths (e.g. `${base}/platform-admin/users`).
      const res = await fetch(`${getApiBaseUrl().replace(/\/$/, "")}/media/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        body: form,
      });

      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = body?.message
          ?? body?.errors?.file?.[0]
          ?? body?.errors?.section?.[0]
          ?? `Upload failed (${res.status})`;
        setError(msg);
        return;
      }

      const url = body?.data?.url;
      if (typeof url === "string" && url) {
        onChange(url);
      } else {
        setError("Upload succeeded but server returned no URL");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-1 text-sm sm:col-span-2">
      <span className="font-medium text-fg-t6">
        {label}{" "}
        {hint ? <span className="text-fg-t7 font-normal">{hint}</span> : null}
      </span>

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="admin-btn-secondary"
        >
          {uploading ? "Uploading…" : value ? "Change image" : "Upload image"}
        </button>

        {value ? (
          <button
            type="button"
            onClick={() => onChange("")}
            disabled={uploading}
            className="admin-btn-ghost text-error-600"
          >
            Remove
          </button>
        ) : null}
      </div>

      {allowPasteUrl ? (
        <input
          type="url"
          placeholder="…or paste an image URL"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={uploading}
          className="rounded border border-default px-2 py-1.5 text-sm"
        />
      ) : null}

      {error ? (
        <p className="text-xs text-error-700">{error}</p>
      ) : null}

      {value ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={value}
          alt={altText}
          className="mt-1 h-32 w-48 object-cover rounded border border-default"
        />
      ) : null}
    </div>
  );
}
