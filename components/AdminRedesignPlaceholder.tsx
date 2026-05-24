"use client";

import { useDocumentTitle } from "@/lib/use-document-title";

type Props = {
  title: string;
  subtitle?: string;
};

export function AdminRedesignPlaceholder({ title, subtitle }: Props) {
  useDocumentTitle(`${title} — ZULU Admin`);
  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-800">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center">
        <div className="text-3xl">🚧</div>
        <p className="mt-3 text-sm font-medium text-slate-700">Շուտով կլինի</p>
        <p className="mt-1 text-xs text-slate-500">
          Այս բաժինը դեռ տեղապահ էջ է (placeholder) — ֆունկցիոնալությունը կավելացվի հաջորդ փուլում։
        </p>
      </div>
    </div>
  );
}
