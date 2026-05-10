"use client";

/**
 * Shared admin form fragment — main_image (URL) + short_description (textarea).
 * Mirrors the Hotels admin pattern: paste a URL (Unsplash/Imgur/CDN) for now,
 * with an inline preview when the URL is non-empty.
 */
export type MainImageDescriptionFieldsProps = {
  mainImage: string;
  shortDescription: string;
  onMainImageChange: (value: string) => void;
  onShortDescriptionChange: (value: string) => void;
  imageHint?: string;
  descriptionHint?: string;
  imagePlaceholder?: string;
  descriptionPlaceholder?: string;
  altText?: string;
};

export function MainImageDescriptionFields({
  mainImage,
  shortDescription,
  onMainImageChange,
  onShortDescriptionChange,
  imageHint = "(հղում նկարի, օրինակ` Unsplash, Imgur — ցույց է տրվում card-ի վրա)",
  descriptionHint = "(կարճ նկարագրություն` ցույց է տրվում detail էջում)",
  imagePlaceholder = "https://images.unsplash.com/photo-XXX?auto=format&w=960",
  descriptionPlaceholder = "Brief description shown on detail page…",
  altText = "Preview",
}: MainImageDescriptionFieldsProps) {
  return (
    <>
      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
        <span className="font-medium text-fg-t6">
          Main image URL{" "}
          <span className="text-fg-t7 font-normal">{imageHint}</span>
        </span>
        <input
          type="url"
          placeholder={imagePlaceholder}
          value={mainImage}
          onChange={(e) => onMainImageChange(e.target.value)}
          className="rounded border border-default px-2 py-1.5 text-sm"
        />
        {mainImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mainImage}
            alt={altText}
            className="mt-2 h-32 w-48 object-cover rounded border border-default"
          />
        ) : null}
      </label>
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
