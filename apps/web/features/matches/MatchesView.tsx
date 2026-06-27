"use client";

import {
  LandlordIncomingTab,
  LandlordOutgoingTab,
  LandlordMatchedTab,
} from "./LandlordMatches";
import { TenantIncomingTab, TenantOutgoingTab, TenantMatchedTab } from "./TenantMatches";

type MatchesSubTab = "incoming" | "outgoing" | "matched";

export function MatchesView({
  role,
  subTab,
  onSubTabChange,
}: {
  role: "landlord" | "tenant";
  subTab: MatchesSubTab;
  onSubTabChange: (t: MatchesSubTab) => void;
}) {
  const IncomingTab = role === "landlord" ? LandlordIncomingTab : TenantIncomingTab;
  const OutgoingTab = role === "landlord" ? LandlordOutgoingTab : TenantOutgoingTab;
  const MatchedTab = role === "landlord" ? LandlordMatchedTab : TenantMatchedTab;

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
