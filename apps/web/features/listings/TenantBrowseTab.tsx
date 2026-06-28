"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, SearchX } from "lucide-react";
import { Dropdown } from "@/components/ui/Dropdown";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonListingCard } from "@/components/ui/Skeletons";
import { api } from "@/lib/api";
import type { MatchedListingCard } from "@/types";
import { qk } from "@/features/queryKeys";
import {
  useTenantProfiles,
  useListingsBrowse,
} from "@/features/profiles/useTenantProfiles";
import { ListingCard, ListingDetailDialog } from "@/features/listings/TenantListingCard";
import { ReportModal } from "@/features/reports/ReportModal";

export function TenantBrowseTab({
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
    activeProfiles.find((p) => p.id === selectedProfileId)?.id ??
    activeProfiles[0]?.id ??
    null;

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
  const [reportTarget, setReportTarget] = useState<{ reportedId: string; listingId: string } | null>(null);

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
            onReport={listing.landlord_id ? () => setReportTarget({ reportedId: listing.landlord_id!, listingId: listing.id }) : undefined}
            action={
              listing.interest_sent ? (
                <Badge tone="brand">已送出</Badge>
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
              <p className="text-center text-sm text-gray-400">
                已送出興趣，等待房東回應
              </p>
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
      {reportTarget && (
        <ReportModal
          open
          onClose={() => setReportTarget(null)}
          reportedId={reportTarget.reportedId}
          listingId={reportTarget.listingId}
        />
      )}
    </div>
  );
}
