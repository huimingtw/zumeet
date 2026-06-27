"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  CalendarClock,
  ChevronDown,
  Heart,
  Inbox,
  MoreHorizontal,
  Search,
  SearchX,
  SendHorizonal,
} from "lucide-react";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { useConfirm } from "@/components/ConfirmDialog";
import { RoleGuard } from "@/components/RoleGuard";
import { Dropdown } from "@/components/ui/Dropdown";
import { BottomTabItem } from "@/components/ui/BottomTabItem";
import { EmptyState } from "@/components/ui/EmptyState";
import { Loading } from "@/components/ui/Loading";
import { SkeletonListingMgmtCard, SkeletonProfileCard } from "@/components/ui/Skeletons";
import { TabButton } from "@/components/ui/TabButton";
import { api, extractFieldErrors } from "@/lib/api";
import { getProfileTags } from "@/lib/listingTags";
import type {
  Listing,
  MatchedTenantProfileCard,
  ViewingAvailability,
} from "@/types";
import { LOCATION_CITY_DISTRICT, LOCATION_GROUPS, ROOM_TYPE_LABELS } from "@/types";
import { WEEKDAY_LABELS } from "@/lib/viewings";
import { ViewingList } from "@/components/ViewingList";
import { qk } from "@/features/queryKeys";
import {
  useListings,
  useListingDetail,
  useListingEdit,
  useProfilesBrowse,
  useViewingAvailability,
} from "@/features/listings/useListings";
import { MatchesView } from "@/features/matches/MatchesView";
import { profileHeader } from "@/features/matches/LandlordMatches";
import { ExpandableText } from "@/components/ui/ExpandableText";

type MainTab = "listings" | "browse" | "matches" | "viewings";
type MatchesSubTab = "incoming" | "outgoing" | "matched"; // kept for local state typing

const STATUS_LABELS: Record<string, string> = {
  draft: "草稿",
  active: "刊登中",
  paused: "暫停",
  rented: "已出租",
};

export default function LandlordDashboard() {
  return (
    <RoleGuard role="landlord">
      <LandlordDashboardInner />
    </RoleGuard>
  );
}

