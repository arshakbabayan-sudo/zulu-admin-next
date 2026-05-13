"use client";

import { TranslationTabs } from "@/components/TranslationTabs";
import type {
  TranslatableEntityType,
  TranslatableField,
} from "@/lib/translations-api";

type FieldDescriptor = {
  name: TranslatableField;
  label: string;
  multiline?: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  entityType: TranslatableEntityType;
  entityId: number | null;
  entityLabel?: string;
  fields: FieldDescriptor[];
};

export function TranslationsModal({
  open,
  onClose,
  entityType,
  entityId,
  entityLabel,
  fields,
}: Props) {
  if (!open || entityId === null) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-xl rounded-lg bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-fg-t11">
              Translations
              {entityLabel ? (
                <span className="ml-2 text-fg-t7 font-normal">— {entityLabel}</span>
              ) : null}
            </h2>
            <p className="text-xs text-fg-t7">
              EN-ից բացի՝ RU / HY (հիմնական լեզուն խմբագրվում է ֆորմի մեջ)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-default px-3 py-1 text-xs hover:bg-figma-bg-1"
          >
            Close
          </button>
        </div>
        <TranslationTabs entityType={entityType} entityId={entityId} fields={fields} />
      </div>
    </div>
  );
}
