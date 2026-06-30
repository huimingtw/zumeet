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
  smoking?: boolean;
  needs_subsidy?: boolean;
  needs_tax_receipt?: boolean;
  needs_household_registration?: boolean;
  needs_cooking?: boolean;
  needs_parking?: boolean;
};

// lifestyle = 租客自身狀態（房東需容許）；need = 租客需求（房東需提供）
export type ProfileTagKind = "lifestyle" | "need";

export const LISTING_TAGS: { key: keyof ListingTagFlags; label: string }[] = [
  { key: "allow_pets", label: "寵物" },
  { key: "allow_subsidy", label: "租屋補助" },
  { key: "allow_tax_receipt", label: "報稅" },
  { key: "allow_household_registration", label: "入籍" },
  { key: "allow_cooking", label: "開伙" },
];

export const PROFILE_TAGS: {
  key: keyof ProfileTagFlags;
  label: string;
  kind: ProfileTagKind;
}[] = [
  { key: "has_pets", label: "養寵物", kind: "lifestyle" },
  { key: "smoking", label: "吸菸", kind: "lifestyle" },
  { key: "needs_subsidy", label: "租屋補助", kind: "need" },
  { key: "needs_tax_receipt", label: "報稅", kind: "need" },
  { key: "needs_household_registration", label: "入籍", kind: "need" },
  { key: "needs_cooking", label: "開伙", kind: "need" },
  { key: "needs_parking", label: "停車", kind: "need" },
];

export function getListingTags(listing: ListingTagFlags): string[] {
  return LISTING_TAGS.filter((t) => listing[t.key]).map((t) => t.label);
}

export function getProfileTags(profile: ProfileTagFlags) {
  return PROFILE_TAGS.filter((t) => profile[t.key]);
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

export function pricePerPing(listing: {
  rent: number;
  area_ping: number;
}): number | null {
  if (!listing.area_ping || listing.area_ping <= 0) return null;
  return Math.round(listing.rent / listing.area_ping);
}
