"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  ClipboardList,
  Heart,
  Inbox,
  MapPin,
  MoreVertical,
  Search,
  SearchX,
  SendHorizonal,
  X,
} from "lucide-react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, Suspense, useEffect, useRef, useState } from "react";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { useConfirm } from "@/components/ConfirmDialog";
import { LocationPicker } from "@/components/LocationPicker";
import { Dropdown } from "@/components/ui/Dropdown";
import { BottomTabItem } from "@/components/ui/BottomTabItem";
import { EmptyState } from "@/components/ui/EmptyState";
import { Loading } from "@/components/ui/Loading";
import {
  SkeletonListingCard,
  SkeletonMyProfileCard as SkeletonProfileCard,
} from "@/components/ui/Skeletons";
import { TabButton } from "@/components/ui/TabButton";
import { RoleGuard } from "@/components/RoleGuard";
import { SlotPicker } from "@/components/SlotPicker";
import { ViewingList } from "@/components/ViewingList";
import { CalendarClock } from "lucide-react";
import { api, extractFieldErrors } from "@/lib/api";
import {
  formatLayout,
  getListingTags,
  pricePerPing,
  totalMonthly,
} from "@/lib/listingTags";
import { formatSlot } from "@/lib/viewings";
import type { MatchedListingCard, TenantProfile, Viewing } from "@/types";
import { LOCATION_CITY_DISTRICT, LOCATION_LABELS, ROOM_TYPE_LABELS } from "@/types";

type MainTab = "requirements" | "listings" | "matches" | "viewings";
type MatchesSubTab = "incoming" | "outgoing" | "matched";

// ---- Dashboard shell ----

function TenantDashboardInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = (searchParams.get("tab") as MainTab) ?? "requirements";
  const matchesSubTab = (searchParams.get("subtab") as MatchesSubTab) ?? "incoming";

  function setTab(t: MainTab) {
    router.push(`?tab=${t}`);
  }

  function setMatchesSubTab(st: MatchesSubTab) {
    router.push(`?tab=matches&subtab=${st}`);
  }

  function goToBrowse(profileId: string) {
    router.push(`?tab=listings&profile=${profileId}`);
  }

  return (
    <div className="min-h-screen pb-14 sm:pb-0">
      <DashboardHeader />

      <div className="mx-auto max-w-4xl px-4 pt-4">
        {/* Desktop tab nav */}
        <nav className="mb-6 hidden gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-sm sm:flex">
          <TabButton
            active={tab === "requirements"}
            onClick={() => setTab("requirements")}
            icon={<ClipboardList size={20} strokeWidth={1.5} />}
            label="我的需求卡"
          />
          <TabButton
            active={tab === "listings"}
            onClick={() => setTab("listings")}
            icon={<Search size={20} strokeWidth={1.5} />}
            label="找房源"
          />
          <TabButton
            active={tab === "matches"}
            onClick={() => setTab("matches")}
            icon={<Heart size={20} strokeWidth={1.5} />}
            label="媒合狀態"
          />
          <TabButton
            active={tab === "viewings"}
            onClick={() => setTab("viewings")}
            icon={<CalendarClock size={20} strokeWidth={1.5} />}
            label="帶看行程"
          />
        </nav>

        {tab === "requirements" && <ProfilesTab onSelectProfile={goToBrowse} />}
        {tab === "viewings" && <ViewingList role="tenant" />}
        {tab === "listings" && (
          <BrowseTab
            selectedProfileId={searchParams.get("profile")}
            onSelectProfile={(id) => router.push(`?tab=listings&profile=${id}`)}
            onGoToProfiles={() => setTab("requirements")}
          />
        )}
        {tab === "matches" && (
          <MatchesView subTab={matchesSubTab} onSubTabChange={setMatchesSubTab} />
        )}
      </div>

      {/* Mobile bottom tab bar */}
      <nav className="fixed right-0 bottom-0 left-0 z-40 h-14 border-t border-gray-200 bg-white sm:hidden">
        <div className="flex h-full">
          <BottomTabItem
            active={tab === "requirements"}
            onClick={() => setTab("requirements")}
            icon={<ClipboardList size={20} strokeWidth={1.5} />}
            label="需求卡"
          />
          <BottomTabItem
            active={tab === "listings"}
            onClick={() => setTab("listings")}
            icon={<Search size={20} strokeWidth={1.5} />}
            label="找房源"
          />
          <BottomTabItem
            active={tab === "matches"}
            onClick={() => setTab("matches")}
            icon={<Heart size={20} strokeWidth={1.5} />}
            label="媒合狀態"
          />
          <BottomTabItem
            active={tab === "viewings"}
            onClick={() => setTab("viewings")}
            icon={<CalendarClock size={20} strokeWidth={1.5} />}
            label="帶看"
          />
        </div>
      </nav>
    </div>
  );
}

export default function TenantDashboard() {
  return (
    <RoleGuard role="tenant">
      <Suspense fallback={<div className="min-h-screen bg-gray-100" />}>
        <TenantDashboardInner />
      </Suspense>
    </RoleGuard>
  );
}

// ---- Shared nav components ----

// ---- Profiles Tab ----

