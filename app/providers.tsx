"use client";

import { AdminAuthProvider } from "@/contexts/AdminAuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
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
      <AdminAuthProvider>{children}</AdminAuthProvider>
    </LanguageProvider>
  );
}
