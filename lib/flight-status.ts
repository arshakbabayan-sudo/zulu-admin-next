export const BACKEND_FLIGHT_STATUSES = [
  "draft",
  "active",
  "inactive",
  "sold_out",
  "cancelled",
  "completed",
  "archived",
] as const;

export type BackendFlightStatus = (typeof BACKEND_FLIGHT_STATUSES)[number];
export type FlightUiStatusFilter = "all" | "upcoming" | "active" | "completed" | "canceled";

const UI_TO_BACKEND_STATUS: Record<FlightUiStatusFilter, BackendFlightStatus | undefined> = {
  all: undefined,
  upcoming: "draft",
  active: "active",
  completed: "completed",
  canceled: "cancelled",
};

const UI_STATUS_LABELS: Record<FlightUiStatusFilter, string> = {
  all: "All",
  upcoming: "Upcoming",
  active: "Active",
  completed: "Completed",
  canceled: "Canceled",
};

const BACKEND_STATUS_LABELS: Record<BackendFlightStatus, string> = {
  draft: "Upcoming",
  active: "Active",
  inactive: "Inactive",
  sold_out: "Sold Out",
  cancelled: "Canceled",
  completed: "Completed",
  archived: "Archived",
};

export function toBackendFlightStatus(filter: FlightUiStatusFilter): BackendFlightStatus | undefined {
  return UI_TO_BACKEND_STATUS[filter];
}

export function flightUiStatusLabel(filter: FlightUiStatusFilter): string {
  return UI_STATUS_LABELS[filter];
}

export function backendFlightStatusLabel(status: string | null | undefined): string {
  if (!status) return "—";
  if (status in BACKEND_STATUS_LABELS) {
    return BACKEND_STATUS_LABELS[status as BackendFlightStatus];
  }
  return status.replace(/_/g, " ");
}
