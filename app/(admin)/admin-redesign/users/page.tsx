/**
 * Bucket B refactor (2026-05-27) — this page used to duplicate /platform/users.
 * Replaced with a permanent redirect so bookmarks keep working. The full
 * implementation lives at /platform/users.
 */

import { redirect } from "next/navigation";

export default function AdminRedesignUsersRedirect(): never {
  redirect("/platform/users");
}
