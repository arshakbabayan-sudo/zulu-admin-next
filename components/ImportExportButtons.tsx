"use client";

import { useLanguage } from "@/contexts/LanguageContext";

type Props = {
  onTemplate: () => void | Promise<void>;
  onExport: () => void | Promise<void>;
  onImport?: () => void;
  showImport?: boolean;
  busy?: boolean;
  exportDisabled?: boolean;
};

const btnSecondary =
  "rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 hover:bg-slate-50 disabled:opacity-40";

export function ImportExportButtons(props: Props) {
  const { t } = useLanguage();
  const { onTemplate, onExport, onImport, showImport = true, busy, exportDisabled } = props;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className={btnSecondary} disabled={busy} onClick={() => void onTemplate()}>
        {t("admin.import_export.template")}
      </button>
      <button
        type="button"
        className={btnSecondary}
        disabled={busy || exportDisabled}
        onClick={() => void onExport()}
      >
        {t("admin.import_export.export")}
      </button>
      {showImport && onImport && (
        <button type="button" className={btnSecondary} disabled={busy} onClick={onImport}>
          {t("admin.import_export.import")}
        </button>
      )}
    </div>
  );
}
