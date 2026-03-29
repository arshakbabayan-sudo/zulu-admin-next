import { apiFetchJson } from "./api-client";

/** Fire-and-forget R1 shadow screen view (Laravel logs `admin_next_screen_view`). */
export function reportAdminNextScreenView(token: string, screen: string): void {
  void apiFetchJson<{ success: boolean }>("/rollout/admin-next/screen-view", {
    method: "POST",
    token,
    body: { screen },
  }).catch(() => {
    /* observability only */
  });
}
