import { useCallback, useMemo, useState } from "react";
import type { TransferFormValues } from "@/lib/transfers/transfer-field-adapter";
import {
  type TransferBuilderMode,
  type TransferBuilderStep,
  TRANSFER_BUILDER_STEPS,
  validateTransferStep,
} from "@/lib/transfers/transfer-ui";

export type TransferBuilderState = {
  mode: TransferBuilderMode;
  step: TransferBuilderStep;
  stepIndex: number;
  form: TransferFormValues;
  setForm: React.Dispatch<React.SetStateAction<TransferFormValues>>;
  stepErrors: string[];
  allErrors: string[];
  canGoPrev: boolean;
  canGoNext: boolean;
  goPrev: () => void;
  goNext: () => void;
  goTo: (step: TransferBuilderStep) => void;
  validateCurrentStep: () => string[];
  validateAll: () => string[];
};

export function useTransferBuilderForm(initial: TransferFormValues, mode: TransferBuilderMode): TransferBuilderState {
  const [form, setForm] = useState<TransferFormValues>(initial);
  const [stepIndex, setStepIndex] = useState(0);
  const step = TRANSFER_BUILDER_STEPS[Math.max(0, Math.min(TRANSFER_BUILDER_STEPS.length - 1, stepIndex))];

  const validateCurrentStep = useCallback(() => {
    return validateTransferStep(form, step, mode);
  }, [form, step, mode]);

  const validateAll = useCallback(() => {
    return validateTransferStep(form, "review_submit", mode);
  }, [form, mode]);

  const stepErrors = useMemo(() => validateCurrentStep(), [validateCurrentStep]);
  const allErrors = useMemo(() => validateAll(), [validateAll]);

  const canGoPrev = stepIndex > 0;
  const canGoNext = stepIndex < TRANSFER_BUILDER_STEPS.length - 1 && stepErrors.length === 0;

  const goPrev = useCallback(() => {
    setStepIndex((i) => Math.max(0, i - 1));
  }, []);

  const goNext = useCallback(() => {
    setStepIndex((i) => {
      const next = Math.min(TRANSFER_BUILDER_STEPS.length - 1, i + 1);
      return next;
    });
  }, []);

  const goTo = useCallback((target: TransferBuilderStep) => {
    const idx = TRANSFER_BUILDER_STEPS.indexOf(target);
    if (idx < 0) return;
    // Only allow jumping forward if all previous steps validate.
    if (idx > stepIndex) {
      for (let i = 0; i < idx; i++) {
        const s = TRANSFER_BUILDER_STEPS[i];
        if (validateTransferStep(form, s, mode).length > 0) return;
      }
    }
    setStepIndex(idx);
  }, [form, mode, stepIndex]);

  return {
    mode,
    step,
    stepIndex,
    form,
    setForm,
    stepErrors,
    allErrors,
    canGoPrev,
    canGoNext,
    goPrev,
    goNext,
    goTo,
    validateCurrentStep,
    validateAll,
  };
}

