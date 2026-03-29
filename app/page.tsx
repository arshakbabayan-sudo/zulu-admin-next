"use client";

import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function HomePage() {
  const { token, bootstrapped } = useAdminAuth();
  const router = useRouter();

  useEffect(() => {
    if (!bootstrapped) return;
    router.replace(token ? "/dashboard" : "/login");
  }, [bootstrapped, token, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 text-sm text-zinc-600">
      Redirecting…
    </div>
  );
}
