export function ForbiddenNotice({ message }: { message?: string }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <p className="font-medium">Access denied</p>
      <p className="mt-1 text-amber-800">
        {message ??
          "This section requires super admin. The API returned 403 — your token is valid but not authorized for platform-admin routes."}
      </p>
    </div>
  );
}
