"use client";

import { ClipboardList, CalendarClock, Heart, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { BottomTabItem } from "@/components/ui/BottomTabItem";
import { TabButton } from "@/components/ui/TabButton";
import { RoleGuard } from "@/components/RoleGuard";
import { ViewingList } from "@/components/ViewingList";
import { MatchesView } from "@/features/matches/MatchesView";
import { ProfilesTab } from "@/features/profiles/ProfilesTab";
import { TenantBrowseTab } from "@/features/listings/TenantBrowseTab";

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

        {tab === "requirements" && (
          <ProfilesTab onSelectProfile={(id) => router.push(`?tab=listings&profile=${id}`)} />
        )}
        {tab === "viewings" && <ViewingList role="tenant" />}
        {tab === "listings" && (
          <TenantBrowseTab
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
