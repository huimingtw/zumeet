"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Building2, CalendarClock, Heart, Search } from "lucide-react";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { RoleGuard } from "@/components/RoleGuard";
import { BottomTabItem } from "@/components/ui/BottomTabItem";
import { TabButton } from "@/components/ui/TabButton";
import { MatchesView } from "@/features/matches/MatchesView";
import { ListingsTab } from "@/features/listings/ListingsTab";
import { LandlordBrowseTab } from "@/features/profiles/LandlordBrowseTab";
import { LandlordViewingsView } from "@/features/viewings/LandlordViewingsView";

type MainTab = "listings" | "browse" | "matches" | "viewings";
type MatchesSubTab = "incoming" | "outgoing" | "matched";

function LandlordDashboardInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = (searchParams.get("tab") as MainTab) ?? "listings";
  const matchesSubTab = (searchParams.get("subtab") as MatchesSubTab) ?? "incoming";
  const selectedListingId = searchParams.get("listing");

  function setTab(t: MainTab) {
    router.push(`?tab=${t}`);
  }

  function setMatchesSubTab(st: MatchesSubTab) {
    router.push(`?tab=matches&subtab=${st}`);
  }

  function goToBrowse(id: string) {
    router.push(`?tab=browse&listing=${id}`);
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
          <LandlordBrowseTab
            selectedListingId={selectedListingId}
            onSelectListing={(id) => router.push(`?tab=browse&listing=${id}`)}
            onGoToListings={() => setTab("listings")}
          />
        )}
        {tab === "matches" && (
          <MatchesView
            role="landlord"
            subTab={matchesSubTab}
            onSubTabChange={setMatchesSubTab}
          />
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

export default function LandlordDashboard() {
  return (
    <RoleGuard role="landlord">
      <Suspense fallback={<div className="min-h-screen bg-gray-100" />}>
        <LandlordDashboardInner />
      </Suspense>
    </RoleGuard>
  );
}
