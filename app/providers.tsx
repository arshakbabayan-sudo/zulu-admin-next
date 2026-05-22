"use client";

import { AdminAuthProvider } from "@/contexts/AdminAuthContext";
import { ConfirmDialogProvider } from "@/contexts/ConfirmDialogContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { PromptDialogProvider } from "@/contexts/PromptDialogContext";
import type { ReactNode } from "react";

export function Providers({
  children,
  initialLang,
}: {
  children: ReactNode;
  initialLang: string;
}) {
  return (
    <LanguageProvider initialLang={initialLang}>
      <AdminAuthProvider>
        <ConfirmDialogProvider>
          <PromptDialogProvider>{children}</PromptDialogProvider>
        </ConfirmDialogProvider>
      </AdminAuthProvider>
    </LanguageProvider>
  );
}
