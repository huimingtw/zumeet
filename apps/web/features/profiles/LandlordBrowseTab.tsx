"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, SearchX } from "lucide-react";
import { Dropdown } from "@/components/ui/Dropdown";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonProfileCard } from "@/components/ui/Skeletons";
import { api } from "@/lib/api";
import { ROOM_TYPE_LABELS } from "@/types";
import { qk } from "@/features/queryKeys";
import { useListings, useProfilesBrowse } from "@/features/listings/useListings";
import { TenantProfileCard } from "@/features/profiles/TenantProfileCard";
import { ReportModal } from "@/features/reports/ReportModal";

export function LandlordBrowseTab({
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
    activeListings.find((l) => l.id === selectedListingId)?.id ??
    activeListings[0]?.id ??
    null;

  const qc = useQueryClient();
  const { data, isLoading } = useProfilesBrowse(currentId ?? "");
  const [reportTarget, setReportTarget] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "open" | "sent">("all");

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

  const allItems = data?.items ?? [];
  const items =
    filter === "sent"
      ? allItems.filter((p) => p.interest_sent)
      : filter === "open"
        ? allItems.filter((p) => !p.interest_sent)
        : allItems;

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
                l.name ||
                `$${l.rent.toLocaleString()} ${ROOM_TYPE_LABELS[l.room_type] ?? l.room_type}`,
            }))}
            onChange={onSelectListing}
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
              filter === key
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <SkeletonProfileCard key={i} />
          ))}
        </div>
      )}
      {!isLoading && allItems.length === 0 && (
        <EmptyState
          icon={<SearchX size={32} strokeWidth={1.5} className="text-gray-300" />}
          title="目前無符合條件的租客需求卡"
          description="符合條件的租客尚未刊登需求，可稍後再查看"
        />
      )}
      {!isLoading && allItems.length > 0 && items.length === 0 && (
        <p className="py-8 text-center text-sm text-gray-400">此分類沒有需求卡</p>
      )}
      <div className="space-y-3">
        {items.map((profile) => (
          <TenantProfileCard
            key={profile.id}
            profile={profile}
            onInterest={() => expressInterest.mutate(profile.id)}
            onReport={profile.tenant_id ? () => setReportTarget(profile.tenant_id!) : undefined}
          />
        ))}
      </div>
      {reportTarget && (
        <ReportModal
          open
          onClose={() => setReportTarget(null)}
          reportedId={reportTarget}
        />
      )}
    </div>
  );
}
