"use client";

import { type ReactNode, Suspense, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  ClipboardList,
  Heart,
  Inbox,
  MapPin,
  Search,
  SearchX,
  SendHorizonal,
} from "lucide-react";
import { api } from "@/lib/api";
import { LOCATION_LABELS, ROOM_TYPE_LABELS } from "@/types";
import { LocationPicker } from "@/components/LocationPicker";
import type { MatchedListingCard, TenantProfile } from "@/types";

type MainTab = "requirements" | "listings" | "matches";
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
        </nav>

        {tab === "requirements" && <ProfilesTab onSelectProfile={goToBrowse} />}
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
      <nav className="fixed bottom-0 left-0 right-0 z-40 h-14 border-t border-gray-200 bg-white sm:hidden">
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
        </div>
      </nav>
    </div>
  );
}

export default function TenantDashboard() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-100" />}>
      <TenantDashboardInner />
    </Suspense>
  );
}

// ---- Shared nav components ----

function DashboardHeader() {
  async function logout() {
    await api.post("/auth/logout");
    window.location.href = "/";
  }
  return (
    <header className="border-b border-gray-200 bg-white px-4 py-3">
      <div className="mx-auto flex max-w-4xl items-center justify-between">
        <span className="text-lg font-bold text-gray-950">Zumeet</span>
        <button
          type="button"
          onClick={logout}
          className="text-sm text-gray-500 hover:text-gray-800"
        >
          登出
        </button>
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
          action={{ label: "新增第一張需求卡", onClick: () => { setEditingProfile(null); setShowForm(true); } }}
        />
        {showForm && (
          <ProfileFormModal
            editingProfile={null}
            onClose={() => setShowForm(false)}
            onSaved={() => { qc.invalidateQueries({ queryKey: ["tenant-profiles"] }); setShowForm(false); }}
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
          onClick={() => { setEditingProfile(null); setShowForm(true); }}
          disabled={profiles.length >= 3}
          title={profiles.length >= 3 ? "最多可建立 3 張需求卡" : undefined}
          className="rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-primary-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {profiles.length >= 3 ? "已達上限 (3/3)" : "+ 新增需求卡"}
        </button>
      </div>
      <div className="space-y-3">
        {profiles.map((p) => (
          <ProfileCard
            key={p.id}
            profile={p}
            onEdit={() => { setEditingProfile(p); setShowForm(true); }}
            onBrowse={() => onSelectProfile(p.id)}
            onDeleted={() => qc.invalidateQueries({ queryKey: ["tenant-profiles"] })}
          />
        ))}
      </div>
      {showForm && (
        <ProfileFormModal
          editingProfile={editingProfile}
          onClose={() => { setShowForm(false); setEditingProfile(null); }}
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

  const toggleStatus = useMutation({
    mutationFn: () =>
      api.patch(`/tenant-profiles/${profile.id}/status`, { is_active: !profile.is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tenant-profiles"] }),
  });

  const deleteProfile = useMutation({
    mutationFn: () => api.delete(`/tenant-profiles/${profile.id}`),
    onSuccess: onDeleted,
  });

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex flex-wrap items-start justify-between gap-3">
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
            預算 ${profile.budget_min.toLocaleString()}–${profile.budget_max.toLocaleString()} ／{" "}
            {profile.preferred_room_types.map((t) => ROOM_TYPE_LABELS[t] ?? t).join("、")}
          </p>
        </div>
        <div className="flex flex-shrink-0 flex-wrap gap-2">
          {profile.is_active && (
            <button
              type="button"
              onClick={onBrowse}
              className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-primary-500"
            >
              找房源
            </button>
          )}
          <button
            type="button"
            onClick={onEdit}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-700 transition hover:bg-gray-50"
          >
            編輯
          </button>
          <button
            type="button"
            onClick={() => toggleStatus.mutate()}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-700 transition hover:bg-gray-50"
          >
            {profile.is_active ? "停用" : "啟用"}
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirm("確定刪除這張需求卡？")) deleteProfile.mutate();
            }}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-red-600 transition hover:bg-red-50"
          >
            刪除
          </button>
        </div>
      </div>
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["listings-browse", currentId] }),
  });

  const [detailListing, setDetailListing] = useState<MatchedListingCard | null>(null);

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
        <label htmlFor="profile-select" className="text-sm font-medium text-gray-700">
          使用需求卡
        </label>
        <select
          id="profile-select"
          value={currentId ?? ""}
          onChange={(e) => onSelectProfile(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-700"
        >
          {activeProfiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <SkeletonListingCard key={i} />
          ))}
        </div>
      )}
      {!isLoading && (data?.items ?? []).length === 0 && (
        <EmptyState
          icon={<SearchX size={32} strokeWidth={1.5} className="text-gray-300" />}
          title="目前無符合條件的房源"
          description="條件可能較嚴格，可嘗試調整需求卡中的預算或地區範圍"
        />
      )}
      <div className="space-y-3">
        {(data?.items ?? []).map((listing) => (
          <ListingCard
            key={listing.id}
            listing={listing}
            onInterest={() => expressInterest.mutate(listing.id)}
            onClick={() => setDetailListing(listing)}
          />
        ))}
      </div>

      {detailListing && (
        <ListingDetailDialog
          listing={detailListing}
          onClose={() => setDetailListing(null)}
          onInterest={() => {
            expressInterest.mutate(detailListing.id);
            setDetailListing(null);
          }}
        />
      )}
    </div>
  );
}

