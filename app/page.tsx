import { redirect } from "next/navigation";

/**
 * Root `/` never needs client auth: server redirect avoids a blank "Redirecting…"
 * shell if JS fails or context bootstraps slowly. Logged-in users hit `/login` briefly;
 * `app/login/page.tsx` then sends them to `/dashboard` when token + user are ready.
 */
export default function HomePage() {
  redirect("/login");
}
