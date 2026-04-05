export const FLIGHT_CABIN_CLASS_OPTIONS = [
  { value: "economy", label: "Economy" },
  { value: "premium_economy", label: "Comfort" },
  { value: "business", label: "Business" },
  { value: "first", label: "First" },
] as const;

export type FlightCabinClassValue = (typeof FLIGHT_CABIN_CLASS_OPTIONS)[number]["value"];

const LABEL_BY_VALUE: Record<FlightCabinClassValue, string> = {
  economy: "Economy",
  premium_economy: "Comfort",
  business: "Business",
  first: "First",
};

const VALUE_BY_LABEL = FLIGHT_CABIN_CLASS_OPTIONS.reduce<Record<string, FlightCabinClassValue>>((acc, item) => {
  acc[item.label.toLowerCase()] = item.value;
  return acc;
}, {});

export function flightCabinClassLabel(value: string | null | undefined): string {
  if (!value) return "Unknown";
  return LABEL_BY_VALUE[value as FlightCabinClassValue] ?? value;
}

export function toCanonicalFlightCabinClass(
  valueOrLabel: string | null | undefined
): FlightCabinClassValue | null {
  if (!valueOrLabel) return null;
  const input = valueOrLabel.trim().toLowerCase();
  if (input === "") return null;

  if (input in LABEL_BY_VALUE) {
    return input as FlightCabinClassValue;
  }

  return VALUE_BY_LABEL[input] ?? null;
}
