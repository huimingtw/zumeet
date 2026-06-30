"use client";

import { Badge } from "@/components/ui/Badge";
import { CardMenu } from "@/components/ui/CardMenu";
import { TenantSummary } from "@/features/profiles/TenantSummary";
import type { MatchedTenantProfileCard } from "@/types";

export function TenantProfileCard({
  profile,
  onInterest,
  onReport,
}: {
  profile: MatchedTenantProfileCard;
  onInterest: () => void;
  onReport?: () => void;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <TenantSummary info={profile} />
        <div className="flex flex-shrink-0 flex-col items-end gap-2">
          {onReport && (
            <CardMenu items={[{ label: "檢舉此租客", onClick: onReport, danger: true }]} />
          )}
          {profile.interest_sent ? (
            <Badge tone="brand">已送出</Badge>
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
