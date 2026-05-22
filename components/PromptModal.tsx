"use client";

/**
 * PromptModal — ZULU replacement for browser-native window.prompt().
 *
 * Use case: ask the operator for a short text (notes, reason, etc.) before
 * proceeding with a destructive or significant action.
 *
 * Imperative API via `useState`:
 *   const [promptState, setPromptState] = useState<PromptState | null>(null);
 *   setPromptState({ title: "Reject", placeholder: "…", required: true, onConfirm: (v) => …});
 *   {promptState && <PromptModal {...promptState} onClose={() => setPromptState(null)} />}
 */

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button, Input } from "@/components/ui";
import { useLanguage } from "@/contexts/LanguageContext";

export type PromptModalProps = {
  isOpen: boolean;
  title: string;
  description?: string;
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
  minLength?: number;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "danger";
  onConfirm: (value: string) => void;
  onClose: () => void;
};

export function PromptModal({
  isOpen,
  title,
  description,
  placeholder,
  defaultValue = "",
  required = false,
  minLength = 0,
  confirmLabel,
  cancelLabel,
  variant = "default",
  onConfirm,
  onClose,
}: PromptModalProps) {
  const { t } = useLanguage();
  const [value, setValue] = useState(defaultValue);
  const [touched, setTouched] = useState(false);

  const trimmed = value.trim();
  const tooShort = trimmed.length < minLength;
  const empty = required && trimmed.length === 0;
  const invalid = touched && (empty || tooShort);

  function handleConfirm() {
    setTouched(true);
    if (empty || tooShort) return;
    onConfirm(trimmed);
    setValue("");
    setTouched(false);
    onClose();
  }

  function handleCancel() {
    setValue("");
    setTouched(false);
    onClose();
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCancel}
      title={title}
      description={description}
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={handleCancel}>
            {cancelLabel ?? t("common.cancel")}
          </Button>
          <Button
            variant={variant === "danger" ? "danger" : "primary"}
            size="sm"
            onClick={handleConfirm}
            disabled={empty || tooShort}
          >
            {confirmLabel ?? t("common.confirm")}
          </Button>
        </div>
      }
    >
      <div className="space-y-2">
        <Input
          as="textarea"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          rows={4}
          autoFocus
        />
        {invalid && (
          <p className="text-xs text-error-600">
            {empty
              ? t("common.field_required")
              : t("admin.crud.common.fix_following")}
          </p>
        )}
      </div>
    </Modal>
  );
}