function LandlordDashboardInner() {
  const [tab, setTab] = useState<MainTab>("listings");
  const [matchesSubTab, setMatchesSubTab] = useState<MatchesSubTab>("incoming");
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);

  function goToBrowse(id: string) {
    setSelectedListingId(id);
    setTab("browse");
  }

  return (
    <div className="min-h-screen pb-14 sm:pb-0">
      <DashboardHeader />

      <div className="mx-auto max-w-4xl px-4 pt-4">
        {/* Desktop tab nav */}
        <nav className="mb-6 hidden gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-sm sm:flex">
          <TabButton
            active={tab === "listings"}
            onClick={() => setTab("listings")}
            icon={<Building2 size={20} strokeWidth={1.5} />}
            label="我的房源"
          />
          <TabButton
            active={tab === "browse"}
            onClick={() => setTab("browse")}
            icon={<Search size={20} strokeWidth={1.5} />}
            label="找租客"
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
            label="帶看"
          />
        </nav>

        {tab === "listings" && <ListingsTab onSelectListing={goToBrowse} />}
        {tab === "browse" && (
          <BrowseTab
            selectedListingId={selectedListingId}
            onSelectListing={setSelectedListingId}
            onGoToListings={() => setTab("listings")}
          />
        )}
        {tab === "matches" && (
          <MatchesView role="landlord" subTab={matchesSubTab} onSubTabChange={setMatchesSubTab} />
        )}
        {tab === "viewings" && <ViewingsView />}
      </div>

      {/* Mobile bottom tab bar */}
      <nav className="fixed right-0 bottom-0 left-0 z-40 h-14 border-t border-gray-200 bg-white sm:hidden">
        <div className="flex h-full">
          <BottomTabItem
            active={tab === "listings"}
            onClick={() => setTab("listings")}
            icon={<Building2 size={20} strokeWidth={1.5} />}
            label="我的房源"
          />
          <BottomTabItem
            active={tab === "browse"}
            onClick={() => setTab("browse")}
            icon={<Search size={20} strokeWidth={1.5} />}
            label="找租客"
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

// ---- Shared nav ----

// ---- Listings Tab ----


function ListingsTab({ onSelectListing }: { onSelectListing: (id: string) => void }) {
  const qc = useQueryClient();
  const { data: listings = [], isLoading } = useListings();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<"all" | "active" | "rented">("all");

  const filtered =
    filter === "all" ? listings : listings.filter((l) => l.status === filter);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[0, 1].map((i) => (
          <SkeletonListingMgmtCard key={i} />
        ))}
      </div>
    );
  }

  if (!isLoading && listings.length === 0) {
    return (
      <>
        <EmptyState
          icon={<Building2 size={32} strokeWidth={1.5} className="text-gray-300" />}
          title="尚無房源"
          description="建立第一筆房源，就能開始找符合條件的租客"
          action={{
            label: "新增第一筆房源",
            onClick: () => {
              setEditingId(null);
              setShowForm(true);
            },
          }}
        />
        {showForm && (
          <ListingFormModal
            editingId={null}
            onClose={() => setShowForm(false)}
            onSaved={() => {
              qc.invalidateQueries({ queryKey: qk.listings() });
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
        <h2 className="text-base font-semibold text-gray-950">我的房源</h2>
        <button
          type="button"
          onClick={() => {
            setEditingId(null);
            setShowForm(true);
          }}
          className="bg-primary-600 hover:bg-primary-500 rounded-lg px-3 py-1.5 text-sm font-medium text-white transition"
        >
          + 新增房源
        </button>
      </div>
      <div className="mb-4 flex gap-1.5">
        {(
          [
            ["all", "全部"],
            ["active", "刊登中"],
            ["rented", "已出租"],
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
      {filtered.length === 0 && (
        <p className="py-8 text-center text-sm text-gray-400">此分類沒有房源</p>
      )}
      <div className="space-y-3">
        {filtered.map((l) => (
          <ListingCard
            key={l.id}
            listing={l}
            onEdit={() => {
              setEditingId(l.id);
              setShowForm(true);
            }}
            onBrowse={() => onSelectListing(l.id)}
            onChanged={() => qc.invalidateQueries({ queryKey: qk.listings() })}
          />
        ))}
      </div>
      {showForm && (
        <ListingFormModal
          editingId={editingId}
          onClose={() => {
            setShowForm(false);
            setEditingId(null);
          }}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: qk.listings() });
            setShowForm(false);
            setEditingId(null);
          }}
        />
      )}
    </div>
  );
}

function ListingCard({
  listing,
  onEdit,
  onBrowse,
  onChanged,
}: {
  listing: Listing;
  onEdit: () => void;
  onBrowse: () => void;
  onChanged: () => void;
}) {
  const qc = useQueryClient();

  const changeStatus = useMutation({
    mutationFn: (status: string) =>
      api.patch(`/listings/${listing.id}/status`, { status }),
    onSuccess: () => {
      onChanged();
      qc.invalidateQueries({ queryKey: qk.listings() });
    },
  });
  const deleteListing = useMutation({
    mutationFn: () => api.delete(`/listings/${listing.id}`),
    onSuccess: onChanged,
  });

  const statusBadgeClass =
    listing.status === "active"
      ? "bg-[#D1FAE5] text-[#059669]"
      : listing.status === "draft"
        ? "bg-[#FEF3C7] text-[#92400E]"
        : listing.status === "rented"
          ? "bg-blue-100 text-blue-700"
          : "bg-gray-100 text-gray-500";

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {listing.name && (
              <span className="text-base font-semibold text-gray-950">
                {listing.name}
              </span>
            )}
            <span
              className={
                listing.name
                  ? "text-sm text-gray-500"
                  : "text-base font-semibold text-gray-950"
              }
            >
              ${listing.rent.toLocaleString()}
            </span>
            <span className="text-sm text-gray-500">
              {ROOM_TYPE_LABELS[listing.room_type] ?? listing.room_type}{" "}
              {listing.area_ping}坪
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass}`}
            >
              {STATUS_LABELS[listing.status] ?? listing.status}
            </span>
          </div>
          <p className="mt-1 text-xs text-gray-400">
            可入住：{new Date(listing.available_from).toLocaleDateString("zh-TW")} ／{" "}
            {listing.photos.length} 張照片
          </p>
        </div>

        <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
          {/* Primary CTA */}
          {listing.status === "draft" && (
            <button
              type="button"
              onClick={() => changeStatus.mutate("active")}
              disabled={listing.photos.length === 0}
              title={listing.photos.length === 0 ? "請先上傳至少一張照片" : ""}
              className="rounded-lg bg-[#10B981] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[#059669] disabled:opacity-40"
            >
              發布上架
            </button>
          )}
          {listing.status === "active" && (
            <button
              type="button"
              onClick={onBrowse}
              className="bg-primary-600 hover:bg-primary-500 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition"
            >
              找租客
            </button>
          )}
          {listing.status === "paused" && (
            <button
              type="button"
              onClick={() => changeStatus.mutate("active")}
              className="rounded-lg bg-[#10B981] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[#059669]"
            >
              重新上架
            </button>
          )}

          {/* Fixed secondary */}
          <button
            type="button"
            onClick={onEdit}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-700 transition hover:bg-gray-50"
          >
            編輯
          </button>

          {/* Overflow menu */}
          <OverflowMenu>
            {listing.status === "active" && (
              <>
                <MenuItem onClick={() => changeStatus.mutate("paused")}>
                  暫停曝光
                </MenuItem>
                <MenuItem onClick={() => changeStatus.mutate("rented")}>
                  標記已出租
                </MenuItem>
              </>
            )}
            <MenuItem
              danger
              onClick={() => {
                if (confirm("確定刪除這筆房源？")) deleteListing.mutate();
              }}
            >
              刪除
            </MenuItem>
          </OverflowMenu>
        </div>
      </div>
    </div>
  );
}

// ---- Overflow Menu ----

function OverflowMenu({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-lg border border-gray-200 px-2 py-1.5 text-gray-700 transition hover:bg-gray-50"
        aria-label="更多動作"
      >
        <MoreHorizontal size={16} strokeWidth={1.5} />
      </button>
      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-10"
            aria-label="關閉選單"
            onClick={() => setOpen(false)}
          />
          <div className="absolute top-9 right-0 z-20 min-w-[9rem] rounded-xl border border-gray-200 bg-white py-1 shadow-md">
            {children}
          </div>
        </>
      )}
    </div>
  );
}

function MenuItem({
  onClick,
  danger,
  children,
}: {
  onClick: () => void;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full px-4 py-2 text-left text-sm transition hover:bg-gray-50 ${
        danger ? "text-red-600" : "text-gray-700"
      }`}
    >
      {children}
    </button>
  );
}

