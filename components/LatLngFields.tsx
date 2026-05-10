"use client";

/**
 * Shared admin form fragment — latitude / longitude paired inputs.
 * Used by Cars, Excursions, Packages so suppliers can pin their offer
 * on the public ZULU map (Hotels has its own pair already).
 */
export type LatLngFieldsProps = {
  latitude: string;
  longitude: string;
  onLatitudeChange: (value: string) => void;
  onLongitudeChange: (value: string) => void;
  hint?: string;
};

export function LatLngFields({
  latitude,
  longitude,
  onLatitudeChange,
  onLongitudeChange,
  hint = "(Google Maps-ից աջ սեղմեք քարտեզի վրա` պատճենել կորդինատները, օրինակ` 40.1872, 44.5152)",
}: LatLngFieldsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:col-span-2">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-fg-t6">
          Latitude{" "}
          <span className="text-fg-t7 font-normal">{hint}</span>
        </span>
        <input
          type="text"
          inputMode="decimal"
          placeholder="40.1872"
          value={latitude}
          onChange={(e) => onLatitudeChange(e.target.value)}
          className="rounded border border-default px-2 py-1.5 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-fg-t6">Longitude</span>
        <input
          type="text"
          inputMode="decimal"
          placeholder="44.5152"
          value={longitude}
          onChange={(e) => onLongitudeChange(e.target.value)}
          className="rounded border border-default px-2 py-1.5 text-sm"
        />
      </label>
    </div>
  );
}
