"use client";

import { useLanguage } from "@/contexts/LanguageContext";

type Props = {
  /** Preferred: UI translation key for the detail line */
  messageKey?: string;
  /** Raw detail (e.g. API error); use {@link messageKey} for static copy */
  message?: string;
};

export function ForbiddenNotice({ messageKey, message }: Props) {
  const { t } = useLanguage();
  const detail =
    messageKey != null && messageKey !== ""
      ? t(messageKey)
      : message ?? t("admin.forbidden.default_detail");

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <p className="font-medium">{t("admin.forbidden.title")}</p>
      <p className="mt-1 text-amber-800">{detail}</p>
    </div>
  );
}
