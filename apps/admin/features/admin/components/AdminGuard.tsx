
import { type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/features/admin/api";

// probes any protected endpoint; 401 triggers the adminApi interceptor redirect
function useAdminAuth() {
  return useQuery({
    queryKey: ["admin", "auth-probe"],
    queryFn: () => adminApi.get("/reports?status=pending").then((r) => r.data),
    retry: false,
    staleTime: 60_000,
  });
}

export function AdminGuard({ children }: { children: ReactNode }) {
  const { isLoading } = useAdminAuth();

  if (isLoading) {
    return <div className="min-h-screen bg-gray-50" />;
  }

  // on 401, the interceptor redirects to /login before isError resolves
  return <>{children}</>;
}