// ---- Photo Manager ----

type PhotoRecord = { id: string; public_url: string; position: number };

// ---- Browse Tab ----

function BrowseTab({
  selectedListingId,
  onSelectListing,
  onGoToListings,
}: {
  selectedListingId: string | null;
  onSelectListing: (id: string) => void;
  onGoToListings: () => void;
}) {
  const { data: listings = [] } = useListings();

  const activeListings = listings.filter((l) => l.status === "active");
  const currentId =
    activeListings.find((l) => l.id === selectedListingId)?.id ??
    activeListings[0]?.id ??
    null;

  const qc = useQueryClient();
  const { data, isLoading } = useProfilesBrowse(currentId ?? "");

  const expressInterest = useMutation({
    mutationFn: (profileId: string) =>
      api.post(`/listings/${currentId}/tenant-profiles/${profileId}/interest`),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.profilesBrowse(currentId) }),
  });

  if (activeListings.length === 0) {
    return (
      <EmptyState
        icon={<Search size={32} strokeWidth={1.5} className="text-gray-300" />}
        title="請先將房源設為刊登中"
        description="上架房源後，系統才能為你媒合符合條件的租客"
        action={{ label: "前往我的房源", onClick: onGoToListings }}
      />
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <span className="text-sm font-medium text-gray-700">使用房源</span>
        <div className="w-56">
          <Dropdown
            value={currentId ?? ""}
            placeholder="請選擇房源"
            options={activeListings.map((l) => ({
              value: l.id,
              label:
                l.name ||
                `$${l.rent.toLocaleString()} ${ROOM_TYPE_LABELS[l.room_type] ?? l.room_type}`,
            }))}
            onChange={onSelectListing}
          />
        </div>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <SkeletonProfileCard key={i} />
          ))}
        </div>
      )}
      {!isLoading && (data?.items ?? []).length === 0 && (
        <EmptyState
          icon={<SearchX size={32} strokeWidth={1.5} className="text-gray-300" />}
          title="目前無符合條件的租客需求卡"
          description="符合條件的租客尚未刊登需求，可稍後再查看"
        />
      )}
      <div className="space-y-3">
        {(data?.items ?? []).map((profile) => (
          <TenantProfileCard
            key={profile.id}
            profile={profile}
            onInterest={() => expressInterest.mutate(profile.id)}
          />
        ))}
      </div>
    </div>
  );
}


