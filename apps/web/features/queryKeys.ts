export const qk = {
  me: () => ["me"] as const,
  listings: () => ["listings"] as const,
  listingDetail: (id: string) => ["listing-detail", id] as const,
  listingEdit: (id: string) => ["listing-edit", id] as const,
  listingsBrowse: (profileId: string) => ["listings-browse", profileId] as const,

  tenantProfiles: () => ["tenant-profiles"] as const,
  profilesBrowse: (listingId: string) => ["profiles-browse", listingId] as const,

  incoming: (profileId: string) => ["incoming", profileId] as const,
  incomingListing: (listingId: string) => ["incoming-listing", listingId] as const,
  outgoing: () => ["outgoing"] as const,
  matched: () => ["matched"] as const,

  viewings: (role?: string) =>
    role ? (["viewings", role] as const) : (["viewings"] as const),
  viewingAvailability: (listingId: string) =>
    ["viewing-availability", listingId] as const,
  viewingSlots: (listingId?: string) =>
    listingId ? (["viewing-slots", listingId] as const) : (["viewing-slots"] as const),
};
