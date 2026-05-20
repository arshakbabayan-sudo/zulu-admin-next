"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { ConfirmDialog, type ConfirmDialogVariant } from "@/components/ui/ConfirmDialog";

/**
 * App-wide replacement for `window.confirm()` (which is untranslated and
 * unstyleable). Mount `<ConfirmDialogProvider>` once near the root, then
 * call `useConfirm()` from any handler:
 *
 *   const confirm = useConfirm();
 *
 *   async function handleDelete(id: number) {
 *     const ok = await confirm({
 *       messageKey: "admin.bucket3.block_dates.confirm_delete",
 *       variant: "danger",
 *     });
 *     if (!ok) return;
 *     await del(id);
 *   }
 *
 * The provider keeps a single dialog instance alive and resolves the Promise
 * returned by `confirm()` with true (user clicked confirm) / false (cancel /
 * backdrop / Escape).
 */
export type ConfirmOptions = {
  /** i18n key for the dialog body. */
  messageKey?: string;
  /** Literal body (use when the text is dynamic, e.g. `Delete "${name}"?`). */
  message?: React.ReactNode;
  /** i18n key for the heading; defaults to "common.confirm_title". */
  titleKey?: string;
  /** Literal heading override. */
  title?: React.ReactNode;
  /** i18n key for the confirm button; defaults to "common.confirm". */
  confirmLabelKey?: string;
  /** i18n key for the cancel button; defaults to "common.cancel". */
  cancelLabelKey?: string;
  /** "danger" colors the confirm button red for destructive actions. */
  variant?: ConfirmDialogVariant;
};

type PendingPrompt = ConfirmOptions & { resolve: (ok: boolean) => void };

const ConfirmDialogContext = createContext<((opts: ConfirmOptions) => Promise<boolean>) | null>(null);

export function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<PendingPrompt | null>(null);
  const [busy, setBusy] = useState(false);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setPending({ ...opts, resolve });
    });
  }, []);

  const handleCancel = useCallback(() => {
    if (!pending) return;
    pending.resolve(false);
    setPending(null);
    setBusy(false);
  }, [pending]);

  const handleConfirm = useCallback(async () => {
    if (!pending) return;
    setBusy(true);
    try {
      pending.resolve(true);
    } finally {
      setPending(null);
      setBusy(false);
    }
  }, [pending]);

  const value = useMemo(() => confirm, [confirm]);

  return (
    <ConfirmDialogContext.Provider value={value}>
      {children}
      <ConfirmDialog
        isOpen={pending != null}
        onCancel={handleCancel}
        onConfirm={handleConfirm}
        titleKey={pending?.titleKey}
        title={pending?.title}
        messageKey={pending?.messageKey}
        message={pending?.message}
        confirmLabelKey={pending?.confirmLabelKey}
        cancelLabelKey={pending?.cancelLabelKey}
        variant={pending?.variant ?? "default"}
        busy={busy}
      />
    </ConfirmDialogContext.Provider>
  );
}

export function useConfirm(): (opts: ConfirmOptions) => Promise<boolean> {
  const ctx = useContext(ConfirmDialogContext);
  if (!ctx) {
    throw new Error("useConfirm() requires <ConfirmDialogProvider> in the tree");
  }
  return ctx;
}
