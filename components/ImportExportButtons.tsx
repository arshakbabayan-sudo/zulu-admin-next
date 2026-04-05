"use client";

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
  const { onTemplate, onExport, onImport, showImport = true, busy, exportDisabled } = props;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className={btnSecondary} disabled={busy} onClick={() => void onTemplate()}>
        Template
      </button>
      <button
        type="button"
        className={btnSecondary}
        disabled={busy || exportDisabled}
        onClick={() => void onExport()}
      >
        Export
      </button>
      {showImport && onImport && (
        <button type="button" className={btnSecondary} disabled={busy} onClick={onImport}>
          Import
        </button>
      )}
    </div>
  );
}
