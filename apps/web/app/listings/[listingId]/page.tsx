"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useParams } from "next/navigation";
import { useListingDetail } from "@/features/listings/useListings";
import { ListingDetailContent } from "@/features/listings/TenantListingCard";
import type { MatchedListingCard } from "@/types";

export default function ListingDetailPage() {
  const { listingId } = useParams<{ listingId: string }>();
  const { data: listing, isLoading } = useListingDetail(listingId);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <p className="text-sm text-gray-400">載入中…</p>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <p className="text-sm text-gray-400">找不到此房源</p>
      </div>
    );
  }

  // ponytail: map Listing → MatchedListingCard; interest_sent unused on standalone page
  const card: MatchedListingCard = {
    id: listing.id,
    name: listing.name,
    location_id: listing.location_id,
    rent: listing.rent,
    management_fee: listing.management_fee,
    room_type: listing.room_type,
    area_ping: listing.area_ping,
    num_bedrooms: listing.num_bedrooms,
    num_living_rooms: listing.num_living_rooms,
    num_bathrooms: listing.num_bathrooms,
    num_balconies: listing.num_balconies,
    available_from: listing.available_from,
    allow_pets: listing.allow_pets,
    allow_subsidy: listing.allow_subsidy,
    allow_tax_receipt: listing.allow_tax_receipt,
    allow_household_registration: listing.allow_household_registration,
    allow_cooking: listing.allow_cooking,
    has_parking: listing.has_parking,
    allow_smoking: listing.allow_smoking,
    photos: listing.photos,
    interest_sent: false,
    address: listing.address,
    description: listing.description,
    lat: listing.lat,
    lng: listing.lng,
    landlord_id: listing.landlord_id,
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="mx-auto max-w-5xl px-4 py-4">
        <Link
          href="/dashboard/tenant?tab=listings"
          className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"
        >
          <ArrowLeft size={16} />
          返回找房源
        </Link>
        <div className="overflow-hidden rounded-xl bg-white shadow-sm sm:flex sm:min-h-[520px]">
          <ListingDetailContent listing={card} />
        </div>
      </div>
    </div>
  );
}
