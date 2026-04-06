export function reportAdminNextScreenView(token: string, screen: string): void {
  if (process.env.NODE_ENV !== "production") return;
  void import("./api-client").then(({ apiFetchJson }) =>
    apiFetchJson<{ success: boolean }>("/rollout/admin-next/screen-view", {
      method: "POST",
      token,
      body: { screen },
    }).catch(() => {})
  );
}
