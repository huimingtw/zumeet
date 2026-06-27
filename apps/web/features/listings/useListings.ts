import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { qk } from "@/features/queryKeys";
import type { Listing, MatchedTenantProfileCard, ViewingAvailability } from "@/types";

export function useListings() {
  return useQuery<Listing[]>({
    queryKey: qk.listings(),
    queryFn: () => api.get("/listings").then((r) => r.data),
  });
}

export function useListingDetail(listingId: string) {
  return useQuery({
    queryKey: qk.listingDetail(listingId),
    queryFn: () => api.get(`/listings/${listingId}`).then((r) => r.data),
  });
}

export function useListingEdit(editingId: string) {
  return useQuery<Listing>({
    queryKey: qk.listingEdit(editingId),
    queryFn: () => api.get(`/listings/${editingId}`).then((r) => r.data),
    enabled: !!editingId,
  });
}

export function useProfilesBrowse(listingId: string) {
  return useQuery<{ items: MatchedTenantProfileCard[] }>({
    queryKey: qk.profilesBrowse(listingId),
    queryFn: () =>
      api.get(`/listings/${listingId}/tenant-profiles?limit=50`).then((r) => r.data),
    enabled: !!listingId,
  });
}

export function useIncomingListing(listingId: string, opts?: { enabled?: boolean }) {
  return useQuery<{ items: MatchedTenantProfileCard[] }>({
    queryKey: qk.incomingListing(listingId),
    queryFn: () =>
      api.get(`/listings/${listingId}/tenant-profiles?limit=50`).then((r) => r.data),
    enabled: opts?.enabled,
  });
}

export function useViewingAvailability(listingId: string) {
  return useQuery<ViewingAvailability>({
    queryKey: qk.viewingAvailability(listingId),
    queryFn: () =>
      api.get(`/listings/${listingId}/viewing-availability`).then((r) => r.data),
    enabled: !!listingId,
  });
}
