// Centralized tag definitions so all cards / dialogs use the same labels.
// Keep this in sync with apps/api/db/schema.sql listing conditions.

type ListingTagFlags = {
  allow_pets?: boolean;
  allow_subsidy?: boolean;
  allow_tax_receipt?: boolean;
  allow_household_registration?: boolean;
  allow_cooking?: boolean;
};

type ProfileTagFlags = {
  has_pets?: boolean;
  needs_subsidy?: boolean;
  needs_tax_receipt?: boolean;
  needs_household_registration?: boolean;
  needs_cooking?: boolean;
};

export const LISTING_TAGS: { key: keyof ListingTagFlags; label: string }[] = [
  { key: "allow_pets", label: "寵物" },
  { key: "allow_subsidy", label: "租屋補助" },
  { key: "allow_tax_receipt", label: "報稅" },
  { key: "allow_household_registration", label: "入籍" },
  { key: "allow_cooking", label: "開伙" },
];

export const PROFILE_TAGS: { key: keyof ProfileTagFlags; label: string }[] = [
  { key: "has_pets", label: "寵物" },
  { key: "needs_subsidy", label: "租屋補助" },
  { key: "needs_tax_receipt", label: "報稅" },
  { key: "needs_household_registration", label: "入籍" },
  { key: "needs_cooking", label: "開伙" },
];

export function getListingTags(listing: ListingTagFlags): string[] {
  return LISTING_TAGS.filter((t) => listing[t.key]).map((t) => t.label);
}

export function getProfileTags(profile: ProfileTagFlags): string[] {
  return PROFILE_TAGS.filter((t) => profile[t.key]).map((t) => t.label);
}

export function formatLayout(listing: {
  num_bedrooms?: number | null;
  num_living_rooms?: number | null;
  num_bathrooms?: number | null;
  num_balconies?: number | null;
}): string | null {
  const b = listing.num_bedrooms;
  const l = listing.num_living_rooms;
  const ba = listing.num_bathrooms;
  const bc = listing.num_balconies;
  if (b == null || l == null || ba == null || bc == null) return null;
  return `${b}房${l}廳${ba}衛${bc}陽台`;
}

export function totalMonthly(listing: { rent: number; management_fee?: number }): number {
  return listing.rent + (listing.management_fee ?? 0);
}

export function pricePerPing(listing: { rent: number; area_ping: number }): number | null {
  if (!listing.area_ping || listing.area_ping <= 0) return null;
  return Math.round(listing.rent / listing.area_ping);
}
