import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { qk } from "@/features/queryKeys";
import type { MatchedListingCard, TenantProfile } from "@/types";

export function useTenantProfiles() {
  return useQuery<TenantProfile[]>({
    queryKey: qk.tenantProfiles(),
    queryFn: () => api.get("/tenant-profiles").then((r) => r.data),
  });
}

export function useListingsBrowse(profileId: string) {
  return useQuery<{ items: MatchedListingCard[] }>({
    queryKey: qk.listingsBrowse(profileId),
    queryFn: () =>
      api.get(`/tenant-profiles/${profileId}/listings?limit=50`).then((r) => r.data),
    enabled: !!profileId,
  });
}

export function useIncoming<T = unknown>(profileId: string, opts?: { enabled?: boolean }) {
  return useQuery<{ items: T[] }>({
    queryKey: qk.incoming(profileId),
    queryFn: () =>
      api
        .get(`/tenant-profiles/${profileId}/interests/incoming?limit=50`)
        .then((r) => r.data),
    enabled: opts?.enabled,
  });
}
