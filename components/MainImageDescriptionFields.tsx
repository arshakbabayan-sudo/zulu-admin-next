"use client";

/**
 * Shared admin form fragment — main image (upload OR URL) + short description.
 *
 * Used by every operator CRUD page (hotels / flights / transfers / cars /
 * excursions / visas / packages / offers). Pass `section` so the upload
 * lands in the right per-section folder on the backend public disk.
 */

import { ImageUploadField, type MediaSection } from "./ImageUploadField";

export type MainImageDescriptionFieldsProps = {
  mainImage: string;
  shortDescription: string;
  onMainImageChange: (value: string) => void;
  onShortDescriptionChange: (value: string) => void;
  section: MediaSection;
  imageHint?: string;
  descriptionHint?: string;
  descriptionPlaceholder?: string;
  altText?: string;
  imageLabel?: string;
};

export function MainImageDescriptionFields({
  mainImage,
  shortDescription,
  onMainImageChange,
  onShortDescriptionChange,
  section,
  imageHint = "(կտտացրու «Upload image» ` ընտրի ֆայլ համակարգչից, կամ paste URL` Unsplash/Imgur/CDN)",
  descriptionHint = "(կարճ նկարագրություն` ցույց է տրվում detail էջում)",
  descriptionPlaceholder = "Brief description shown on detail page…",
  altText = "Preview",
  imageLabel = "Main image",
}: MainImageDescriptionFieldsProps) {
  return (
    <>
      <ImageUploadField
        value={mainImage}
        onChange={onMainImageChange}
        section={section}
        label={imageLabel}
        hint={imageHint}
        altText={altText}
        allowPasteUrl
      />
      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
        <span className="font-medium text-fg-t6">
          Short description{" "}
          <span className="text-fg-t7 font-normal">{descriptionHint}</span>
        </span>
        <textarea
          rows={4}
          placeholder={descriptionPlaceholder}
          value={shortDescription}
          onChange={(e) => onShortDescriptionChange(e.target.value)}
          className="rounded border border-default px-2 py-1.5 text-sm"
        />
      </label>
    </>
  );
}
