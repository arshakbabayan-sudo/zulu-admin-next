type Props = {
  status: string | null | undefined;
  reason?: string | null | undefined;
};

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "bg-figma-bg-1 text-fg-t7" },
  pending_review: { label: "In review", cls: "bg-warning-50 text-warning-800" },
  published: { label: "Published", cls: "bg-success-50 text-success-800" },
  active: { label: "Active", cls: "bg-success-50 text-success-800" },
  rejected: { label: "Rejected", cls: "bg-error-50 text-error-800" },
  archived: { label: "Archived", cls: "bg-figma-bg-1 text-fg-t6" },
  inactive: { label: "Inactive", cls: "bg-figma-bg-1 text-fg-t6" },
};

export function OfferStatusBadge({ status, reason }: Props) {
  const m = STATUS_MAP[status ?? "draft"] ?? { label: status ?? "—", cls: "bg-figma-bg-1 text-fg-t7" };
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${m.cls}`} title={reason ?? undefined}>
      {m.label}
    </span>
  );
}

export function isSubmittableStatus(status: string | null | undefined): boolean {
  return status === "draft" || status === "rejected";
}
