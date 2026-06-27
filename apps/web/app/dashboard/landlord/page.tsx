"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, CalendarClock, Heart, Search, SearchX } from "lucide-react";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { RoleGuard } from "@/components/RoleGuard";
import { Dropdown } from "@/components/ui/Dropdown";
import { BottomTabItem } from "@/components/ui/BottomTabItem";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonListingMgmtCard, SkeletonProfileCard } from "@/components/ui/Skeletons";
import { TabButton } from "@/components/ui/TabButton";
import { api } from "@/lib/api";
import { ROOM_TYPE_LABELS } from "@/types";
import { qk } from "@/features/queryKeys";
import { useListings, useProfilesBrowse } from "@/features/listings/useListings";
import { MatchesView } from "@/features/matches/MatchesView";
import { ListingMgmtCard } from "@/features/listings/ListingMgmtCard";
import { ListingFormModal } from "@/features/listings/ListingFormModal";
import { TenantProfileCard } from "@/features/profiles/TenantProfileCard";
import { LandlordViewingsView } from "@/features/viewings/LandlordViewingsView";

type MainTab = "listings" | "browse" | "matches" | "viewings";
type MatchesSubTab = "incoming" | "outgoing" | "matched";

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
        {tab === "viewings" && <LandlordViewingsView />}
      </div>

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

// ---- Listings Tab ----

function ListingsTab({ onSelectListing }: { onSelectListing: (id: string) => void }) {
  const qc = useQueryClient();
  const { data: listings = [], isLoading } = useListings();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<"all" | "active" | "rented">("all");

  const filtered = filter === "all" ? listings : listings.filter((l) => l.status === filter);

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
              filter === key ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
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
          <ListingMgmtCard
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
    activeListings.find((l) => l.id === selectedListingId)?.id ?? activeListings[0]?.id ?? null;

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
                l.name || `$${l.rent.toLocaleString()} ${ROOM_TYPE_LABELS[l.room_type] ?? l.room_type}`,
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
