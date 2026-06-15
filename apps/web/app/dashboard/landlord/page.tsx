"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  ChevronDown,
  Heart,
  Inbox,
  MoreHorizontal,
  Search,
  SearchX,
  SendHorizonal,
} from "lucide-react";
import { api } from "@/lib/api";
import { getProfileTags } from "@/lib/listingTags";
import type { Listing, MatchedTenantProfileCard, MutualMatch } from "@/types";
import { LOCATION_CITY_DISTRICT, LOCATION_GROUPS, ROOM_TYPE_LABELS } from "@/types";

type MainTab = "listings" | "browse" | "matches";
type MatchesSubTab = "incoming" | "outgoing" | "matched";

const STATUS_LABELS: Record<string, string> = {
  draft: "草稿",
  active: "刊登中",
  paused: "暫停",
  rented: "已出租",
};

export default function LandlordDashboard() {
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
          <MatchesView subTab={matchesSubTab} onSubTabChange={setMatchesSubTab} />
        )}
      </div>

      {/* Mobile bottom tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 h-14 border-t border-gray-200 bg-white sm:hidden">
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
        </div>
      </nav>
    </div>
  );
}

// ---- Shared nav ----

function DashboardHeader() {
  const router = useRouter();
  const { data: me } = useQuery<{ roles: string[] }>({
    queryKey: ["me"],
    queryFn: () => api.get("/profile/me").then((r) => r.data),
  });
  const addTenantRole = useMutation({
    mutationFn: () => api.post("/account/roles", { role: "tenant" }),
    onSuccess: () => router.push("/dashboard/tenant"),
  });

  async function logout() {
    await api.post("/auth/logout");
    window.location.href = "/";
  }

  function switchToTenant() {
    if (me?.roles.includes("tenant")) {
      router.push("/dashboard/tenant");
    } else {
      addTenantRole.mutate();
    }
  }

  return (
    <header className="border-b border-gray-200 bg-white px-4 py-3">
      <div className="mx-auto flex max-w-4xl items-center justify-between">
        <span className="text-lg font-bold text-gray-950">Zumeet</span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={switchToTenant}
            disabled={addTenantRole.isPending}
            className="text-sm text-gray-500 hover:text-gray-800 disabled:opacity-50"
          >
            切換為租客
          </button>
          <button
            type="button"
            onClick={logout}
            className="text-sm text-gray-500 hover:text-gray-800"
          >
            登出
          </button>
        </div>
      </div>
    </header>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
        active ? "bg-primary-600 text-white" : "text-gray-500 hover:bg-gray-100"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function BottomTabItem({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-1 flex-col items-center justify-center gap-0.5 transition ${
        active ? "text-primary-600" : "text-gray-400"
      }`}
    >
      {icon}
      <span className="text-[10px]">{label}</span>
    </button>
  );
}

// ---- Listings Tab ----

function ListingsTab({ onSelectListing }: { onSelectListing: (id: string) => void }) {
  const qc = useQueryClient();
  const { data: listings = [], isLoading } = useQuery<Listing[]>({
    queryKey: ["listings"],
    queryFn: () => api.get("/listings").then((r) => r.data),
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

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
              qc.invalidateQueries({ queryKey: ["listings"] });
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
          className="rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-primary-500"
        >
          + 新增房源
        </button>
      </div>
      <div className="space-y-3">
        {listings.map((l) => (
          <ListingCard
            key={l.id}
            listing={l}
            onEdit={() => {
              setEditingId(l.id);
              setShowForm(true);
            }}
            onBrowse={() => onSelectListing(l.id)}
            onChanged={() => qc.invalidateQueries({ queryKey: ["listings"] })}
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
            qc.invalidateQueries({ queryKey: ["listings"] });
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
    mutationFn: (status: string) => api.patch(`/listings/${listing.id}/status`, { status }),
    onSuccess: () => {
      onChanged();
      qc.invalidateQueries({ queryKey: ["listings"] });
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
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {listing.name && (
              <span className="text-base font-semibold text-gray-950">{listing.name}</span>
            )}
            <span className={listing.name ? "text-sm text-gray-500" : "text-base font-semibold text-gray-950"}>
              ${listing.rent.toLocaleString()}
            </span>
            <span className="text-sm text-gray-500">
              {ROOM_TYPE_LABELS[listing.room_type] ?? listing.room_type} {listing.area_ping}坪
            </span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass}`}>
              {STATUS_LABELS[listing.status] ?? listing.status}
            </span>
          </div>
          <p className="mt-1 text-xs text-gray-400">
            可入住：{new Date(listing.available_from).toLocaleDateString("zh-TW")} ／ {listing.photos.length} 張照片
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
              className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-primary-500"
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
                <MenuItem onClick={() => changeStatus.mutate("paused")}>暫停曝光</MenuItem>
                <MenuItem onClick={() => changeStatus.mutate("rented")}>標記已出租</MenuItem>
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
          <div className="absolute right-0 top-9 z-20 min-w-[9rem] rounded-xl border border-gray-200 bg-white py-1 shadow-md">
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
  const { data: listings = [] } = useQuery<Listing[]>({
    queryKey: ["listings"],
    queryFn: () => api.get("/listings").then((r) => r.data),
  });

  const activeListings = listings.filter((l) => l.status === "active");
  const currentId =
    activeListings.find((l) => l.id === selectedListingId)?.id ??
    activeListings[0]?.id ??
    null;

  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{ items: MatchedTenantProfileCard[] }>({
    queryKey: ["profiles-browse", currentId],
    queryFn: () =>
      api.get(`/listings/${currentId}/tenant-profiles?limit=20`).then((r) => r.data),
    enabled: !!currentId,
  });

  const expressInterest = useMutation({
    mutationFn: (profileId: string) =>
      api.post(`/listings/${currentId}/tenant-profiles/${profileId}/interest`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profiles-browse", currentId] }),
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
              label: l.name || `$${l.rent.toLocaleString()} ${ROOM_TYPE_LABELS[l.room_type] ?? l.room_type}`,
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

function profileHeader(profile: Pick<MatchedTenantProfileCard, "occupation" | "age" | "has_pets">) {
  const parts = [
    profile.occupation,
    profile.age != null ? `${profile.age} 歲` : null,
    profile.has_pets ? "養寵物" : null,
  ].filter(Boolean) as string[];
  return parts.length > 0 ? `[${parts.join("，")}]` : "租客";
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
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-sm font-semibold text-gray-950">{profileHeader(profile)}</span>
          </div>
          {profile.description && (
            <p className="mt-1.5 text-sm text-gray-600">{profile.description}</p>
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
              className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-primary-500"
            >
              有興趣
            </button>
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
              subTab === t ? "bg-primary-600 text-white" : "text-gray-500 hover:bg-gray-100"
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

// ---- Incoming (accordion per listing) ----

function IncomingTab() {
  const { data: listings = [], isLoading } = useQuery<Listing[]>({
    queryKey: ["listings"],
    queryFn: () => api.get("/listings").then((r) => r.data),
  });
  const qc = useQueryClient();
  const [expandedSet, setExpandedSet] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (listings.length > 0) setExpandedSet(new Set(listings.map((l) => l.id)));
  }, [listings]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) return <Loading />;

  if (listings.length === 0) {
    return (
      <EmptyState
        icon={<Inbox size={32} strokeWidth={1.5} className="text-gray-300" />}
        title="尚無房源"
        description="建立並上架房源後，才能接收租客的媒合興趣"
      />
    );
  }

  function toggle(id: string) {
    setExpandedSet((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-3">
      {listings.map((listing) => (
        <ListingIncoming
          key={listing.id}
          listing={listing}
          expanded={expandedSet.has(listing.id)}
          onToggle={() => toggle(listing.id)}
          onMatched={() => qc.invalidateQueries({ queryKey: ["matched"] })}
        />
      ))}
    </div>
  );
}

function ListingIncoming({
  listing,
  expanded,
  onToggle,
  onMatched,
}: {
  listing: Listing;
  expanded: boolean;
  onToggle: () => void;
  onMatched: () => void;
}) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{ items: MatchedTenantProfileCard[] }>({
    queryKey: ["incoming-listing", listing.id],
    queryFn: () =>
      api.get(`/listings/${listing.id}/tenant-profiles?limit=50`).then((r) => r.data),
    enabled: expanded,
  });

  const expressInterest = useMutation({
    mutationFn: (profileId: string) =>
      api.post(`/listings/${listing.id}/tenant-profiles/${profileId}/interest`),
    onSuccess: (res) => {
      if (res.data.status === "matched") onMatched();
      qc.invalidateQueries({ queryKey: ["incoming-listing", listing.id] });
    },
  });

  const pendingCount = (data?.items ?? []).filter((p) => !p.interest_sent).length;

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm font-medium text-gray-700">
          {listing.name || `$${listing.rent.toLocaleString()} ${ROOM_TYPE_LABELS[listing.room_type] ?? listing.room_type}`}
        </span>
        <div className="flex items-center gap-2">
          {expanded && pendingCount > 0 && (
            <span className="rounded-full bg-primary-600 px-2 py-0.5 text-xs font-medium text-white">
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
        <div className="border-t border-gray-100 px-4 py-3">
          {isLoading && <Loading />}
          {!isLoading && (data?.items ?? []).length === 0 && (
            <p className="py-4 text-center text-sm text-gray-400">目前無符合條件的租客</p>
          )}
          <div className="space-y-2">
            {(data?.items ?? []).map((profile) => (
              <div
                key={profile.id}
                className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2.5"
              >
                <div className="text-sm">
                  <span className="font-medium text-gray-900">
                    {profileHeader(profile)}
                  </span>
                </div>
                {profile.interest_sent ? (
                  <span className="rounded-full bg-[#EDE9FE] px-2.5 py-0.5 text-xs font-medium text-[#5B21B6]">
                    已送出
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => expressInterest.mutate(profile.id)}
                    className="rounded-lg bg-primary-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-primary-500"
                  >
                    回應興趣
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Outgoing ----

type OutgoingItem = {
  tenant_profile_id: string;
  profile_name: string;
  budget_min: number;
  budget_max: number;
};

function OutgoingTab() {
  const { data, isLoading } = useQuery<{ items: OutgoingItem[] }>({
    queryKey: ["outgoing"],
    queryFn: () => api.get("/matches/outgoing?limit=50").then((r) => r.data),
  });

  if (isLoading) return <Loading />;

  if ((data?.items ?? []).length === 0) {
    return (
      <EmptyState
        icon={<SendHorizonal size={32} strokeWidth={1.5} className="text-gray-300" />}
        title="尚未送出任何興趣"
        description="前往找租客，對感興趣的需求卡按「有興趣」"
      />
    );
  }

  return (
    <div className="space-y-2">
      {(data?.items ?? []).map((i) => (
        <div
          key={i.tenant_profile_id}
          className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm"
        >
          <div className="text-sm">
            <span className="font-medium text-gray-900">{i.profile_name}</span>
          </div>
          <span className="rounded-full bg-[#EDE9FE] px-2.5 py-0.5 text-xs font-medium text-[#5B21B6]">
            已送出
          </span>
        </div>
      ))}
    </div>
  );
}

// ---- Matched ----

type MatchItem = {
  match_id: string;
  tenant_profile_id: string;
  listing_id: string;
  listing_name?: string;
  contact_info: string;
  matched_at: string;
  profile_name?: string;
};

function MatchedTab() {
  const { data, isLoading } = useQuery<{ items: MutualMatch[] }>({
    queryKey: ["matched"],
    queryFn: () => api.get("/matches/mutual?limit=50").then((r) => r.data),
  });

  if (isLoading) return <Loading />;

  if ((data?.items ?? []).length === 0) {
    return (
      <EmptyState
        icon={<Heart size={32} strokeWidth={1.5} className="text-gray-300" />}
        title="尚無媒合結果"
        description="繼續瀏覽租客需求卡，或等待租客對你的房源表示興趣"
      />
    );
  }

  return (
    <div className="space-y-3">
      {(data?.items ?? []).map((m) => {
        const match = m as unknown as MatchItem;
        return (
          <div
            key={match.match_id}
            className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span className="rounded-full bg-[#D1FAE5] px-2 py-0.5 font-medium text-[#065F46]">
                媒合成功
              </span>
              <span>{new Date(match.matched_at).toLocaleDateString("zh-TW")}</span>
              {match.profile_name && <span>需求卡：{match.profile_name}</span>}
              {match.listing_name && <span>房源：{match.listing_name}</span>}
            </div>
            <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
              <p className="mb-1 text-xs text-gray-400">
                以下為對方自填資料，平台不保證真實性，請自行確認。
              </p>
              <p className="text-sm font-medium text-gray-950">{match.contact_info}</p>
            </div>
          </div>
        );
      })}
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
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(
    null
  );
  const [uploadError, setUploadError] = useState("");

  const { data: listing } = useQuery({
    queryKey: ["listing-detail", listingId],
    queryFn: () =>
      api.get(`/listings/${listingId}`).then((r) => r.data as { photo_list: PhotoRecord[] }),
  });

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const remaining = 10 - photos.length;
    const all = Array.from(e.target.files ?? []);
    const files = all.slice(0, remaining);
    if (files.length === 0) return;
    setUploadProgress({ done: 0, total: files.length });
    setUploadError(
      all.length > remaining ? `已選 ${all.length} 張，僅上傳前 ${remaining} 張（上限 10 張）` : ""
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
            err &&
            typeof err === "object" &&
            "response" in err
              ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
              : undefined;
          setUploadError(msg ?? "上傳失敗");
          break;
        }
      }
    } finally {
      if (succeeded > 0) {
        qc.invalidateQueries({ queryKey: ["listing-detail", listingId] });
        onChanged();
      }
      setUploadProgress(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const deletePhoto = useMutation({
    mutationFn: (photoId: string) => api.delete(`/listings/${listingId}/photos/${photoId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["listing-detail", listingId] });
      onChanged();
    },
  });

  const reorderPhotos = useMutation({
    mutationFn: (photoIds: string[]) =>
      api.patch(`/listings/${listingId}/photos/order`, { photo_ids: photoIds }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["listing-detail", listingId] });
      onChanged();
    },
  });

  const serverPhotos: PhotoRecord[] = listing?.photo_list ?? [];
  // Local order overlay so drag feels instant; cleared when server order matches.
  const [localOrder, setLocalOrder] = useState<string[] | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const photos: PhotoRecord[] =
    localOrder
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
            <Image src={p.public_url} alt="" fill className="object-cover" sizes="120px" />
            <button
              type="button"
              onClick={() => deletePhoto.mutate(p.id)}
              className="absolute right-1 top-1 flex items-center justify-center rounded-full bg-black/70 text-xs leading-none text-white"
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
            {uploadProgress
              ? `${uploadProgress.done}/${uploadProgress.total}`
              : "+ 新增"}
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
  const { data: existing } = useQuery<Listing>({
    queryKey: ["listing-edit", editingId],
    queryFn: () => api.get(`/listings/${editingId}`).then((r) => r.data),
    enabled: !!editingId,
  });

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
    min_lease_months: 6,
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
    }));
  }, [existing]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [formSaved, setFormSaved] = useState(false);

  const activeId = editingId ?? savedId;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.city) { setError("請選擇縣市"); return; }
    if (!form.district) { setError("請選擇地區"); return; }
    if (!form.rent || form.rent <= 0) { setError("請填寫租金"); return; }
    if (form.rent > 999999) { setError("租金不得超過 999,999 元"); return; }
    if (!form.area_ping || form.area_ping <= 0) { setError("請填寫坪數"); return; }
    if (form.area_ping >= 1000) { setError("坪數不得超過 999.99"); return; }
    if (form.management_fee < 0 || form.management_fee > 999999) {
      setError("管理費需介於 0 ~ 999,999 元"); return;
    }
    if (!form.room_type) { setError("請選擇房型"); return; }
    if (form.room_type === "whole_floor") {
      if (
        form.num_bedrooms <= 0 || form.num_living_rooms <= 0 ||
        form.num_bathrooms <= 0 || form.num_balconies < 0
      ) {
        setError("整層房型請填寫房廳衛陽台數量");
        return;
      }
    }
    if (!form.available_from) { setError("請填寫可入住日"); return; }
    if (!form.min_lease_months || form.min_lease_months <= 0) { setError("請填寫最短租期"); return; }
    if (!editingId && !form.contact_info.trim()) { setError("請填寫聯絡方式"); return; }
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
      if (err && typeof err === "object" && "response" in err) {
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
              className="w-full rounded-lg bg-primary-600 py-3 text-sm font-medium text-white transition hover:bg-primary-500"
            >
              關閉
            </button>
          </div>
        ) : (
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <label htmlFor="listing-name" className="mb-1 block text-sm font-medium text-gray-700">
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
              <p className="mb-1 text-sm font-medium text-gray-700">縣市</p>
              <Dropdown
                value={form.city}
                placeholder="請選擇縣市"
                options={LOCATION_GROUPS.map((g) => ({ value: g.cityLabel, label: g.cityLabel }))}
                onChange={(v) => setForm((f) => ({ ...f, city: v, district: "" }))}
              />
            </div>
            <div>
              <p className="mb-1 text-sm font-medium text-gray-700">地區</p>
              <Dropdown
                value={form.district}
                placeholder="請選擇地區"
                disabled={!form.city}
                options={(LOCATION_GROUPS.find((g) => g.cityLabel === form.city)?.districts ?? []).map(
                  (d) => ({ value: d.districtLabel, label: d.districtLabel })
                )}
                onChange={(v) => setForm((f) => ({ ...f, district: v }))}
              />
            </div>
          </div>

          <div>
            <label htmlFor="address" className="mb-1 block text-sm font-medium text-gray-700">
              詳細地址
            </label>
            <input
              id="address"
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              className="input"
              placeholder="例：台北市大安區忠孝東路四段 100 號 5 樓"
            />
            <p className="mt-1 text-xs text-gray-400">媒合成功後才會顯示給租客。系統將自動定位經緯度。</p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="rent" className="mb-1 block text-sm font-medium text-gray-700">
                租金（元/月）
              </label>
              <input
                id="rent"
                required
                type="number"
                min={1}
                value={form.rent || ""}
                onChange={(e) => setForm((f) => ({ ...f, rent: Number(e.target.value) }))}
                className="input"
              />
            </div>
            <div>
              <label htmlFor="management_fee" className="mb-1 block text-sm font-medium text-gray-700">
                管理費（元/月）
              </label>
              <input
                id="management_fee"
                type="number"
                min={0}
                value={form.management_fee || ""}
                onChange={(e) => setForm((f) => ({ ...f, management_fee: Number(e.target.value) }))}
                className="input"
              />
            </div>
            <div>
              <label htmlFor="area_ping" className="mb-1 block text-sm font-medium text-gray-700">
                坪數
              </label>
              <input
                id="area_ping"
                required
                type="number"
                min={1}
                step="0.1"
                value={form.area_ping || ""}
                onChange={(e) => setForm((f) => ({ ...f, area_ping: Number(e.target.value) }))}
                className="input"
              />
            </div>
          </div>

          <div>
            <p className="mb-1 text-sm font-medium text-gray-700">房型</p>
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
                {([
                  ["num_bedrooms", "房"],
                  ["num_living_rooms", "廳"],
                  ["num_bathrooms", "衛"],
                  ["num_balconies", "陽台"],
                ] as const).map(([key, label]) => (
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
                可入住日
              </label>
              <input
                id="available_from"
                required
                type="date"
                min={new Date().toISOString().split("T")[0]}
                value={form.available_from}
                onChange={(e) => setForm((f) => ({ ...f, available_from: e.target.value }))}
                className="input"
              />
            </div>
            <div>
              <label
                htmlFor="min_lease_months"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                最短租期（月）
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
                ["allow_pets", "寵物"],
                ["allow_subsidy", "租屋補助"],
                ["allow_tax_receipt", "報稅"],
                ["allow_household_registration", "入籍"],
                ["allow_cooking", "開伙"],
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
                  className="h-4 w-4 rounded border-gray-300 accent-primary-600"
                />
                {label}
              </label>
            ))}
          </div>

          <div>
            <label htmlFor="description" className="mb-1 block text-sm font-medium text-gray-700">
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
            </label>
            <input
              id="contact_info"
              required={!editingId}
              value={form.contact_info}
              onChange={(e) => setForm((f) => ({ ...f, contact_info: e.target.value }))}
              className="input"
              placeholder="例：Line ID: xxx 或 0912-345-678"
            />
            <p className="mt-1 text-xs text-gray-400">媒合成功後才會顯示給租客，請填真實聯絡方式</p>
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
            className="w-full rounded-lg bg-primary-600 py-3 text-sm font-medium text-white transition hover:bg-primary-500 disabled:opacity-40"
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

function Dropdown({
  value,
  placeholder,
  options,
  onChange,
  disabled = false,
}: {
  value: string;
  placeholder: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={`input flex w-full items-center justify-between text-left ${
          disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
        } ${value ? "text-gray-900" : "text-gray-400"}`}
      >
        <span className="truncate">{value ? (options.find((o) => o.value === value)?.label ?? value) : placeholder}</span>
        <ChevronDown
          size={16}
          strokeWidth={1.5}
          className={`ml-2 flex-shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={`w-full px-4 py-2 text-left text-sm transition hover:bg-gray-50 ${
                opt.value === value ? "font-medium text-primary-600" : "text-gray-700"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white py-12 text-center shadow-sm">
      {icon && <div className="mb-3 flex justify-center">{icon}</div>}
      <p className="text-sm font-medium text-gray-700">{title}</p>
      {description && <p className="mt-1 text-xs text-gray-400">{description}</p>}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-4 rounded-lg border border-primary-600 px-4 py-2 text-sm font-medium text-primary-600 transition hover:bg-primary-50"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

function Loading() {
  return <div className="py-8 text-center text-sm text-gray-400">載入中…</div>;
}

function SkeletonListingMgmtCard() {
  return (
    <div className="flex animate-pulse items-center justify-between rounded-xl border border-gray-200 bg-white p-5">
      <div className="space-y-2">
        <div className="h-4 w-36 rounded bg-gray-200" />
        <div className="h-3 w-48 rounded bg-gray-200" />
      </div>
      <div className="flex gap-2">
        <div className="h-7 w-16 rounded-lg bg-gray-200" />
        <div className="h-7 w-12 rounded-lg bg-gray-200" />
        <div className="h-7 w-12 rounded-lg bg-gray-200" />
      </div>
    </div>
  );
}

function SkeletonProfileCard() {
  return (
    <div className="flex animate-pulse items-start justify-between rounded-xl border border-gray-200 bg-white p-5">
      <div className="space-y-2">
        <div className="h-4 w-28 rounded bg-gray-200" />
        <div className="h-3 w-44 rounded bg-gray-200" />
        <div className="flex gap-1">
          <div className="h-5 w-12 rounded-full bg-gray-200" />
          <div className="h-5 w-12 rounded-full bg-gray-200" />
        </div>
      </div>
      <div className="h-7 w-16 rounded-lg bg-gray-200" />
    </div>
  );
}
