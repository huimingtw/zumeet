"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { MapPin, X } from "lucide-react";
import { SlotPicker } from "@/components/SlotPicker";
import {
  formatLayout,
  getListingTags,
  pricePerPing,
  totalMonthly,
} from "@/lib/listingTags";
import type { MatchedListingCard } from "@/types";
import { LOCATION_LABELS, ROOM_TYPE_LABELS } from "@/types";

// ---- Shared listing field types for tenant match pages ----

export type ListingFields = {
  photos: string[];
  available_from: string;
  management_fee?: number;
  num_bedrooms?: number | null;
  num_living_rooms?: number | null;
  num_bathrooms?: number | null;
  num_balconies?: number | null;
  allow_pets: boolean;
  allow_subsidy: boolean;
  allow_tax_receipt: boolean;
  allow_household_registration: boolean;
  allow_cooking: boolean;
  has_parking: boolean;
  allow_smoking: boolean;
  description?: string;
  address?: string;
  lat?: number | null;
  lng?: number | null;
};

export type IncomingListingItem = ListingFields & {
  listing_id: string;
  listing_name?: string;
  rent: number;
  room_type: string;
  area_ping: number;
  location_id?: string;
  interest_sent?: boolean;
};

export type OutgoingItem = ListingFields & {
  listing_id: string;
  listing_name?: string;
  rent: number;
  room_type: string;
  area_ping: number;
  location_id?: string;
  tenant_profile_id: string;
  tenant_profile_name: string;
};

export type MatchItem = ListingFields & {
  match_id: string;
  listing_id: string;
  listing_name?: string;
  contact_info: string;
  matched_at: string;
  rent?: number;
  room_type?: string;
  area_ping?: number;
  location_id?: string;
  profile_name?: string;
  status?: string;
};

export function toListingCard(
  item: {
    listing_id: string;
    listing_name?: string;
    rent: number;
    room_type: string;
    area_ping: number;
    location_id?: string;
    interest_sent?: boolean;
  } & ListingFields
): MatchedListingCard {
  return {
    id: item.listing_id,
    name: item.listing_name ?? "",
    location_id: item.location_id ?? "",
    rent: item.rent,
    management_fee: item.management_fee ?? 0,
    room_type: item.room_type,
    area_ping: item.area_ping,
    num_bedrooms: item.num_bedrooms ?? null,
    num_living_rooms: item.num_living_rooms ?? null,
    num_bathrooms: item.num_bathrooms ?? null,
    num_balconies: item.num_balconies ?? null,
    available_from: item.available_from,
    allow_pets: item.allow_pets,
    allow_subsidy: item.allow_subsidy,
    allow_tax_receipt: item.allow_tax_receipt,
    allow_household_registration: item.allow_household_registration,
    allow_cooking: item.allow_cooking,
    has_parking: item.has_parking,
    allow_smoking: item.allow_smoking,
    photos: item.photos ?? [],
    interest_sent: item.interest_sent ?? false,
    description: item.description,
    address: item.address,
    lat: item.lat ?? null,
    lng: item.lng ?? null,
  };
}