function TenantProfileCard({
  profile,
  onInterest,
}: {
  profile: MatchedTenantProfileCard;
  onInterest: () => void;
}) {
  const tags = getProfileTags(profile);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-sm font-semibold text-gray-950">
              {profileHeader(profile)}
            </span>
          </div>
          {profile.description && (
            <ExpandableText
              text={profile.description}
              className="mt-1.5 text-sm text-gray-600"
            />
          )}
          {tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-[#EDE9FE] px-3 py-1 text-xs font-medium text-[#5B21B6]"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-shrink-0 items-center">
          {profile.interest_sent ? (
            <span className="rounded-full bg-[#EDE9FE] px-2.5 py-0.5 text-xs font-medium text-[#5B21B6]">
              已送出
            </span>
          ) : (
            <button
              type="button"
              onClick={onInterest}
              className="bg-primary-600 hover:bg-primary-500 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition"
            >
              有興趣
            </button>
          )}
        </div>
      </div>
    </div>
  );
}



// ---- Listing Form Modal ----

function PhotoSection({
  listingId,
  onChanged,
}: {
  listingId: string;
  onChanged: () => void;
}) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadProgress, setUploadProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [uploadError, setUploadError] = useState("");

  const { data: listing } = useListingDetail(listingId);

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const remaining = 10 - photos.length;
    const all = Array.from(e.target.files ?? []);
    const files = all.slice(0, remaining);
    if (files.length === 0) return;
    setUploadProgress({ done: 0, total: files.length });
    setUploadError(
      all.length > remaining
        ? `已選 ${all.length} 張，僅上傳前 ${remaining} 張（上限 10 張）`
        : ""
    );
    let succeeded = 0;
    try {
      for (let i = 0; i < files.length; i++) {
        const fd = new FormData();
        fd.append("photo", files[i]);
        try {
          await api.post(`/listings/${listingId}/photos`, fd);
          succeeded++;
          setUploadProgress({ done: i + 1, total: files.length });
        } catch (err: unknown) {
          const msg =
            err && typeof err === "object" && "response" in err
              ? (err as { response?: { data?: { error?: string } } }).response?.data
                  ?.error
              : undefined;
          setUploadError(msg ?? "上傳失敗");
          break;
        }
      }
    } finally {
      if (succeeded > 0) {
        qc.invalidateQueries({ queryKey: qk.listingDetail(listingId) });
        onChanged();
      }
      setUploadProgress(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const deletePhoto = useMutation({
    mutationFn: (photoId: string) =>
      api.delete(`/listings/${listingId}/photos/${photoId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.listingDetail(listingId) });
      onChanged();
    },
  });

  const reorderPhotos = useMutation({
    mutationFn: (photoIds: string[]) =>
      api.patch(`/listings/${listingId}/photos/order`, { photo_ids: photoIds }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.listingDetail(listingId) });
      onChanged();
    },
  });

  const serverPhotos: PhotoRecord[] = listing?.photo_list ?? [];
  // Local order overlay so drag feels instant; cleared when server order matches.
  const [localOrder, setLocalOrder] = useState<string[] | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const photos: PhotoRecord[] = localOrder
    ? (localOrder
        .map((id) => serverPhotos.find((p) => p.id === id))
        .filter(Boolean) as PhotoRecord[])
    : serverPhotos;

  useEffect(() => {
    if (!localOrder) return;
    const serverIds = serverPhotos.map((p) => p.id).join(",");
    if (serverIds === localOrder.join(",")) setLocalOrder(null);
  }, [serverPhotos, localOrder]);

  function onDragStart(id: string) {
    setDragId(id);
  }
  function onDragOver(e: React.DragEvent, overId: string) {
    e.preventDefault();
    if (!dragId || dragId === overId) return;
    const current = (localOrder ?? serverPhotos.map((p) => p.id)).slice();
    const from = current.indexOf(dragId);
    const to = current.indexOf(overId);
    if (from < 0 || to < 0) return;
    current.splice(from, 1);
    current.splice(to, 0, dragId);
    setLocalOrder(current);
  }
  function onDragEnd() {
    const order = localOrder;
    setDragId(null);
    if (!order) return;
    const original = serverPhotos.map((p) => p.id);
    if (order.join(",") === original.join(",")) return;
    reorderPhotos.mutate(order);
  }

  return (
    <div>
      <p className="mb-2 text-sm font-medium text-gray-700">
        照片（最多 10 張，可拖曳調整順序）
      </p>
      <div className="mb-3 grid grid-cols-3 gap-2">
        {photos.map((p) => (
          <div
            key={p.id}
            draggable
            onDragStart={() => onDragStart(p.id)}
            onDragOver={(e) => onDragOver(e, p.id)}
            onDragEnd={onDragEnd}
            className={`relative aspect-square cursor-grab overflow-hidden rounded-lg bg-gray-100 transition ${
              dragId === p.id ? "opacity-50" : ""
            } active:cursor-grabbing`}
          >
            <Image
              src={p.public_url}
              alt=""
              fill
              className="object-cover"
              sizes="120px"
            />
            <button
              type="button"
              onClick={() => deletePhoto.mutate(p.id)}
              className="absolute top-1 right-1 flex items-center justify-center rounded-full bg-black/70 text-xs leading-none text-white"
              style={{ width: "22px", height: "22px" }}
            >
              ✕
            </button>
          </div>
        ))}
        {photos.length < 10 && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={!!uploadProgress}
            className="flex aspect-square items-center justify-center rounded-lg border-2 border-dashed border-gray-300 text-gray-400 transition hover:border-gray-400 hover:text-gray-500 disabled:opacity-40"
          >
            {uploadProgress ? `${uploadProgress.done}/${uploadProgress.total}` : "+ 新增"}
          </button>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={upload}
      />
      <p className="text-xs text-gray-400">接受 JPEG / PNG / WebP，每張最大 5MB。</p>
      {uploadError && <p className="mt-1 text-xs text-red-600">{uploadError}</p>}
    </div>
  );
}

function ListingFormModal({
  editingId,
  onClose,
  onSaved,
}: {
  editingId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { data: existing } = useListingEdit(editingId ?? "");

  const [form, setForm] = useState({
    city: "",
    district: "",
    address: "",
    name: "",
    rent: 0,
    management_fee: 0,
    room_type: "",
    area_ping: 0,
    num_bedrooms: 0,
    num_living_rooms: 0,
    num_bathrooms: 0,
    num_balconies: 0,
    available_from: new Date().toISOString().split("T")[0],
    min_lease_months: 12,
    allow_pets: false,
    allow_subsidy: false,
    allow_tax_receipt: false,
    allow_household_registration: false,
    allow_cooking: false,
    has_parking: false,
    allow_smoking: false,
    description: "",
    contact_info: "",
    compliance_confirmed: false,
  });

  useEffect(() => {
    if (!existing) return;
    setForm((f) => ({
      ...f,
      city: LOCATION_CITY_DISTRICT[existing.location_id]?.city ?? "",
      district: LOCATION_CITY_DISTRICT[existing.location_id]?.district ?? "",
      address: existing.address ?? "",
      name: existing.name ?? "",
      rent: existing.rent,
      management_fee: existing.management_fee ?? 0,
      room_type: existing.room_type,
      area_ping: existing.area_ping,
      num_bedrooms: existing.num_bedrooms ?? 0,
      num_living_rooms: existing.num_living_rooms ?? 0,
      num_bathrooms: existing.num_bathrooms ?? 0,
      num_balconies: existing.num_balconies ?? 0,
      available_from: existing.available_from
        ? new Date(existing.available_from).toISOString().split("T")[0]
        : "",
      min_lease_months: existing.min_lease_months,
      allow_pets: existing.allow_pets,
      allow_subsidy: existing.allow_subsidy,
      allow_tax_receipt: existing.allow_tax_receipt,
      allow_household_registration: existing.allow_household_registration,
      allow_cooking: existing.allow_cooking,
      has_parking: existing.has_parking,
      allow_smoking: existing.allow_smoking,
      description: existing.description ?? "",
      contact_info: existing.contact_info ?? "",
    }));
  }, [existing]);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [formSaved, setFormSaved] = useState(false);

  const activeId = editingId ?? savedId;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.city) {
      setError("請選擇縣市");
      return;
    }
    if (!form.district) {
      setError("請選擇地區");
      return;
    }
    if (!form.rent || form.rent <= 0) {
      setError("請填寫租金");
      return;
    }
    if (form.rent > 999999) {
      setError("租金不得超過 999,999 元");
      return;
    }
    if (!form.area_ping || form.area_ping <= 0) {
      setError("請填寫坪數");
      return;
    }
    if (form.area_ping >= 1000) {
      setError("坪數不得超過 999.99");
      return;
    }
    if (form.management_fee < 0 || form.management_fee > 999999) {
      setError("管理費需介於 0 ~ 999,999 元");
      return;
    }
    if (!form.room_type) {
      setError("請選擇房型");
      return;
    }
    if (form.room_type === "whole_floor") {
      if (
        form.num_bedrooms <= 0 ||
        form.num_living_rooms <= 0 ||
        form.num_bathrooms <= 0 ||
        form.num_balconies < 0
      ) {
        setError("整層房型請填寫房廳衛陽台數量");
        return;
      }
    }
    if (!form.available_from) {
      setError("請填寫可入住日");
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
    if (!editingId && !form.compliance_confirmed) {
      setError("請勾選合規確認才能建立房源");
      return;
    }
    setLoading(true);
    setError("");
    const isWholeFloor = form.room_type === "whole_floor";
    const payload = {
      ...form,
      rent: Number(form.rent),
      management_fee: Number(form.management_fee || 0),
      area_ping: Number(form.area_ping),
      min_lease_months: Number(form.min_lease_months),
      num_bedrooms: isWholeFloor ? Number(form.num_bedrooms) : null,
      num_living_rooms: isWholeFloor ? Number(form.num_living_rooms) : null,
      num_bathrooms: isWholeFloor ? Number(form.num_bathrooms) : null,
      num_balconies: isWholeFloor ? Number(form.num_balconies) : null,
      available_from: form.available_from
        ? `${form.available_from}T00:00:00Z`
        : form.available_from,
    };
    try {
      if (editingId) {
        await api.put(`/listings/${editingId}`, payload);
        setFormSaved(true);
        setTimeout(() => setFormSaved(false), 2000);
      } else {
        const res = await api.post("/listings", payload);
        setSavedId((res.data as { id: string }).id);
      }
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
        onClick={activeId ? onSaved : onClose}
      />
      <div className="no-scrollbar relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-6 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-950">
            {editingId ? "編輯房源" : savedId ? "上傳照片" : "新增房源"}
          </h3>
          <button
            type="button"
            onClick={activeId ? onSaved : onClose}
            className="text-gray-400 hover:text-gray-700"
            aria-label="關閉"
          >
            ✕
          </button>
        </div>

        {savedId ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">房源已建立，可以上傳照片（選填）。</p>
            <PhotoSection listingId={savedId} onChanged={onSaved} />
            <button
              type="button"
              onClick={onSaved}
              className="bg-primary-600 hover:bg-primary-500 w-full rounded-lg py-3 text-sm font-medium text-white transition"
            >
              關閉
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div>
              <label
                htmlFor="listing-name"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                房源名稱（選填）
              </label>
              <input
                id="listing-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="input"
                placeholder="例：台北大安捷運套房"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="mb-1 text-sm font-medium text-gray-700">
                  縣市<span className="ml-0.5 text-red-500">*</span>
                </p>
                <Dropdown
                  value={form.city}
                  placeholder="請選擇縣市"
                  options={LOCATION_GROUPS.map((g) => ({
                    value: g.cityLabel,
                    label: g.cityLabel,
                  }))}
                  onChange={(v) => setForm((f) => ({ ...f, city: v, district: "" }))}
                />
              </div>
              <div>
                <p className="mb-1 text-sm font-medium text-gray-700">
                  地區<span className="ml-0.5 text-red-500">*</span>
                </p>
                <Dropdown
                  value={form.district}
                  placeholder="請選擇地區"
                  disabled={!form.city}
                  options={(
                    LOCATION_GROUPS.find((g) => g.cityLabel === form.city)?.districts ??
                    []
                  ).map((d) => ({ value: d.districtLabel, label: d.districtLabel }))}
                  onChange={(v) => setForm((f) => ({ ...f, district: v }))}
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="address"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                詳細地址
              </label>
              <input
                id="address"
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                className="input"
                placeholder="例：台北市大安區忠孝東路四段 100 號 5 樓"
              />
              <p className="mt-1 text-xs text-gray-400">
                媒合成功後才會顯示給租客。系統將自動定位經緯度。
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label
                  htmlFor="rent"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  租金（元/月）<span className="ml-0.5 text-red-500">*</span>
                </label>
                <input
                  id="rent"
                  required
                  type="number"
                  min={1}
                  value={form.rent || ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, rent: Number(e.target.value) }))
                  }
                  className="input"
                />
              </div>
              <div>
                <label
                  htmlFor="management_fee"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  管理費（元/月）
                </label>
                <input
                  id="management_fee"
                  type="number"
                  min={0}
                  value={form.management_fee || ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, management_fee: Number(e.target.value) }))
                  }
                  className="input"
                />
              </div>
              <div>
                <label
                  htmlFor="area_ping"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  坪數<span className="ml-0.5 text-red-500">*</span>
                </label>
                <input
                  id="area_ping"
                  required
                  type="number"
                  min={1}
                  step="0.1"
                  value={form.area_ping || ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, area_ping: Number(e.target.value) }))
                  }
                  className="input"
                />
              </div>
            </div>

            <div>
              <p className="mb-1 text-sm font-medium text-gray-700">
                房型<span className="ml-0.5 text-red-500">*</span>
              </p>
              <div className="flex gap-2">
                {Object.entries(ROOM_TYPE_LABELS).map(([rt, label]) => (
                  <button
                    key={rt}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, room_type: rt }))}
                    className={`rounded-full px-3 py-1 text-sm font-medium transition ${
                      form.room_type === rt
                        ? "bg-primary-600 text-white"
                        : "border border-gray-200 text-gray-600 hover:border-gray-400"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {form.room_type === "whole_floor" && (
              <div>
                <p className="mb-1 text-sm font-medium text-gray-700">格局</p>
                <div className="grid grid-cols-4 gap-2">
                  {(
                    [
                      ["num_bedrooms", "房"],
                      ["num_living_rooms", "廳"],
                      ["num_bathrooms", "衛"],
                      ["num_balconies", "陽台"],
                    ] as const
                  ).map(([key, label]) => (
                    <div key={key}>
                      <input
                        type="number"
                        min={0}
                        value={form[key] || ""}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, [key]: Number(e.target.value) }))
                        }
                        className="input"
                        placeholder={label}
                      />
                      <p className="mt-1 text-center text-xs text-gray-400">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="available_from"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  可入住日<span className="ml-0.5 text-red-500">*</span>
                </label>
                <input
                  id="available_from"
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
                  htmlFor="min_lease_months"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  最短租期（月）<span className="ml-0.5 text-red-500">*</span>
                </label>
                <input
                  id="min_lease_months"
                  required
                  type="number"
                  min={1}
                  value={form.min_lease_months || ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, min_lease_months: Number(e.target.value) }))
                  }
                  className="input"
                />
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">房源條件</p>
              {(
                [
                  ["allow_pets", "可養寵物"],
                  ["allow_subsidy", "可申請租屋補助"],
                  ["allow_tax_receipt", "可報稅"],
                  ["allow_household_registration", "可遷入戶籍"],
                  ["allow_cooking", "可開伙"],
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

            <div>
              <label
                htmlFor="description"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                房源說明（選填）
              </label>
              <textarea
                id="description"
                rows={4}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="input resize-none"
                placeholder="描述房源特色、生活環境、附近交通或其他租客需要知道的資訊"
              />
            </div>

            <div>
              <label
                htmlFor="contact_info"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                聯絡方式（媒合成功後才對租客顯示）
                <span className="ml-0.5 text-red-500">*</span>
              </label>
              <input
                id="contact_info"
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
                  媒合成功後才會顯示給租客，請填真實聯絡方式
                </p>
              )}
            </div>

            {!editingId && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <p className="mb-2 text-sm font-medium text-amber-800">合規確認</p>
                <p className="mb-3 text-xs text-amber-700">
                  建立房源前，請確認此房源不是頂樓加蓋、違建或依法不得出租之空間，且刊登內容不包含性別或其他敏感屬性限制。
                </p>
                <label className="flex cursor-pointer items-start gap-2 text-sm text-amber-800">
                  <input
                    type="checkbox"
                    checked={form.compliance_confirmed}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, compliance_confirmed: e.target.checked }))
                    }
                    className="mt-0.5 h-4 w-4 rounded border-amber-300 accent-amber-800"
                  />
                  <span>我確認此房源符合上述合規條件</span>
                </label>
              </div>
            )}

            {editingId && (
              <>
                <hr className="border-gray-100" />
                <PhotoSection listingId={editingId} onChanged={() => {}} />
              </>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={loading || formSaved}
              className="bg-primary-600 hover:bg-primary-500 w-full rounded-lg py-3 text-sm font-medium text-white transition disabled:opacity-40"
            >
              {loading
                ? "儲存中…"
                : editingId
                  ? formSaved
                    ? "已儲存 ✓"
                    : "儲存"
                  : "建立房源"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={onSaved}
                className="w-full rounded-lg border border-gray-200 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                關閉
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  );
}

// ---- Shared UI ----

// ---- 帶看 (viewings) ----

type ViewingsSubTab = "schedule" | "list";

function ViewingsView() {
  const [subTab, setSubTab] = useState<ViewingsSubTab>("schedule");
  return (
    <div>
      <div className="mb-4 flex gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
        {(
          [
            ["schedule", "時段設定"],
            ["list", "帶看清單"],
          ] as [ViewingsSubTab, string][]
        ).map(([t, label]) => (
          <button
            key={t}
            type="button"
            onClick={() => setSubTab(t)}
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
      {subTab === "schedule" ? <AvailabilityEditor /> : <ViewingList role="landlord" />}
    </div>
  );
}

type DayForm = { on: boolean; start: string; end: string };

const EMPTY_WEEK: DayForm[] = Array.from({ length: 7 }, () => ({
  on: false,
  start: "09:00",
  end: "18:00",
}));

function AvailabilityEditor() {
  const qc = useQueryClient();
  const { data: listings = [] } = useListings();
  const [listingId, setListingId] = useState("");

  const { data: avail } = useViewingAvailability(listingId);

  const [enabled, setEnabled] = useState(false);
  const [slotMinutes, setSlotMinutes] = useState(30);
  const [slotCapacity, setSlotCapacity] = useState<number | "">(1);
  const [rangeDays, setRangeDays] = useState<number | "">(14);
  const [week, setWeek] = useState<DayForm[]>(EMPTY_WEEK);
  const [exceptions, setExceptions] = useState<string[]>([]);
  const [newException, setNewException] = useState("");
  const [saved, setSaved] = useState(false);

  // Hydrate the form whenever a listing's availability loads.
  useEffect(() => {
    if (!avail) return;
    setEnabled(avail.enabled);
    setSlotMinutes(avail.slot_minutes || 30);
    setSlotCapacity(avail.slot_capacity || 1);
    setRangeDays(avail.booking_range_days || 14);
    setExceptions(avail.exceptions ?? []);
    const w = EMPTY_WEEK.map((d) => ({ ...d }));
    for (const [k, windows] of Object.entries(avail.weekly ?? {})) {
      const idx = Number(k);
      if (windows[0] && idx >= 0 && idx < 7)
        w[idx] = { on: true, start: windows[0][0], end: windows[0][1] };
    }
    setWeek(w);
  }, [avail]);

  const save = useMutation({
    mutationFn: () => {
      const weekly: Record<string, [string, string][]> = {};
      week.forEach((d, i) => {
        if (d.on) weekly[String(i)] = [[d.start, d.end]];
      });
      const body: ViewingAvailability = {
        enabled,
        slot_minutes: slotMinutes,
        slot_capacity: slotCapacity === "" ? 1 : slotCapacity,
        weekly,
        booking_range_days: rangeDays === "" ? 14 : rangeDays,
        exceptions,
      };
      return api.put(`/listings/${listingId}/viewing-availability`, body);
    },
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      qc.invalidateQueries({ queryKey: qk.viewingSlots(listingId) });
    },
  });

  function setDay(i: number, patch: Partial<DayForm>) {
    setWeek((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1 text-sm font-medium text-gray-700">選擇房源</p>
        <Dropdown
          value={listingId}
          placeholder="選擇要設定帶看時段的房源"
          options={listings.map((l) => ({
            value: l.id,
            label:
              l.name ||
              `$${l.rent.toLocaleString()} ${ROOM_TYPE_LABELS[l.room_type] ?? l.room_type}`,
          }))}
          onChange={setListingId}
        />
      </div>

      {listingId && (
        <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-800">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="accent-primary-600 h-4 w-4"
            />
            開放租客預約帶看
          </label>

          {enabled && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="mb-1 text-sm font-medium text-gray-700">
                    帶看長度（分鐘）
                  </p>
                  <Dropdown
                    value={String(slotMinutes)}
                    placeholder="帶看長度"
                    options={[15, 30, 45, 60].map((m) => ({
                      value: String(m),
                      label: `${m} 分鐘`,
                    }))}
                    onChange={(v) => setSlotMinutes(Number(v))}
                  />
                </div>
                <div>
                  <p className="mb-1 text-sm font-medium text-gray-700">可預約天數</p>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={rangeDays}
                    onChange={(e) =>
                      setRangeDays(e.target.value === "" ? "" : Number(e.target.value))
                    }
                    className="input"
                  />
                </div>
                <div>
                  <p className="mb-1 text-sm font-medium text-gray-700">
                    每時段可預約組數
                  </p>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={slotCapacity}
                    onChange={(e) =>
                      setSlotCapacity(e.target.value === "" ? "" : Number(e.target.value))
                    }
                    className="input"
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    大於 1 即開放多組同時帶看（團體帶看）。
                  </p>
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-gray-700">每週可帶看時段</p>
                <div className="space-y-2">
                  {week.map((d, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <label className="flex w-16 flex-shrink-0 items-center gap-1.5 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={d.on}
                          onChange={(e) => setDay(i, { on: e.target.checked })}
                          className="accent-primary-600 h-4 w-4"
                        />
                        {WEEKDAY_LABELS[i]}
                      </label>
                      <input
                        type="time"
                        value={d.start}
                        disabled={!d.on}
                        onChange={(e) => setDay(i, { start: e.target.value })}
                        className="input flex-1 disabled:opacity-40"
                      />
                      <span className="text-gray-400">–</span>
                      <input
                        type="time"
                        value={d.end}
                        disabled={!d.on}
                        onChange={(e) => setDay(i, { end: e.target.value })}
                        className="input flex-1 disabled:opacity-40"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-gray-700">
                  例外日期（不可預約）
                </p>
                <div className="mb-2 flex flex-wrap gap-2">
                  {exceptions.length === 0 && (
                    <span className="text-xs text-gray-400">尚未設定例外日期</span>
                  )}
                  {exceptions.map((ex) => (
                    <span
                      key={ex}
                      className="flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                    >
                      {ex}
                      <button
                        type="button"
                        onClick={() => setExceptions((p) => p.filter((x) => x !== ex))}
                        className="text-gray-400 hover:text-red-500"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={newException}
                    onChange={(e) => setNewException(e.target.value)}
                    className="input flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newException && !exceptions.includes(newException)) {
                        setExceptions((p) => [...p, newException].sort());
                        setNewException("");
                      }
                    }}
                    className="flex-shrink-0 rounded-lg border border-gray-200 px-4 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    新增
                  </button>
                </div>
              </div>
            </>
          )}

          <button
            type="button"
            disabled={save.isPending}
            onClick={() => save.mutate()}
            className="bg-primary-600 hover:bg-primary-500 w-full rounded-lg py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {saved ? "已儲存 ✓" : "儲存設定"}
          </button>
        </div>
      )}
    </div>
  );
}