function ProfilesTab({ onSelectProfile }: { onSelectProfile: (id: string) => void }) {
  const qc = useQueryClient();
  const { data: profiles = [], isLoading } = useQuery<TenantProfile[]>({
    queryKey: ["tenant-profiles"],
    queryFn: () => api.get("/tenant-profiles").then((r) => r.data),
  });
  const [editingProfile, setEditingProfile] = useState<TenantProfile | null>(null);
  const [showForm, setShowForm] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[0, 1].map((i) => (
          <SkeletonProfileCard key={i} />
        ))}
      </div>
    );
  }

  if (!isLoading && profiles.length === 0) {
    return (
      <>
        <EmptyState
          icon={<ClipboardList size={32} strokeWidth={1.5} className="text-gray-300" />}
          title="尚無需求卡"
          description="建立一張需求卡，系統就能為你媒合符合條件的房源"
          action={{
            label: "新增第一張需求卡",
            onClick: () => {
              setEditingProfile(null);
              setShowForm(true);
            },
          }}
        />
        {showForm && (
          <ProfileFormModal
            editingProfile={null}
            onClose={() => setShowForm(false)}
            onSaved={() => {
              qc.invalidateQueries({ queryKey: ["tenant-profiles"] });
              setShowForm(false);
            }}
          />
        )}
      </>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-950">我的找房需求卡</h2>
        <button
          type="button"
          onClick={() => {
            setEditingProfile(null);
            setShowForm(true);
          }}
          disabled={profiles.length >= 3}
          title={profiles.length >= 3 ? "最多可建立 3 張需求卡" : undefined}
          className="bg-primary-600 hover:bg-primary-500 rounded-lg px-3 py-1.5 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-40"
        >
          {profiles.length >= 3 ? "已達上限 (3/3)" : "+ 新增需求卡"}
        </button>
      </div>
      <div className="space-y-3">
        {profiles.map((p) => (
          <ProfileCard
            key={p.id}
            profile={p}
            onEdit={() => {
              setEditingProfile(p);
              setShowForm(true);
            }}
            onBrowse={() => onSelectProfile(p.id)}
            onDeleted={() => qc.invalidateQueries({ queryKey: ["tenant-profiles"] })}
          />
        ))}
      </div>
      {showForm && (
        <ProfileFormModal
          editingProfile={editingProfile}
          onClose={() => {
            setShowForm(false);
            setEditingProfile(null);
          }}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["tenant-profiles"] });
            setShowForm(false);
            setEditingProfile(null);
          }}
        />
      )}
    </div>
  );
}

