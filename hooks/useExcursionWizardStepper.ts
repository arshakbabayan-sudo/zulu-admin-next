import { useCallback, useState } from "react";
import {
  EXCURSION_WIZARD_STEP_COUNT,
  validateExcursionWizardStep,
  type ExcursionWizardState,
  type FieldErrors,
} from "@/lib/excursions/excursion-wizard-state";

/**
 * Reusable step navigation for the excursion builder: validates the current step before advancing.
 */
export function useExcursionWizardStepper() {
  const [step, setStep] = useState(1);

  const resetToFirstStep = useCallback(() => setStep(1), []);

  const goPrevious = useCallback(() => {
    setStep((s) => Math.max(1, s - 1));
  }, []);

  const tryAdvance = useCallback(
    (
      form: ExcursionWizardState | null,
      isCreate: boolean
    ): { ok: true } | { ok: false; errors: FieldErrors } => {
      if (!form) {
        return { ok: false, errors: { "": ["Form is not available."] } };
      }
      const errs = validateExcursionWizardStep(step, form, isCreate);
      if (errs) return { ok: false, errors: errs };
      setStep((s) => Math.min(EXCURSION_WIZARD_STEP_COUNT, s + 1));
      return { ok: true };
    },
    [step]
  );

  return {
    step,
    setStep,
    resetToFirstStep,
    goPrevious,
    tryAdvance,
  };
}
