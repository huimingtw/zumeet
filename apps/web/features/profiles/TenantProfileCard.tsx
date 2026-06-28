"use client";

import { ExpandableText } from "@/components/ui/ExpandableText";
import { Badge } from "@/components/ui/Badge";
import { CardMenu } from "@/components/ui/CardMenu";
import { getProfileTags } from "@/lib/listingTags";
import { profileHeader } from "@/features/matches/LandlordMatches";
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
                <Badge key={tag} tone="brand" className="px-3 py-1">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>
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