function ProfileCard({
  profile,
  onEdit,
  onBrowse,
  onDeleted,
}: {
  profile: TenantProfile;
  onEdit: () => void;
  onBrowse: () => void;
  onDeleted: () => void;
}) {
  const qc = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [confirmEl, confirm] = useConfirm();

  useEffect(() => {
    if (!menuOpen) return;
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const toggleStatus = useMutation({
    mutationFn: () =>
      api.patch(`/tenant-profiles/${profile.id}/status`, {
        is_active: !profile.is_active,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tenant-profiles"] }),
  });

  const deleteProfile = useMutation({
    mutationFn: () => api.delete(`/tenant-profiles/${profile.id}`),
    onSuccess: onDeleted,
  });

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between p-4 sm:p-5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-950">{profile.name}</h3>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                profile.is_active
                  ? "bg-[#D1FAE5] text-[#059669]"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              {profile.is_active ? "啟用中" : "已停用"}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            預算 ${profile.budget_min.toLocaleString()}–$
            {profile.budget_max.toLocaleString()} ／{" "}
            {profile.preferred_room_types.map((t) => ROOM_TYPE_LABELS[t] ?? t).join("、")}
          </p>
        </div>

        {/* 找房源 — desktop only */}
        {profile.is_active && (
          <button
            type="button"
            onClick={onBrowse}
            className="bg-primary-600 hover:bg-primary-500 ml-2 hidden rounded-lg px-3 py-1.5 text-xs font-medium text-white transition sm:block"
          >
            找房源
          </button>
        )}

        {/* Kebab — single wrapper, works on both breakpoints */}
        <div ref={menuRef} className="relative ml-2 flex-shrink-0">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
            aria-label="更多動作"
          >
            <MoreVertical size={18} strokeWidth={1.5} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 z-30 mt-1 w-32 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onEdit();
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 transition hover:bg-gray-50"
              >
                編輯
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  toggleStatus.mutate();
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 transition hover:bg-gray-50"
              >
                {profile.is_active ? "停用" : "啟用"}
              </button>
              <button
                type="button"
                onClick={async () => {
                  setMenuOpen(false);
                  if (
                    await confirm({
                      message: "確定刪除這張需求卡？",
                      confirmText: "刪除",
                      danger: true,
                    })
                  )
                    deleteProfile.mutate();
                }}
                className="w-full px-4 py-2 text-left text-sm text-red-600 transition hover:bg-red-50"
              >
                刪除
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile-only full-width CTA */}
      {profile.is_active && (
        <div className="border-t border-gray-100 px-4 pt-3 pb-4 sm:hidden">
          <button
            type="button"
            onClick={onBrowse}
            className="bg-primary-600 hover:bg-primary-500 w-full rounded-lg py-2.5 text-sm font-medium text-white transition"
          >
            找房源
          </button>
        </div>
      )}
      {confirmEl}
    </div>
  );
}

// ---- Browse Tab ----

function BrowseTab({
  selectedProfileId,
  onSelectProfile,
  onGoToProfiles,
}: {
  selectedProfileId: string | null;
  onSelectProfile: (id: string) => void;
  onGoToProfiles: () => void;
}) {
  const { data: profiles = [] } = useQuery<TenantProfile[]>({
    queryKey: ["tenant-profiles"],
    queryFn: () => api.get("/tenant-profiles").then((r) => r.data),
  });

  const activeProfiles = profiles.filter((p) => p.is_active);
  const currentId =
    activeProfiles.find((p) => p.id === selectedProfileId)?.id ??
    activeProfiles[0]?.id ??
    null;

  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{ items: MatchedListingCard[] }>({
    queryKey: ["listings-browse", currentId],
    queryFn: () =>
      api.get(`/tenant-profiles/${currentId}/listings?limit=20`).then((r) => r.data),
    enabled: !!currentId,
  });

  const expressInterest = useMutation({
    mutationFn: (listingId: string) =>
      api.post(`/tenant-profiles/${currentId}/listings/${listingId}/interest`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["listings-browse", currentId] });
      qc.invalidateQueries({ queryKey: ["matched"] });
    },
  });

  const [detailListing, setDetailListing] = useState<MatchedListingCard | null>(null);
  const [filter, setFilter] = useState<"all" | "sent" | "open">("all");

  const allItems = data?.items ?? [];
  const items =
    filter === "sent"
      ? allItems.filter((l) => l.interest_sent)
      : filter === "open"
        ? allItems.filter((l) => !l.interest_sent)
        : allItems;

  if (activeProfiles.length === 0) {
    return (
      <EmptyState
        icon={<Search size={32} strokeWidth={1.5} className="text-gray-300" />}
        title="請先啟用一張需求卡"
        description="啟用需求卡後，系統才能為你媒合符合條件的房源"
        action={{ label: "前往我的需求卡", onClick: onGoToProfiles }}
      />
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <span className="text-sm font-medium text-gray-700">使用需求卡</span>
        <div className="w-48">
          <Dropdown
            value={currentId ?? ""}
            placeholder="請選擇需求卡"
            options={activeProfiles.map((p) => ({
              value: p.id,
              label: p.name,
            }))}
            onChange={onSelectProfile}
          />
        </div>
      </div>

      <div className="mb-4 flex gap-1.5">
        {(
          [
            ["all", "全部"],
            ["open", "有興趣"],
            ["sent", "已送出"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              filter === key
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <SkeletonListingCard key={i} />
          ))}
        </div>
      )}
      {!isLoading && allItems.length === 0 && (
        <EmptyState
          icon={<SearchX size={32} strokeWidth={1.5} className="text-gray-300" />}
          title="目前無符合條件的房源"
          description="條件可能較嚴格，可嘗試調整需求卡中的預算或地區範圍"
        />
      )}
      {!isLoading && allItems.length > 0 && items.length === 0 && (
        <p className="py-8 text-center text-sm text-gray-400">此分類沒有房源</p>
      )}
      <div className="space-y-3">
        {items.map((listing) => (
          <ListingCard
            key={listing.id}
            listing={listing}
            onClick={() => setDetailListing(listing)}
            action={
              listing.interest_sent ? (
                <span className="rounded-full bg-[#EDE9FE] px-2.5 py-0.5 text-xs font-medium text-[#5B21B6]">
                  已送出
                </span>
              ) : (
                <button
                  type="button"
                  disabled={expressInterest.isPending}
                  onClick={() => expressInterest.mutate(listing.id)}
                  className="bg-primary-600 hover:bg-primary-500 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition disabled:opacity-50"
                >
                  有興趣
                </button>
              )
            }
          />
        ))}
      </div>

      {detailListing && (
        <ListingDetailDialog
          listing={detailListing}
          onClose={() => setDetailListing(null)}
          action={
            detailListing.interest_sent ? (
              <p className="text-center text-sm text-gray-400">
                已送出興趣，等待房東回應
              </p>
            ) : (
              <button
                type="button"
                onClick={() => {
                  expressInterest.mutate(detailListing.id);
                  setDetailListing(null);
                }}
                className="bg-primary-600 hover:bg-primary-500 w-full rounded-lg py-3 text-sm font-medium text-white transition"
              >
                有興趣
              </button>
            )
          }
        />
      )}
    </div>
  );
}