export function ListingCard({
  listing,
  action,
  onClick,
  contactInfo,
}: {
  listing: MatchedListingCard;
  action?: React.ReactNode;
  onClick: () => void;
  contactInfo?: string;
}) {
  const [photoIdx, setPhotoIdx] = useState(0);
  const tags = getListingTags(listing);
  const layout = formatLayout(listing);
  const total = totalMonthly(listing);
  const perPing = pricePerPing(listing);

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md">
      <div className="sm:flex sm:items-stretch sm:gap-3 sm:p-3">
        {/* Photo */}
        <div className="relative aspect-video w-full overflow-hidden bg-gray-200 sm:aspect-[4/3] sm:w-44 sm:flex-shrink-0 sm:rounded-lg">
          {listing.photos.length > 0 && (
            <Image
              src={listing.photos[photoIdx]}
              alt=""
              fill
              className="object-cover"
              sizes="(min-width: 640px) 176px, 100vw"
            />
          )}
          {listing.photos.length > 1 && (
            <>
              <button
                type="button"
                onClick={() =>
                  setPhotoIdx(
                    (i) => (i - 1 + listing.photos.length) % listing.photos.length
                  )
                }
                className="absolute top-1/2 left-1 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-lg leading-none text-white"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={() => setPhotoIdx((i) => (i + 1) % listing.photos.length)}
                className="absolute top-1/2 right-1 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-lg leading-none text-white"
              >
                ›
              </button>
              <div className="absolute right-0 bottom-1 left-0 flex justify-center gap-1">
                {listing.photos.map((url, i) => (
                  <span
                    key={url}
                    className={`inline-block h-1 w-1 rounded-full ${i === photoIdx ? "bg-white" : "bg-white/50"}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Info */}
        <button
          type="button"
          onClick={onClick}
          className="block w-full p-4 text-left sm:min-w-0 sm:flex-1 sm:p-0"
        >
          {listing.name && (
            <p className="mb-0.5 text-sm font-semibold text-gray-950">{listing.name}</p>
          )}
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-xl font-semibold text-gray-950">
              ${total.toLocaleString()}
            </span>
            <span className="text-sm text-gray-500">
              {ROOM_TYPE_LABELS[listing.room_type] ?? listing.room_type}
            </span>
            <span className="text-sm text-gray-500">{listing.area_ping} 坪</span>
            {perPing != null && (
              <span className="text-sm text-gray-500">
                （每坪 ${perPing.toLocaleString()}）
              </span>
            )}
            {layout && <span className="text-sm text-gray-500">{layout}</span>}
          </div>
          {listing.management_fee > 0 && (
            <p className="text-xs text-gray-400">
              房租 ${listing.rent.toLocaleString()} + 管理費 $
              {listing.management_fee.toLocaleString()}
            </p>
          )}
          <div className="mt-1 flex items-center gap-1 text-sm text-gray-500">
            <MapPin size={14} strokeWidth={1.5} />
            {LOCATION_LABELS[listing.location_id] ?? listing.location_id}
          </div>
          <p className="mt-0.5 text-sm text-gray-400">
            可入住：
            {new Date(listing.available_from).toLocaleDateString("zh-TW", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
            })}
          </p>
          {tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
          {contactInfo && (
            <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
              <p className="mb-1 text-xs text-gray-400">
                以下為對方自填資料，平台不保證真實性，請自行確認。
              </p>
              <p className="text-sm font-medium text-gray-950">{contactInfo}</p>
            </div>
          )}
        </button>

        {/* Desktop CTA */}
        {action && (
          <div className="hidden sm:flex sm:flex-shrink-0 sm:items-center">{action}</div>
        )}
      </div>

      {/* Mobile CTA */}
      {action && (
        <div className="border-t border-gray-100 px-4 pt-3 pb-4 text-center sm:hidden [&>button]:w-full [&>button]:py-2.5 [&>button]:text-sm">
          {action}
        </div>
      )}
    </div>
  );
}

function ListingMiniMap({
  address,
  locationLabel,
  lat,
  lng,
  precise = false,
}: {
  address?: string;
  locationLabel?: string;
  lat?: number | null;
  lng?: number | null;
  precise?: boolean;
}) {
  const query = (address && address.trim()) || locationLabel;
  if (!query && !lat) return null;

  const hasCoords = lat != null && lng != null;
  const GRID = 0.005;
  const mapLat = hasCoords
    ? precise
      ? (lat as number)
      : Math.round((lat as number) / GRID) * GRID
    : null;
  const mapLng = hasCoords
    ? precise
      ? (lng as number)
      : Math.round((lng as number) / GRID) * GRID
    : null;
  const zoom = precise ? 16 : 14;

  const externalQuery = hasCoords
    ? `${mapLat},${mapLng}`
    : encodeURIComponent(query ?? "");
  const externalUrl = `https://www.google.com/maps/search/?api=1&query=${externalQuery}`;
  const embedUrl = hasCoords
    ? `https://maps.google.com/maps?q=${mapLat},${mapLng}&z=${zoom}&output=embed&hl=zh-TW`
    : `https://maps.google.com/maps?q=${encodeURIComponent(query ?? "")}&z=${zoom}&output=embed&hl=zh-TW`;
  return (
    <a
      href={externalUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-3 block overflow-hidden rounded-lg border border-gray-200"
      title="在 Google 地圖開啟"
    >
      <div className="pointer-events-none relative h-40 w-full">
        <iframe
          src={embedUrl}
          title="地圖"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="block h-full w-full border-0"
        />
        {hasCoords && !precise && (
          <div className="absolute top-1/2 left-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-indigo-500/60 bg-indigo-500/20" />
        )}
      </div>
      {hasCoords && !precise && (
        <div className="bg-gray-50 px-2 py-1 text-center text-[11px] text-gray-500">
          僅顯示大約範圍，非精確位置
        </div>
      )}
    </a>
  );
}

export function ListingDetailDialog({
  listing,
  onClose,
  action,
  contactInfo,
}: {
  listing: MatchedListingCard;
  onClose: () => void;
  action?: React.ReactNode;
  contactInfo?: string;
}) {
  const [photoIdx, setPhotoIdx] = useState(0);
  const tags = getListingTags(listing);
  const layout = formatLayout(listing);
  const total = totalMonthly(listing);
  const perPing = pricePerPing(listing);
  const photoCount = listing.photos.length;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (photoCount <= 1) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setPhotoIdx((i) => (i - 1 + photoCount) % photoCount);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setPhotoIdx((i) => (i + 1) % photoCount);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, photoCount]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
    >
      <button
        type="button"
        className="absolute inset-0"
        aria-label="關閉"
        onClick={onClose}
      />
      <div
        className="relative z-10 flex w-screen flex-col overflow-hidden rounded-t-2xl bg-white sm:min-h-[520px] sm:w-[min(80vw,1280px)] sm:flex-row sm:rounded-2xl"
        style={{ maxHeight: "90vh" }}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 z-20 rounded-full bg-black/50 p-1.5 text-white backdrop-blur-sm hover:bg-black/70"
          aria-label="關閉"
        >
          <X size={16} strokeWidth={2} />
        </button>

        {/* Photo panel */}
        <div className="relative flex-shrink-0 bg-gray-100 sm:w-[62%] sm:self-stretch">
          {listing.photos.length > 0 ? (
            <div className="relative h-64 w-full sm:absolute sm:inset-0 sm:h-auto">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={listing.photos[photoIdx]}
                alt=""
                className="block h-full w-full object-cover"
              />
            </div>
          ) : (
            <div className="flex h-48 w-full items-center justify-center sm:absolute sm:inset-0 sm:h-auto">
              <span className="text-sm text-gray-500">暫無照片</span>
            </div>
          )}
          {listing.photos.length > 1 && (
            <>
              <button
                type="button"
                onClick={() =>
                  setPhotoIdx(
                    (i) => (i - 1 + listing.photos.length) % listing.photos.length
                  )
                }
                className="absolute top-1/2 left-3 -translate-y-1/2 rounded-full bg-black/50 px-2.5 py-1.5 text-lg leading-none text-white backdrop-blur-sm"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={() => setPhotoIdx((i) => (i + 1) % listing.photos.length)}
                className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full bg-black/50 px-2.5 py-1.5 text-lg leading-none text-white backdrop-blur-sm"
              >
                ›
              </button>
              <span className="absolute right-3 bottom-3 rounded-full bg-black/50 px-2.5 py-1 text-xs text-white backdrop-blur-sm">
                {photoIdx + 1} / {listing.photos.length}
              </span>
            </>
          )}
        </div>

        {/* Info panel */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col sm:max-h-[90vh] sm:w-[38%] sm:flex-none">
          <div className="min-h-0 overflow-y-auto p-6">
            {listing.name && (
              <p className="mb-1 text-base font-semibold text-gray-950">{listing.name}</p>
            )}
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-2xl font-bold text-gray-950">
                ${total.toLocaleString()}
              </span>
              <span className="text-sm text-gray-500">
                {ROOM_TYPE_LABELS[listing.room_type] ?? listing.room_type}
              </span>
              <span className="text-sm text-gray-500">
                {listing.area_ping} 坪
                {perPing != null && (
                  <span className="ml-1 text-gray-400">
                    （每坪 ${perPing.toLocaleString()}）
                  </span>
                )}
              </span>
              {layout && <span className="text-sm text-gray-500">{layout}</span>}
            </div>
            {listing.management_fee > 0 && (
              <p className="text-xs text-gray-400">
                房租 ${listing.rent.toLocaleString()} + 管理費 $
                {listing.management_fee.toLocaleString()}
              </p>
            )}
            <div className="mt-2 flex items-center gap-1 text-sm text-gray-500">
              <MapPin size={14} strokeWidth={1.5} />
              {listing.address ? (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(listing.address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-600 hover:underline"
                >
                  {listing.address}
                </a>
              ) : (
                (LOCATION_LABELS[listing.location_id] ?? listing.location_id)
              )}
            </div>
            <p className="mt-1 text-sm text-gray-400">
              可入住：{new Date(listing.available_from).toLocaleDateString("zh-TW")}
            </p>
            <ListingMiniMap
              address={listing.address}
              locationLabel={LOCATION_LABELS[listing.location_id] ?? listing.location_id}
              lat={listing.lat}
              lng={listing.lng}
              precise={!!contactInfo}
            />
            {listing.description && (
              <p className="mt-3 text-sm whitespace-pre-wrap text-gray-700">
                {listing.description}
              </p>
            )}
            {tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="bg-primary-100 text-primary-600 rounded-full px-3 py-1 text-xs font-medium"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
            {contactInfo && (
              <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="mb-1 text-xs text-gray-400">
                  以下為對方自填資料，平台不保證真實性，請自行確認。
                </p>
                <p className="text-sm font-medium text-gray-950">{contactInfo}</p>
              </div>
            )}
          </div>
          {action && (
            <div className="flex min-h-[72px] items-center justify-center px-6 pt-2 pb-6">
              {action}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function BookViewingModal({
  match,
  pending,
  onClose,
  onSubmit,
}: {
  match: MatchItem;
  pending: boolean;
  onClose: () => void;
  onSubmit: (startsAt: string) => void;
}) {
  const [slot, setSlot] = useState("");
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-t-2xl bg-white p-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-1 text-sm font-semibold text-gray-900">預約看房</p>
        <p className="mb-3 text-xs text-gray-500">
          {match.listing_name || "此房源"}｜選擇房東開放的帶看時段。
        </p>
        <SlotPicker listingId={match.listing_id} value={slot} onChange={setSlot} />
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm text-gray-600 hover:bg-gray-50"
          >
            取消
          </button>
          <button
            type="button"
            disabled={!slot || pending}
            onClick={() => onSubmit(slot)}
            className="bg-primary-600 hover:bg-primary-500 flex-1 rounded-lg py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            確認預約
          </button>
        </div>
      </div>
    </div>
  );
}
