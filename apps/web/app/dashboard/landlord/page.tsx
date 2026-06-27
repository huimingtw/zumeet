"use client";

import { useState } from "react";
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
          <LandlordBrowseTab
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
