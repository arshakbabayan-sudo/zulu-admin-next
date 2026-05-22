"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { PromptModal } from "@/components/PromptModal";

/**
 * App-wide replacement for `window.prompt()` (which is untranslated and
 * unstyleable). Mount `<PromptDialogProvider>` once near the root, then
 * call `usePrompt()` from any handler:
 *
 *   const prompt = usePrompt();
 *
 *   async function handleReject(id: number) {
 *     const reason = await prompt({
 *       title: "Reject application",
 *       placeholder: "Reason…",
 *       required: true,
 *       minLength: 3,
 *       variant: "danger",
 *     });
 *     if (reason === null) return; // cancelled
 *     await rejectApi(id, reason);
 *   }
 *
 * Returns string on confirm, null on cancel.
 */
export type PromptOptions = {
  title: string;
  description?: string;
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
  minLength?: number;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "danger";
};

type PendingPrompt = PromptOptions & { resolve: (value: string | null) => void };

const PromptDialogContext = createContext<((opts: PromptOptions) => Promise<string | null>) | null>(null);

export function PromptDialogProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<PendingPrompt | null>(null);

  const prompt = useCallback((opts: PromptOptions): Promise<string | null> => {
    return new Promise<string | null>((resolve) => {
      setPending({ ...opts, resolve });
    });
  }, []);

  const handleCancel = useCallback(() => {
    if (!pending) return;
    pending.resolve(null);
    setPending(null);
  }, [pending]);

  const handleConfirm = useCallback(
    (value: string) => {
      if (!pending) return;
      pending.resolve(value);
      setPending(null);
    },
    [pending],
  );

  const value = useMemo(() => prompt, [prompt]);

  return (
    <PromptDialogContext.Provider value={value}>
      {children}
      {pending && (
        <PromptModal
          isOpen
          title={pending.title}
          description={pending.description}
          placeholder={pending.placeholder}
          defaultValue={pending.defaultValue}
          required={pending.required}
          minLength={pending.minLength}
          confirmLabel={pending.confirmLabel}
          cancelLabel={pending.cancelLabel}
          variant={pending.variant ?? "default"}
          onConfirm={handleConfirm}
          onClose={handleCancel}
        />
      )}
    </PromptDialogContext.Provider>
  );
}

export function usePrompt(): (opts: PromptOptions) => Promise<string | null> {
  const ctx = useContext(PromptDialogContext);
  if (!ctx) {
    throw new Error("usePrompt() requires <PromptDialogProvider> in the tree");
  }
  return ctx;
}