function ListingCard({
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
      {/* sm+: side-by-side (original desktop layout); mobile: stacked */}
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

        {/* Desktop CTA — shown inline in the flex row */}
        {action && (
          <div className="hidden sm:flex sm:flex-shrink-0 sm:items-center">{action}</div>
        )}
      </div>

      {/* Mobile CTA — full-width bar below the card content */}
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

  // Privacy: before mutual match (precise=false) never expose the exact pin —
  // snap to a ~550m grid and show an approximate-area circle. After match
  // (precise=true) show the exact location. The circle is an indicative
  // affordance, not a surveyed radius — its pixel size doesn't track map scale
  // exactly. ponytail: fixed-size CSS circle, switch to the Maps JS API +
  // google.maps.Circle if exact metric radius is ever needed.
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

function ListingDetailDialog({
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

      {/* Dialog shell: width unchanged. On desktop, the right info column drives the row height;
			    the photo column stretches to match and the image fills it (object-cover).
			    A min-height keeps very short content from squishing the photo. */}
      <div
        className="relative z-10 flex w-screen flex-col overflow-hidden rounded-t-2xl bg-white sm:min-h-[520px] sm:w-[min(80vw,1280px)] sm:flex-row sm:rounded-2xl"
        style={{ maxHeight: "90vh" }}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 z-20 rounded-full bg-black/50 p-1.5 text-white backdrop-blur-sm hover:bg-black/70"
          aria-label="關閉"
        >
          <X size={16} strokeWidth={2} />
        </button>

        {/* ── Left: photo panel — stretches to dialog height; image fills via object-cover. ── */}
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

          {/* Photo nav */}
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

        {/* ── Right: info panel: drives the dialog height; scrolls if content exceeds 90vh. ── */}
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
              可入住：
              {new Date(listing.available_from).toLocaleDateString("zh-TW")}
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

// ---- Matches View ----

function MatchesView({
  subTab,
  onSubTabChange,
}: {
  subTab: MatchesSubTab;
  onSubTabChange: (t: MatchesSubTab) => void;
}) {
  return (
    <div>
      <div className="mb-4 flex gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
        {(
          [
            ["incoming", "待確認"],
            ["outgoing", "等待中"],
            ["matched", "已媒合"],
          ] as [MatchesSubTab, string][]
        ).map(([t, label]) => (
          <button
            key={t}
            type="button"
            onClick={() => onSubTabChange(t)}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
              subTab === t
                ? "bg-primary-600 text-white"
                : "text-gray-500 hover:bg-gray-100"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {subTab === "incoming" && <IncomingTab />}
      {subTab === "outgoing" && <OutgoingTab />}
      {subTab === "matched" && <MatchedTab />}
    </div>
  );
}

// ---- Shared listing types for match pages ----

type ListingFields = {
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

type IncomingListingItem = ListingFields & {
  listing_id: string;
  listing_name?: string;
  rent: number;
  room_type: string;
  area_ping: number;
  location_id?: string;
  interest_sent?: boolean;
};

type OutgoingItem = ListingFields & {
  listing_id: string;
  listing_name?: string;
  rent: number;
  room_type: string;
  area_ping: number;
  location_id?: string;
  tenant_profile_id: string;
  tenant_profile_name: string;
};

type MatchItem = ListingFields & {
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

function toListingCard(
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

// ---- Incoming (accordion per profile, all expanded by default) ----

function IncomingTab() {
  const { data: profiles = [], isLoading } = useQuery<TenantProfile[]>({
    queryKey: ["tenant-profiles"],
    queryFn: () => api.get("/tenant-profiles").then((r) => r.data),
  });
  const qc = useQueryClient();
  const [expandedSet, setExpandedSet] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (profiles.length > 0) setExpandedSet(new Set(profiles.map((p) => p.id)));
  }, [profiles]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) return <Loading />;

  if (profiles.length === 0) {
    return (
      <EmptyState
        icon={<Inbox size={32} strokeWidth={1.5} className="text-gray-300" />}
        title="尚無需求卡"
        description="建立需求卡後，才能接收房東的媒合興趣"
      />
    );
  }

  function toggle(id: string) {
    setExpandedSet((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-3">
      {profiles.map((profile) => (
        <ProfileIncoming
          key={profile.id}
          profile={profile}
          expanded={expandedSet.has(profile.id)}
          onToggle={() => toggle(profile.id)}
          onMatched={() => qc.invalidateQueries({ queryKey: ["matched"] })}
        />
      ))}
    </div>
  );
}

function ProfileIncoming({
  profile,
  expanded,
  onToggle,
  onMatched,
}: {
  profile: TenantProfile;
  expanded: boolean;
  onToggle: () => void;
  onMatched: () => void;
}) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{ items: IncomingListingItem[] }>({
    queryKey: ["incoming", profile.id],
    queryFn: () =>
      api
        .get(`/tenant-profiles/${profile.id}/interests/incoming?limit=50`)
        .then((r) => r.data),
    enabled: expanded,
  });
  const [detail, setDetail] = useState<MatchedListingCard | null>(null);

  const expressInterest = useMutation({
    mutationFn: (listingId: string) =>
      api.post(`/tenant-profiles/${profile.id}/listings/${listingId}/interest`),
    onSuccess: (res) => {
      if (res.data.status === "matched") onMatched();
      qc.invalidateQueries({ queryKey: ["incoming", profile.id] });
    },
  });

  const items = data?.items ?? [];
  const pendingCount = items.filter((i) => !i.interest_sent).length;

  return (
    <>
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <button
          type="button"
          onClick={onToggle}
          className="flex w-full items-center justify-between px-4 py-3 text-left"
        >
          <span className="text-sm font-medium text-gray-700">{profile.name}</span>
          <div className="flex items-center gap-2">
            {pendingCount > 0 && (
              <span className="bg-primary-600 rounded-full px-2 py-0.5 text-xs font-medium text-white">
                {pendingCount}
              </span>
            )}
            <ChevronDown
              size={16}
              strokeWidth={1.5}
              className={`text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`}
            />
          </div>
        </button>
        {expanded && (
          <div className="border-t border-gray-100 px-3 py-3">
            {isLoading && <Loading />}
            {!isLoading && items.length === 0 && (
              <p className="py-4 text-center text-sm text-gray-400">目前無房東表示興趣</p>
            )}
            <div className="space-y-3">
              {items.map((item) => {
                const card = toListingCard(item);
                return (
                  <ListingCard
                    key={item.listing_id}
                    listing={card}
                    onClick={() => setDetail(card)}
                    action={
                      item.interest_sent ? (
                        <span className="rounded-full bg-[#EDE9FE] px-2.5 py-0.5 text-xs font-medium text-[#5B21B6]">
                          已送出
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => expressInterest.mutate(item.listing_id)}
                          className="bg-primary-600 hover:bg-primary-500 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition"
                        >
                          回應興趣
                        </button>
                      )
                    }
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>
      {detail && (
        <ListingDetailDialog
          listing={detail}
          onClose={() => setDetail(null)}
          action={
            detail.interest_sent ? (
              <p className="text-center text-sm text-gray-400">
                已送出興趣，等待房東回應
              </p>
            ) : (
              <button
                type="button"
                onClick={() => {
                  expressInterest.mutate(detail.id);
                  setDetail(null);
                }}
                className="bg-primary-600 hover:bg-primary-500 w-full rounded-lg py-3 text-sm font-medium text-white transition"
              >
                回應興趣
              </button>
            )
          }
        />
      )}
    </>
  );
}

// ---- Outgoing ----

function OutgoingTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{ items: OutgoingItem[] }>({
    queryKey: ["outgoing"],
    queryFn: () => api.get("/matches/outgoing?limit=50").then((r) => r.data),
  });
  const [detail, setDetail] = useState<OutgoingItem | null>(null);
  const [confirmEl, confirm] = useConfirm();

  const withdraw = useMutation({
    mutationFn: (i: OutgoingItem) =>
      api.delete(
        `/tenant-profiles/${i.tenant_profile_id}/listings/${i.listing_id}/interest`
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["outgoing"] });
      setDetail(null);
    },
  });

  if (isLoading) return <Loading />;

  if ((data?.items ?? []).length === 0) {
    return (
      <EmptyState
        icon={<SendHorizonal size={32} strokeWidth={1.5} className="text-gray-300" />}
        title="尚未送出任何興趣"
        description="前往找房源，對感興趣的房源按「有興趣」"
      />
    );
  }

  return (
    <>
      <div className="space-y-3">
        {(data?.items ?? []).map((i) => {
          const card = toListingCard(i);
          return (
            <ListingCard
              key={i.listing_id}
              listing={card}
              onClick={() => setDetail(i)}
              action={
                <button
                  type="button"
                  disabled={withdraw.isPending}
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (
                      await confirm({
                        message: "確定收回對這筆房源的興趣？",
                        confirmText: "收回興趣",
                        danger: true,
                      })
                    )
                      withdraw.mutate(i);
                  }}
                  className="rounded-full border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
                >
                  收回興趣
                </button>
              }
            />
          );
        })}
      </div>
      {detail && (
        <ListingDetailDialog
          listing={toListingCard(detail)}
          onClose={() => setDetail(null)}
          action={
            <button
              type="button"
              disabled={withdraw.isPending}
              onClick={async () => {
                if (
                  await confirm({
                    message: "確定收回對這筆房源的興趣？",
                    confirmText: "收回興趣",
                    danger: true,
                  })
                )
                  withdraw.mutate(detail);
              }}
              className="w-full rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
            >
              收回興趣
            </button>
          }
        />
      )}
      {confirmEl}
    </>
  );
}

// ---- Matched ----

function MatchedTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{ items: MatchItem[] }>({
    queryKey: ["matched"],
    queryFn: () => api.get("/matches/mutual?limit=50").then((r) => r.data),
  });
  // Cross-reference existing viewings so each matched listing shows 預約/已預約 state.
  const { data: viewingsData } = useQuery<{ items: Viewing[] }>({
    queryKey: ["viewings", "tenant"],
    queryFn: () => api.get("/viewings?role=tenant").then((r) => r.data),
  });
  const viewingByListing = new Map<string, Viewing>();
  for (const v of viewingsData?.items ?? []) {
    if (v.status === "confirmed") viewingByListing.set(v.listing_id, v);
  }

  const [detail, setDetail] = useState<{
    card: MatchedListingCard;
    contactInfo: string;
  } | null>(null);
  const [bookFor, setBookFor] = useState<MatchItem | null>(null);

  const book = useMutation({
    mutationFn: (p: { matchId: string; startsAt: string }) =>
      api.post("/viewings", { match_id: p.matchId, starts_at: p.startsAt }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["viewings"] });
      qc.invalidateQueries({ queryKey: ["viewing-slots"] });
    },
  });

  if (isLoading) return <Loading />;

  if ((data?.items ?? []).length === 0) {
    return (
      <EmptyState
        icon={<Heart size={32} strokeWidth={1.5} className="text-gray-300" />}
        title="尚無媒合結果"
        description="繼續瀏覽房源，或等待房東對你的需求卡表示興趣"
      />
    );
  }

  return (
    <>
      <div className="space-y-3">
        {(data?.items ?? []).map((m) => {
          const card = toListingCard({
            listing_id: m.listing_id,
            listing_name: m.listing_name,
            rent: m.rent ?? 0,
            room_type: m.room_type ?? "",
            area_ping: m.area_ping ?? 0,
            location_id: m.location_id,
            photos: m.photos,
            available_from: m.available_from,
            allow_pets: m.allow_pets,
            allow_subsidy: m.allow_subsidy,
            allow_tax_receipt: m.allow_tax_receipt,
            allow_household_registration: m.allow_household_registration,
            allow_cooking: m.allow_cooking,
            has_parking: m.has_parking,
            allow_smoking: m.allow_smoking,
            address: m.address,
            lat: m.lat,
            lng: m.lng,
          });
          const viewing = viewingByListing.get(m.listing_id);
          const rented = m.status === "listing_rented";
          return (
            <ListingCard
              key={m.match_id}
              listing={card}
              onClick={() => setDetail({ card, contactInfo: m.contact_info })}
              contactInfo={m.contact_info}
              action={
                rented ? (
                  <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500">
                    房東已標記出租
                  </span>
                ) : viewing ? (
                  <span className="rounded-full bg-[#D1FAE5] px-2.5 py-0.5 text-xs font-medium text-[#059669]">
                    已預約 {formatSlot(viewing.starts_at, viewing.ends_at)}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setBookFor(m);
                    }}
                    className="bg-primary-600 hover:bg-primary-500 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition"
                  >
                    預約看房
                  </button>
                )
              }
            />
          );
        })}
      </div>
      {detail && (
        <ListingDetailDialog
          listing={detail.card}
          onClose={() => setDetail(null)}
          contactInfo={detail.contactInfo}
        />
      )}
      {bookFor && (
        <BookViewingModal
          match={bookFor}
          pending={book.isPending}
          onClose={() => setBookFor(null)}
          onSubmit={(startsAt) =>
            book.mutate(
              { matchId: bookFor.match_id, startsAt },
              { onSuccess: () => setBookFor(null) }
            )
          }
        />
      )}
    </>
  );
}

// BookViewingModal lets a matched tenant pick an open 帶看 slot and book it.
function BookViewingModal({
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

// ---- Profile Form Modal ----

function ProfileFormModal({
  editingProfile,
  onClose,
  onSaved,
}: {
  editingProfile: TenantProfile | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(() => ({
    name: editingProfile?.name ?? "",
    budget_min: editingProfile?.budget_min ?? 0,
    budget_max: editingProfile?.budget_max ?? 0,
    locations: editingProfile?.locations ?? ([] as string[]),
    preferred_room_types: editingProfile?.preferred_room_types ?? ([] as string[]),
    available_from: editingProfile?.available_from
      ? new Date(editingProfile.available_from).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0],
    min_lease_months: editingProfile?.min_lease_months ?? 12,
    min_area_ping: editingProfile?.min_area_ping
      ? String(editingProfile.min_area_ping)
      : "",
    has_pets: editingProfile?.has_pets ?? false,
    pet_description: editingProfile?.pet_description ?? "",
    needs_subsidy: editingProfile?.needs_subsidy ?? false,
    needs_tax_receipt: editingProfile?.needs_tax_receipt ?? false,
    needs_household_registration: editingProfile?.needs_household_registration ?? false,
    needs_cooking: editingProfile?.needs_cooking ?? false,
    needs_parking: editingProfile?.needs_parking ?? false,
    smoking: editingProfile?.smoking ?? false,
    occupation: editingProfile?.occupation ?? "",
    age: editingProfile?.age ? String(editingProfile.age) : "",
    description: editingProfile?.description ?? "",
    contact_info: editingProfile?.contact_info ?? "",
  }));
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [formSaved, setFormSaved] = useState(false);
  const [locPickerOpen, setLocPickerOpen] = useState(false);

  function toggleLoc(id: string) {
    setForm((f) => ({
      ...f,
      locations: f.locations.includes(id)
        ? f.locations.filter((l) => l !== id)
        : [...f.locations, id],
    }));
  }

  function toggleRoomType(rt: string) {
    setForm((f) => ({
      ...f,
      preferred_room_types: f.preferred_room_types.includes(rt)
        ? f.preferred_room_types.filter((t) => t !== rt)
        : [...f.preferred_room_types, rt],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("請填寫需求名稱");
      return;
    }
    if (!form.budget_min || form.budget_min <= 0) {
      setError("請填寫最低預算");
      return;
    }
    if (!form.budget_max || form.budget_max <= 0) {
      setError("請填寫最高預算");
      return;
    }
    if (form.budget_min > form.budget_max) {
      setError("最低預算不能高於最高預算");
      return;
    }
    if (form.locations.length === 0) {
      setError("請至少選擇一個地區");
      return;
    }
    if (form.preferred_room_types.length === 0) {
      setError("請至少選擇一種偏好房型");
      return;
    }
    if (form.min_area_ping !== "" && Number(form.min_area_ping) >= 1000) {
      setError("最大坪數不得超過 999.99");
      return;
    }
    if (!form.available_from) {
      setError("請填寫最快入住日");
      return;
    }
    if (!form.min_lease_months || form.min_lease_months <= 0) {
      setError("請填寫最短租期");
      return;
    }
    if (!form.contact_info.trim()) {
      setError("請填寫聯絡方式");
      return;
    }
    setLoading(true);
    setError("");
    const payload = {
      ...form,
      locations: form.locations.map((id) => LOCATION_CITY_DISTRICT[id]).filter(Boolean),
      budget_min: Number(form.budget_min),
      budget_max: Number(form.budget_max),
      min_lease_months: Number(form.min_lease_months),
      min_area_ping: form.min_area_ping ? Number(form.min_area_ping) : null,
      age: form.age ? Number(form.age) : null,
      available_from: form.available_from
        ? `${form.available_from}T00:00:00Z`
        : form.available_from,
    };
    try {
      if (editingProfile) {
        await api.put(`/tenant-profiles/${editingProfile.id}`, payload);
        setFormSaved(true);
        setTimeout(() => setFormSaved(false), 2000);
      } else {
        await api.post("/tenant-profiles", payload);
      }
      onSaved();
    } catch (err: unknown) {
      const fe = extractFieldErrors(err);
      if (Object.keys(fe).length > 0) {
        setFieldErrors(fe);
        setError("請修正欄位錯誤");
      } else if (err && typeof err === "object" && "response" in err) {
        const axiosErr = err as { response?: { data?: { error?: string } } };
        setError(axiosErr.response?.data?.error ?? "發生錯誤");
      } else {
        setError("發生錯誤");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="關閉"
        onClick={onClose}
      />
      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white sm:rounded-2xl">
        {/* Header */}
        <div className="flex flex-shrink-0 items-center justify-between border-b border-gray-100 px-6 py-4">
          <h3 className="text-base font-semibold text-gray-950">
            {editingProfile ? "編輯需求卡" : "新增需求卡"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700"
            aria-label="關閉"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
          <div className="no-scrollbar flex-1 space-y-4 overflow-y-auto px-6 py-4">
            <div>
              <label
                htmlFor="profile-name"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                需求名稱（如：台北套房）<span className="ml-0.5 text-red-500">*</span>
              </label>
              <input
                id="profile-name"
                required
                value={form.name}
                onChange={(e) => {
                  setForm((f) => ({ ...f, name: e.target.value }));
                  if (fieldErrors.name) setFieldErrors((fe) => ({ ...fe, name: "" }));
                }}
                className={`input ${fieldErrors.name ? "border-red-500" : ""}`}
                placeholder="例：台北大安套房"
              />
              {fieldErrors.name && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.name}</p>
              )}
            </div>

            {/* Budget quick-select chips */}
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  [10000, 15000, "1–1.5 萬"],
                  [15000, 20000, "1.5–2 萬"],
                  [20000, 30000, "2–3 萬"],
                  [30000, 50000, "3–5 萬"],
                  [50000, 100000, "5 萬以上"],
                ] as [number, number, string][]
              ).map(([mn, mx, label]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() =>
                    setForm((f) => ({ ...f, budget_min: mn, budget_max: mx }))
                  }
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    form.budget_min === mn && form.budget_max === mx
                      ? "bg-primary-600 text-white"
                      : "border border-gray-200 text-gray-600 hover:border-gray-400"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="budget-min"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  最低預算（元）<span className="ml-0.5 text-red-500">*</span>
                </label>
                <input
                  id="budget-min"
                  required
                  type="number"
                  min={0}
                  value={form.budget_min || ""}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, budget_min: Number(e.target.value) }));
                    if (fieldErrors.budget_min)
                      setFieldErrors((fe) => ({ ...fe, budget_min: "" }));
                  }}
                  className={`input ${fieldErrors.budget_min ? "border-red-500" : ""}`}
                />
                {fieldErrors.budget_min && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.budget_min}</p>
                )}
              </div>
              <div>
                <label
                  htmlFor="budget-max"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  最高預算（元）<span className="ml-0.5 text-red-500">*</span>
                </label>
                <input
                  id="budget-max"
                  required
                  type="number"
                  min={0}
                  value={form.budget_max || ""}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, budget_max: Number(e.target.value) }));
                    if (fieldErrors.budget_max)
                      setFieldErrors((fe) => ({ ...fe, budget_max: "" }));
                  }}
                  className={`input ${fieldErrors.budget_max ? "border-red-500" : ""}`}
                />
                {fieldErrors.budget_max && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.budget_max}</p>
                )}
              </div>
            </div>

            <div>
              <p className="mb-1 text-sm font-medium text-gray-700">
                可接受地區（多選）<span className="ml-0.5 text-red-500">*</span>
              </p>
              <button
                type="button"
                onClick={() => setLocPickerOpen(true)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:border-gray-400 hover:text-gray-800"
              >
                {form.locations.length > 0
                  ? `已選 ${form.locations.length} 個地區`
                  : "選擇地區 ›"}
              </button>
              {form.locations.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {form.locations.map((id) => (
                    <span
                      key={id}
                      className="flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-0.5 text-xs text-orange-700"
                    >
                      {LOCATION_LABELS[id] ?? id}
                      <button
                        type="button"
                        onClick={() => toggleLoc(id)}
                        className="ml-0.5 text-orange-400 hover:text-orange-600"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <LocationPicker
                open={locPickerOpen}
                value={form.locations}
                onChange={(ids) => setForm((f) => ({ ...f, locations: ids }))}
                onClose={() => setLocPickerOpen(false)}
              />
            </div>

            <div>
              <p className="mb-1 text-sm font-medium text-gray-700">
                偏好房型（多選）<span className="ml-0.5 text-red-500">*</span>
              </p>
              <div className="flex gap-2">
                {Object.entries(ROOM_TYPE_LABELS).map(([rt, label]) => (
                  <button
                    key={rt}
                    type="button"
                    onClick={() => toggleRoomType(rt)}
                    className={`rounded-full px-3 py-1 text-sm font-medium transition ${
                      form.preferred_room_types.includes(rt)
                        ? "bg-primary-600 text-white"
                        : "border border-gray-200 text-gray-600 hover:border-gray-400"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="available-from"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  最快入住日<span className="ml-0.5 text-red-500">*</span>
                </label>
                <input
                  id="available-from"
                  required
                  type="date"
                  min={new Date().toISOString().split("T")[0]}
                  value={form.available_from}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, available_from: e.target.value }))
                  }
                  className="input"
                />
              </div>
              <div>
                <label
                  htmlFor="min-lease"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  最短租期（月）<span className="ml-0.5 text-red-500">*</span>
                </label>
                <input
                  id="min-lease"
                  required
                  type="number"
                  min={1}
                  value={form.min_lease_months || ""}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      min_lease_months: Number(e.target.value),
                    }))
                  }
                  className="input"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="min-area"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                最小坪數（可不填）
              </label>
              <input
                id="min-area"
                type="number"
                min={1}
                value={form.min_area_ping}
                onChange={(e) =>
                  setForm((f) => ({ ...f, min_area_ping: e.target.value }))
                }
                className="input"
                placeholder="不限"
              />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">條件</p>
              {(
                [
                  ["has_pets", "我有養寵物"],
                  ["needs_subsidy", "需要租補"],
                  ["needs_tax_receipt", "需要報稅收據"],
                  ["needs_household_registration", "需要入籍"],
                  ["needs_cooking", "需要開伙"],
                  ["needs_parking", "需要車位"],
                  ["smoking", "會抽菸"],
                ] as const
              ).map(([key, label]) => (
                <label
                  key={key}
                  className="flex cursor-pointer items-center gap-2 text-sm text-gray-700"
                >
                  <input
                    type="checkbox"
                    checked={form[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.checked }))}
                    className="accent-primary-600 h-4 w-4 rounded border-gray-300"
                  />
                  {label}
                </label>
              ))}
            </div>

            {form.has_pets && (
              <div>
                <label
                  htmlFor="pet-desc"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  寵物描述（選填）
                </label>
                <input
                  id="pet-desc"
                  value={form.pet_description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, pet_description: e.target.value }))
                  }
                  className="input"
                  placeholder="例：一隻小型犬，已結紮"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="occupation"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  職業（選填）
                </label>
                <input
                  id="occupation"
                  value={form.occupation}
                  onChange={(e) => setForm((f) => ({ ...f, occupation: e.target.value }))}
                  className="input"
                  placeholder="例：上班族、學生"
                />
              </div>
              <div>
                <label
                  htmlFor="age"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  年齡（選填）
                </label>
                <input
                  id="age"
                  type="number"
                  min={18}
                  max={120}
                  value={form.age}
                  onChange={(e) => setForm((f) => ({ ...f, age: e.target.value }))}
                  className="input"
                  placeholder="例：28"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="description"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                自我介紹（選填）
              </label>
              <textarea
                id="description"
                rows={4}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="input resize-none"
                placeholder="介紹自己的生活習慣、工作狀況或其他想讓房東了解的資訊"
              />
            </div>

            <div>
              <label
                htmlFor="contact-info"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                聯絡方式（媒合成功後才對房東顯示）
                <span className="ml-0.5 text-red-500">*</span>
              </label>
              <input
                id="contact-info"
                required
                value={form.contact_info}
                onChange={(e) => {
                  setForm((f) => ({ ...f, contact_info: e.target.value }));
                  if (fieldErrors.contact_info)
                    setFieldErrors((fe) => ({ ...fe, contact_info: "" }));
                }}
                className={`input ${fieldErrors.contact_info ? "border-red-500" : ""}`}
                placeholder="例：Line ID: xxx 或 0912-345-678"
              />
              {fieldErrors.contact_info ? (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.contact_info}</p>
              ) : (
                <p className="mt-1 text-xs text-gray-400">
                  媒合成功後才會顯示給對方，請填真實聯絡方式
                </p>
              )}
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>

          {/* Sticky bottom bar */}
          <div className="flex-shrink-0 space-y-2 border-t border-gray-100 bg-white px-6 pt-3 pb-[max(16px,env(safe-area-inset-bottom))]">
            <button
              type="submit"
              disabled={loading || formSaved}
              className="bg-primary-600 hover:bg-primary-500 w-full rounded-lg py-3 text-sm font-medium text-white transition disabled:opacity-40"
            >
              {loading
                ? "儲存中…"
                : editingProfile
                  ? formSaved
                    ? "已儲存 ✓"
                    : "儲存"
                  : "建立需求卡"}
            </button>
            {editingProfile && (
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-lg border border-gray-200 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                關閉
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

// ---- Shared UI ----

