"use client";

import type { ReactNode } from "react";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";

// RoleGuard renders its children only if the current user has `role`.
// Otherwise it shows a 403 — a tenant cannot open the landlord dashboard and vice versa.
export function RoleGuard({
  role,
  children,
}: {
  role: "tenant" | "landlord";
  children: ReactNode;
}) {
  const { data, isLoading, isError } = useQuery<{ roles: string[] }>({
    queryKey: ["me"],
    queryFn: () => api.get("/profile/me").then((r) => r.data),
  });

  if (isLoading) return <div className="min-h-screen bg-gray-100" />;

  if (isError || !data?.roles?.includes(role)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-gray-100 px-4 text-center">
        <p className="text-3xl font-bold text-gray-950">403</p>
        <p className="text-sm text-gray-500">您沒有權限存取此頁面</p>
      </div>
    );
  }

  return <>{children}</>;
}
