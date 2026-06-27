"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ClipboardList, CalendarClock, Heart, Search, SearchX } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { Dropdown } from "@/components/ui/Dropdown";
import { BottomTabItem } from "@/components/ui/BottomTabItem";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  SkeletonListingCard,
  SkeletonMyProfileCard as SkeletonProfileCard,
} from "@/components/ui/Skeletons";
import { TabButton } from "@/components/ui/TabButton";
import { RoleGuard } from "@/components/RoleGuard";
import { ViewingList } from "@/components/ViewingList";
import { api } from "@/lib/api";
import type { MatchedListingCard, TenantProfile } from "@/types";
import { qk } from "@/features/queryKeys";
import { useTenantProfiles, useListingsBrowse } from "@/features/profiles/useTenantProfiles";
import { MatchesView } from "@/features/matches/MatchesView";
import { ListingCard, ListingDetailDialog } from "@/features/listings/TenantListingCard";
import { MyProfileCard } from "@/features/profiles/MyProfileCard";
import { ProfileFormModal } from "@/features/profiles/ProfileFormModal";

type MainTab = "requirements" | "listings" | "matches" | "viewings";
type MatchesSubTab = "incoming" | "outgoing" | "matched";

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
          <MatchesView role="tenant" subTab={matchesSubTab} onSubTabChange={setMatchesSubTab} />
        )}
      </div>

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

// ---- Profiles Tab ----

function ProfilesTab({ onSelectProfile }: { onSelectProfile: (id: string) => void }) {
  const qc = useQueryClient();
  const { data: profiles = [], isLoading } = useTenantProfiles();
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
              qc.invalidateQueries({ queryKey: qk.tenantProfiles() });
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
          <MyProfileCard
            key={p.id}
            profile={p}
            onEdit={() => {
              setEditingProfile(p);
              setShowForm(true);
            }}
            onBrowse={() => onSelectProfile(p.id)}
            onDeleted={() => qc.invalidateQueries({ queryKey: qk.tenantProfiles() })}
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
            qc.invalidateQueries({ queryKey: qk.tenantProfiles() });
            setShowForm(false);
            setEditingProfile(null);
          }}
        />
      )}
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
  const { data: profiles = [] } = useTenantProfiles();

  const activeProfiles = profiles.filter((p) => p.is_active);
  const currentId =
    activeProfiles.find((p) => p.id === selectedProfileId)?.id ?? activeProfiles[0]?.id ?? null;

  const qc = useQueryClient();
  const { data, isLoading } = useListingsBrowse(currentId ?? "");

  const expressInterest = useMutation({
    mutationFn: (listingId: string) =>
      api.post(`/tenant-profiles/${currentId}/listings/${listingId}/interest`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.listingsBrowse(currentId) });
      qc.invalidateQueries({ queryKey: qk.matched() });
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
            options={activeProfiles.map((p) => ({ value: p.id, label: p.name }))}
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
              filter === key ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
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
              <p className="text-center text-sm text-gray-400">已送出興趣，等待房東回應</p>
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
