"use client";

import { AdminShell } from "@/components/AdminShell";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AdminSectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { token, bootstrapped } = useAdminAuth();
  const router = useRouter();

  useEffect(() => {
    if (bootstrapped && !token) {
      router.replace("/login");
    }
  }, [bootstrapped, token, router]);

  if (!bootstrapped) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-sm text-slate-600">
        Loading session…
      </div>
    );
  }

  if (!token) {
    return null;
  }

  return <AdminShell>{children}</AdminShell>;
}
