"use client";

import React from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "./Button";
import { Modal } from "./Modal";

/**
 * Reusable confirmation dialog that replaces `window.confirm()` (which is
 * untranslated — always English regardless of user locale).
 *
 * Usage:
 *   const [pendingId, setPendingId] = useState<number | null>(null);
 *   ...
 *   <ConfirmDialog
 *     isOpen={pendingId != null}
 *     onCancel={() => setPendingId(null)}
 *     onConfirm={async () => { await del(pendingId!); setPendingId(null); }}
 *     titleKey="admin.bucket3.block_dates.confirm_delete_title"
 *     messageKey="admin.bucket3.block_dates.confirm_delete_body"
 *     variant="danger"
 *   />
 *
 * The component is fully translation-driven via key props. Resolve fallbacks
 * are accepted for cases where the call site has a dynamic verb (e.g. the
 * payroll "Move to {status}?" dialog).
 */
export type ConfirmDialogVariant = "default" | "danger";

export type ConfirmDialogProps = {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
  /** i18n key for the modal heading (e.g. "admin.dialog.confirm_delete_title"). */
  titleKey?: string;
  /** Fallback title when no key is provided (or to override resolved value). */
  title?: React.ReactNode;
  /** i18n key for the body text. */
  messageKey?: string;
  /** Fallback body. */
  message?: React.ReactNode;
  /** i18n key for the confirm button label. Defaults to "common.confirm". */
  confirmLabelKey?: string;
  /** i18n key for the cancel button label. Defaults to "common.cancel". */
  cancelLabelKey?: string;
  /** Visual style of the confirm button. `danger` for destructive actions. */
  variant?: ConfirmDialogVariant;
  /** When true, show a loading spinner on the confirm button. */
  busy?: boolean;
};

export function ConfirmDialog({
  isOpen,
  onCancel,
  onConfirm,
  titleKey,
  title,
  messageKey,
  message,
  confirmLabelKey = "common.confirm",
  cancelLabelKey = "common.cancel",
  variant = "default",
  busy = false,
}: ConfirmDialogProps) {
  const { t } = useLanguage();

  const resolvedTitle = title ?? (titleKey ? t(titleKey) : t("common.confirm_title"));
  const resolvedMessage = message ?? (messageKey ? t(messageKey) : null);

  async function handleConfirm() {
    await onConfirm();
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={busy ? () => {} : onCancel}
      title={resolvedTitle}
      size="sm"
      closeOnBackdrop={!busy}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={busy}
          >
            {t(cancelLabelKey)}
          </Button>
          <Button
            type="button"
            variant={variant === "danger" ? "danger" : "primary"}
            size="sm"
            onClick={handleConfirm}
            loading={busy}
            autoFocus
          >
            {t(confirmLabelKey)}
          </Button>
        </div>
      }
    >
      {resolvedMessage != null ? (
        <p className="text-ds-body-2 text-fg-t7">{resolvedMessage}</p>
      ) : null}
    </Modal>
  );
}
