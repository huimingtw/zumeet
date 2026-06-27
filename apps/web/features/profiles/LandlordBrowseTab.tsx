"use client";

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
                l.name ||
                `$${l.rent.toLocaleString()} ${ROOM_TYPE_LABELS[l.room_type] ?? l.room_type}`,
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