function ListingCard({
  listing,
  onInterest,
  onClick,
}: {
  listing: MatchedListingCard;
  onInterest: () => void;
  onClick: () => void;
}) {
  const [photoIdx, setPhotoIdx] = useState(0);
  const tags = [
    listing.allow_pets && "接受寵物",
    listing.allow_subsidy && "接受租補",
    listing.allow_tax_receipt && "開立收據",
    listing.allow_household_registration && "可入籍",
    listing.allow_cooking && "可開伙",
    listing.has_parking && "有車位",
    listing.allow_smoking && "可抽菸",
  ].filter(Boolean) as string[];

  return (
    <div className="flex gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      {/* Photo — navigation buttons live here, separate from the info click target */}
      <div className="relative w-44 flex-shrink-0">
        <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-gray-200">
          {listing.photos.length > 0 && (
            <Image
              src={listing.photos[photoIdx]}
              alt=""
              fill
              className="object-cover"
              sizes="176px"
            />
          )}
        </div>
        {listing.photos.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => setPhotoIdx((i) => (i - 1 + listing.photos.length) % listing.photos.length)}
              className="absolute left-1 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-0.5 text-white"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => setPhotoIdx((i) => (i + 1) % listing.photos.length)}
              className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-0.5 text-white"
            >
              ›
            </button>
            <div className="absolute bottom-1 left-0 right-0 flex justify-center gap-1">
              {listing.photos.map((url) => (
                <span
                  key={url}
                  className={`inline-block h-1 w-1 rounded-full ${listing.photos.indexOf(url) === photoIdx ? "bg-white" : "bg-white/50"}`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Info — button opens detail dialog; CTA is a sibling, not nested */}
      <div className="flex min-w-0 flex-1 flex-col justify-between">
        <button type="button" onClick={onClick} className="flex-1 text-left">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-xl font-semibold text-gray-950">
              ${listing.rent.toLocaleString()}
            </span>
            <span className="text-sm text-gray-500">
              {ROOM_TYPE_LABELS[listing.room_type] ?? listing.room_type}
            </span>
            <span className="text-sm text-gray-500">{listing.area_ping} 坪</span>
          </div>
          <div className="mt-1 flex items-center gap-1 text-sm text-gray-500">
            <MapPin size={14} strokeWidth={1.5} />
            {LOCATION_LABELS[listing.location_id] ?? listing.location_id}
          </div>
          <p className="mt-0.5 text-sm text-gray-400">
            可入住：{new Date(listing.available_from).toLocaleDateString("zh-TW")}
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
        </button>
        <div className="mt-3 flex justify-end">
          {listing.interest_sent ? (
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

function ListingDetailDialog({
  listing,
  onClose,
  onInterest,
}: {
  listing: MatchedListingCard;
  onClose: () => void;
  onInterest: () => void;
}) {
  const [photoIdx, setPhotoIdx] = useState(0);
  const tags = [
    listing.allow_pets && "接受寵物",
    listing.allow_subsidy && "接受租補",
    listing.allow_tax_receipt && "開立收據",
    listing.allow_household_registration && "可入籍",
    listing.allow_cooking && "可開伙",
    listing.has_parking && "有車位",
    listing.allow_smoking && "可抽菸",
  ].filter(Boolean) as string[];

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end bg-black/50 sm:items-center"
    >
      <button
        type="button"
        className="absolute inset-0"
        aria-label="關閉"
        onClick={onClose}
      />
      <div className="relative z-10 max-h-[85vh] w-full overflow-y-auto rounded-t-2xl bg-white sm:mx-auto sm:max-w-lg sm:rounded-2xl">
        {/* Photo header */}
        <div className="relative bg-black">
          {listing.photos.length > 0 ? (
            <div className="relative aspect-video max-h-[45vh] w-full">
              <Image
                src={listing.photos[photoIdx]}
                alt=""
                fill
                className="object-contain"
                sizes="100vw"
              />
            </div>
          ) : (
            <div className="h-16" />
          )}
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 rounded-full bg-black/40 p-1 text-white"
            aria-label="關閉"
          >
            ✕
          </button>
          {listing.photos.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => setPhotoIdx((i) => (i - 1 + listing.photos.length) % listing.photos.length)}
                className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 px-2 py-1 text-white"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={() => setPhotoIdx((i) => (i + 1) % listing.photos.length)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 px-2 py-1 text-white"
              >
                ›
              </button>
              <span className="absolute bottom-2 right-3 rounded-full bg-black/40 px-2 py-0.5 text-xs text-white">
                {photoIdx + 1} / {listing.photos.length}
              </span>
            </>
          )}
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-xl font-semibold text-gray-950">
              ${listing.rent.toLocaleString()}
            </span>
            <span className="text-sm text-gray-500">
              {ROOM_TYPE_LABELS[listing.room_type] ?? listing.room_type}
            </span>
            <span className="text-sm text-gray-500">{listing.area_ping} 坪</span>
          </div>
          <div className="mt-2 flex items-center gap-1 text-sm text-gray-500">
            <MapPin size={14} strokeWidth={1.5} />
            {LOCATION_LABELS[listing.location_id] ?? listing.location_id}
          </div>
          <p className="mt-1 text-sm text-gray-400">
            可入住：{new Date(listing.available_from).toLocaleDateString("zh-TW")}
          </p>
          {tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-primary-100 px-3 py-1 text-xs font-medium text-primary-600"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
          <p className="mt-4 text-xs text-gray-400">媒合成功後才會顯示房東聯絡方式</p>
          <div className="mt-4">
            {listing.interest_sent ? (
              <p className="text-center text-sm text-gray-400">已送出興趣，等待房東回應</p>
            ) : (
              <button
                type="button"
                onClick={onInterest}
                className="w-full rounded-lg bg-primary-600 py-3 text-sm font-medium text-white transition hover:bg-primary-500"
              >
                有興趣
              </button>
            )}
          </div>
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

// ---- Incoming (accordion per profile) ----

function IncomingTab() {
  const { data: profiles = [], isLoading } = useQuery<TenantProfile[]>({
    queryKey: ["tenant-profiles"],
    queryFn: () => api.get("/tenant-profiles").then((r) => r.data),
  });
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<string | null>(null);

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

  return (
    <div className="space-y-3">
      {profiles.map((profile) => (
        <ProfileIncoming
          key={profile.id}
          profile={profile}
          expanded={expanded === profile.id}
          onToggle={() => setExpanded(expanded === profile.id ? null : profile.id)}
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
  const { data, isLoading } = useQuery<{ items: MatchedListingCard[] }>({
    queryKey: ["incoming", profile.id],
    queryFn: () =>
      api
        .get(`/tenant-profiles/${profile.id}/interests/incoming?limit=50`)
        .then((r) => r.data),
    enabled: expanded,
  });

  const expressInterest = useMutation({
    mutationFn: (listingId: string) =>
      api.post(`/tenant-profiles/${profile.id}/listings/${listingId}/interest`),
    onSuccess: (res) => {
      if (res.data.status === "matched") onMatched();
      qc.invalidateQueries({ queryKey: ["incoming", profile.id] });
    },
  });

  const pendingCount = (data?.items ?? []).filter((i) => !i.interest_sent).length;

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm font-medium text-gray-700">{profile.name}</span>
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
            <p className="py-4 text-center text-sm text-gray-400">目前無 incoming 興趣</p>
          )}
          <div className="space-y-2">
            {(data?.items ?? []).map((listing) => (
              <div
                key={listing.id}
                className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2.5"
              >
                <div className="text-sm">
                  <span className="font-medium text-gray-900">
                    ${listing.rent.toLocaleString()}
                  </span>
                  <span className="ml-2 text-gray-500">
                    {ROOM_TYPE_LABELS[listing.room_type] ?? listing.room_type}{" "}
                    {listing.area_ping}坪
                  </span>
                  <span className="ml-2 text-gray-400">
                    {LOCATION_LABELS[listing.location_id] ?? listing.location_id}
                  </span>
                </div>
                {listing.interest_sent ? (
                  <span className="rounded-full bg-[#EDE9FE] px-2.5 py-0.5 text-xs font-medium text-[#5B21B6]">
                    已送出
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => expressInterest.mutate(listing.id)}
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
  listing_id: string;
  rent: number;
  room_type: string;
  area_ping: number;
  tenant_profile_name: string;
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
        description="前往找房源，對感興趣的房源按「有興趣」"
      />
    );
  }

  return (
    <div className="space-y-2">
      {(data?.items ?? []).map((i) => (
        <div
          key={i.listing_id}
          className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm"
        >
          <div className="text-sm">
            <span className="font-medium text-gray-900">${i.rent.toLocaleString()}</span>
            <span className="ml-2 text-gray-500">
              {ROOM_TYPE_LABELS[i.room_type] ?? i.room_type} {i.area_ping}坪
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">需求卡：{i.tenant_profile_name}</span>
            <span className="rounded-full bg-[#EDE9FE] px-2.5 py-0.5 text-xs font-medium text-[#5B21B6]">
              已送出
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---- Matched ----

type MatchItem = {
  match_id: string;
  listing_id: string;
  contact_info: string;
  matched_at: string;
  rent?: number;
  room_type?: string;
  area_ping?: number;
  profile_name?: string;
};

function MatchedTab() {
  const { data, isLoading } = useQuery<{ items: MatchItem[] }>({
    queryKey: ["matched"],
    queryFn: () => api.get("/matches/mutual?limit=50").then((r) => r.data),
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
    <div className="space-y-3">
      {(data?.items ?? []).map((m) => (
        <div key={m.match_id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span className="rounded-full bg-[#D1FAE5] px-2 py-0.5 font-medium text-[#065F46]">
              媒合成功
            </span>
            <span>{new Date(m.matched_at).toLocaleDateString("zh-TW")}</span>
            {m.profile_name && <span>需求卡：{m.profile_name}</span>}
          </div>
          {m.rent && (
            <p className="mt-2 text-sm font-medium text-gray-900">
              ${m.rent.toLocaleString()} ／{" "}
              {ROOM_TYPE_LABELS[m.room_type ?? ""] ?? m.room_type} {m.area_ping}坪
            </p>
          )}
          <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
            <p className="mb-1 text-xs text-gray-400">
              以下為對方自填資料，平台不保證真實性，請自行確認。
            </p>
            <p className="text-sm font-medium text-gray-950">{m.contact_info}</p>
          </div>
        </div>
      ))}
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
      : "",
    min_lease_months: editingProfile?.min_lease_months ?? 6,
    min_area_ping: editingProfile?.min_area_ping ? String(editingProfile.min_area_ping) : "",
    has_pets: editingProfile?.has_pets ?? false,
    pet_description: editingProfile?.pet_description ?? "",
    needs_subsidy: editingProfile?.needs_subsidy ?? false,
    needs_tax_receipt: editingProfile?.needs_tax_receipt ?? false,
    needs_household_registration: editingProfile?.needs_household_registration ?? false,
    needs_cooking: editingProfile?.needs_cooking ?? false,
    needs_parking: editingProfile?.needs_parking ?? false,
    smoking: editingProfile?.smoking ?? false,
    occupation: editingProfile?.occupation ?? "",
    description: editingProfile?.description ?? "",
    contact_info: "",
  }));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
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
    setLoading(true);
    setError("");
    const payload = {
      ...form,
      budget_min: Number(form.budget_min),
      budget_max: Number(form.budget_max),
      min_lease_months: Number(form.min_lease_months),
      min_area_ping: form.min_area_ping ? Number(form.min_area_ping) : null,
      available_from: form.available_from ? `${form.available_from}T00:00:00Z` : form.available_from,
    };
    try {
      if (editingProfile) {
        await api.put(`/tenant-profiles/${editingProfile.id}`, payload);
      } else {
        await api.post("/tenant-profiles", payload);
      }
      onSaved();
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-6 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="profile-name" className="mb-1 block text-sm font-medium text-gray-700">
              需求名稱（如：台北套房）
            </label>
            <input
              id="profile-name"
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="input"
              placeholder="例：台北大安套房"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="budget-min" className="mb-1 block text-sm font-medium text-gray-700">
                最低預算（元）
              </label>
              <input
                id="budget-min"
                required
                type="number"
                min={0}
                value={form.budget_min || ""}
                onChange={(e) => setForm((f) => ({ ...f, budget_min: Number(e.target.value) }))}
                className="input"
              />
            </div>
            <div>
              <label htmlFor="budget-max" className="mb-1 block text-sm font-medium text-gray-700">
                最高預算（元）
              </label>
              <input
                id="budget-max"
                required
                type="number"
                min={0}
                value={form.budget_max || ""}
                onChange={(e) => setForm((f) => ({ ...f, budget_max: Number(e.target.value) }))}
                className="input"
              />
            </div>
          </div>

          <div>
            <p className="mb-1 text-sm font-medium text-gray-700">可接受地區（多選）</p>
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
            <p className="mb-1 text-sm font-medium text-gray-700">偏好房型（多選）</p>
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
                最快入住日
              </label>
              <input
                id="available-from"
                required
                type="date"
                value={form.available_from}
                onChange={(e) => setForm((f) => ({ ...f, available_from: e.target.value }))}
                className="input"
              />
            </div>
            <div>
              <label htmlFor="min-lease" className="mb-1 block text-sm font-medium text-gray-700">
                最短租期（月）
              </label>
              <input
                id="min-lease"
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

          <div>
            <label htmlFor="min-area" className="mb-1 block text-sm font-medium text-gray-700">
              最小坪數（可不填）
            </label>
            <input
              id="min-area"
              type="number"
              min={1}
              value={form.min_area_ping}
              onChange={(e) => setForm((f) => ({ ...f, min_area_ping: e.target.value }))}
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
              <label key={key} className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
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

          {form.has_pets && (
            <div>
              <label htmlFor="pet-desc" className="mb-1 block text-sm font-medium text-gray-700">
                寵物描述（選填）
              </label>
              <input
                id="pet-desc"
                value={form.pet_description}
                onChange={(e) => setForm((f) => ({ ...f, pet_description: e.target.value }))}
                className="input"
                placeholder="例：一隻小型犬，已結紮"
              />
            </div>
          )}

          <div>
            <label htmlFor="occupation" className="mb-1 block text-sm font-medium text-gray-700">
              職業（選填）
            </label>
            <input
              id="occupation"
              value={form.occupation}
              onChange={(e) => setForm((f) => ({ ...f, occupation: e.target.value }))}
              className="input"
              placeholder="例：上班族、學生、自由工作者"
            />
          </div>

          <div>
            <label htmlFor="description" className="mb-1 block text-sm font-medium text-gray-700">
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
            </label>
            <input
              id="contact-info"
              required={!editingProfile}
              value={form.contact_info}
              onChange={(e) => setForm((f) => ({ ...f, contact_info: e.target.value }))}
              className="input"
              placeholder="例：Line ID: xxx 或 0912-345-678"
            />
            <p className="mt-1 text-xs text-gray-400">媒合成功後才會顯示給對方，請填真實聯絡方式</p>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-primary-600 py-3 text-sm font-medium text-white transition hover:bg-primary-500 disabled:opacity-40"
          >
            {loading ? "儲存中…" : "儲存需求卡"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ---- Shared UI ----

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
  return (
    <div className="py-8 text-center text-sm text-gray-400">載入中…</div>
  );
}

function SkeletonListingCard() {
  return (
    <div className="flex animate-pulse gap-4 rounded-xl border border-gray-200 bg-white p-5">
      <div className="h-[132px] w-44 flex-shrink-0 rounded-lg bg-gray-200" />
      <div className="flex-1 space-y-2 py-1">
        <div className="h-5 w-32 rounded bg-gray-200" />
        <div className="h-4 w-24 rounded bg-gray-200" />
        <div className="h-4 w-48 rounded bg-gray-200" />
        <div className="flex gap-1">
          <div className="h-5 w-14 rounded-full bg-gray-200" />
          <div className="h-5 w-14 rounded-full bg-gray-200" />
        </div>
      </div>
    </div>
  );
}

function SkeletonProfileCard() {
  return (
    <div className="flex animate-pulse items-center justify-between rounded-xl border border-gray-200 bg-white p-5">
      <div className="space-y-2">
        <div className="h-4 w-28 rounded bg-gray-200" />
        <div className="h-3 w-44 rounded bg-gray-200" />
      </div>
      <div className="flex gap-2">
        <div className="h-7 w-16 rounded-lg bg-gray-200" />
        <div className="h-7 w-12 rounded-lg bg-gray-200" />
      </div>
    </div>
  );
}
