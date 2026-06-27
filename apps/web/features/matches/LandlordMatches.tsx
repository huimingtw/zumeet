"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Heart, Inbox, SendHorizonal } from "lucide-react";
import { useConfirm } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { ExpandableText } from "@/components/ui/ExpandableText";
import { Loading } from "@/components/ui/Loading";
import { api } from "@/lib/api";
import { useListings, useIncomingListing } from "@/features/listings/useListings";
import { useOutgoing, useMatched } from "@/features/matches/useMatches";
import { qk } from "@/features/queryKeys";
import type { Listing, MatchedTenantProfileCard, MutualMatch } from "@/types";
import { ROOM_TYPE_LABELS } from "@/types";

// ---- Shared tenant helpers ----

export function profileHeader(
  profile: Pick<MatchedTenantProfileCard, "occupation" | "age" | "has_pets">
) {
  const parts = [
    profile.occupation,
    profile.age != null ? `${profile.age} 歲` : null,
    profile.has_pets ? "養寵物" : null,
  ].filter(Boolean) as string[];
  return parts.length > 0 ? `[${parts.join("，")}]` : "租客";
}

function tenantHeader(p: {
  tenant_occupation?: string;
  tenant_age?: number;
  tenant_has_pets?: boolean;
}) {
  const parts = [
    p.tenant_occupation,
    p.tenant_age != null ? `${p.tenant_age} 歲` : null,
    p.tenant_has_pets ? "養寵物" : null,
  ].filter(Boolean) as string[];
  return parts.length > 0 ? `[${parts.join("，")}]` : "租客";
}

// ---- Incoming tab ----

type LandlordOutgoingItem = {
  tenant_profile_id: string;
  listing_id: string;
  profile_name: string;
  budget_min: number;
  budget_max: number;
  tenant_occupation?: string;
  tenant_age?: number;
  tenant_has_pets?: boolean;
  tenant_description?: string;
};

type LandlordMatchItem = {
  match_id: string;
  tenant_profile_id: string;
  listing_id: string;
  listing_name?: string;
  contact_info: string;
  matched_at: string;
  profile_name?: string;
  tenant_occupation?: string;
  tenant_age?: number;
  tenant_has_pets?: boolean;
  tenant_description?: string;
};

export function LandlordIncomingTab() {
  const { data: listings = [], isLoading } = useListings();
  const qc = useQueryClient();
  const [expandedSet, setExpandedSet] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (listings.length > 0) setExpandedSet(new Set(listings.map((l) => l.id))); // eslint-disable-line react-hooks/set-state-in-effect
  }, [listings]);

  if (isLoading) return <Loading />;

  if (listings.length === 0) {
    return (
      <EmptyState
        icon={<Inbox size={32} strokeWidth={1.5} className="text-gray-300" />}
        title="尚無房源"
        description="建立並上架房源後，才能接收租客的媒合興趣"
      />
    );
  }

  function toggle(id: string) {
    setExpandedSet((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-3">
      {listings.map((listing) => (
        <ListingIncoming
          key={listing.id}
          listing={listing}
          expanded={expandedSet.has(listing.id)}
          onToggle={() => toggle(listing.id)}
          onMatched={() => qc.invalidateQueries({ queryKey: qk.matched() })}
        />
      ))}
    </div>
  );
}

function ListingIncoming({
  listing,
  expanded,
  onToggle,
  onMatched,
}: {
  listing: Listing;
  expanded: boolean;
  onToggle: () => void;
  onMatched: () => void;
}) {
  const qc = useQueryClient();
  const { data, isLoading } = useIncomingListing(listing.id, { enabled: expanded });

  const expressInterest = useMutation({
    mutationFn: (profileId: string) =>
      api.post(`/listings/${listing.id}/tenant-profiles/${profileId}/interest`),
    onSuccess: (res) => {
      if (res.data.status === "matched") onMatched();
      qc.invalidateQueries({ queryKey: qk.incomingListing(listing.id) });
      qc.invalidateQueries({ queryKey: qk.matched() });
    },
  });

  const pendingCount = (data?.items ?? []).filter((p) => !p.interest_sent).length;

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm font-medium text-gray-700">
          {listing.name ||
            `$${listing.rent.toLocaleString()} ${ROOM_TYPE_LABELS[listing.room_type] ?? listing.room_type}`}
        </span>
        <div className="flex items-center gap-2">
          {expanded && pendingCount > 0 && (
            <span className="bg-primary-600 rounded-full px-2 py-0.5 text-xs font-medium text-white">
              {pendingCount}
            </span>
          )}
          <ChevronDown
            size={16}
            strokeWidth={1.5}
            className={`text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        </div>
      </button>
      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3">
          {isLoading && <Loading />}
          {!isLoading && (data?.items ?? []).length === 0 && (
            <p className="py-4 text-center text-sm text-gray-400">目前無符合條件的租客</p>
          )}
          <div className="space-y-2">
            {(data?.items ?? []).map((profile) => (
              <div
                key={profile.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-gray-100 px-3 py-2.5"
              >
                <div className="min-w-0 flex-1 text-sm">
                  <div className="font-medium text-gray-900">
                    {profileHeader(profile)}
                  </div>
                  {profile.description && (
                    <ExpandableText
                      text={profile.description}
                      className="mt-1 text-xs text-gray-600"
                    />
                  )}
                </div>
                {profile.interest_sent ? (
                  <Badge tone="brand">已送出</Badge>
                ) : (
                  <button
                    type="button"
                    onClick={() => expressInterest.mutate(profile.id)}
                    className="bg-primary-600 hover:bg-primary-500 rounded-lg px-3 py-1 text-xs font-medium text-white transition"
                  >
                    回應興趣
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Outgoing tab ----

export function LandlordOutgoingTab() {
  const qc = useQueryClient();
  const [confirmEl, confirm] = useConfirm();
  const { data, isLoading } = useOutgoing<LandlordOutgoingItem>();

  const withdraw = useMutation({
    mutationFn: (i: LandlordOutgoingItem) =>
      api.delete(
        `/listings/${i.listing_id}/tenant-profiles/${i.tenant_profile_id}/interest`
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.outgoing() }),
  });

  if (isLoading) return <Loading />;

  if ((data?.items ?? []).length === 0) {
    return (
      <EmptyState
        icon={<SendHorizonal size={32} strokeWidth={1.5} className="text-gray-300" />}
        title="尚未送出任何興趣"
        description="前往找租客，對感興趣的需求卡按「有興趣」"
      />
    );
  }

  return (
    <div className="space-y-2">
      {(data?.items ?? []).map((i) => (
        <div
          key={i.tenant_profile_id}
          className="flex items-start justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm"
        >
          <div className="min-w-0 flex-1 text-sm">
            <div className="font-medium text-gray-900">{tenantHeader(i)}</div>
            {i.tenant_description && (
              <ExpandableText
                text={i.tenant_description}
                className="mt-1 text-xs text-gray-600"
              />
            )}
          </div>
          <button
            type="button"
            disabled={withdraw.isPending}
            onClick={async () => {
              if (
                await confirm({
                  message: "確定收回對這張需求卡的興趣？",
                  confirmText: "收回",
                  danger: true,
                })
              )
                withdraw.mutate(i);
            }}
            className="flex-shrink-0 rounded-full border border-gray-200 px-2.5 py-0.5 text-xs font-medium text-gray-500 transition hover:bg-gray-50 disabled:opacity-50"
          >
            收回
          </button>
        </div>
      ))}
      {confirmEl}
    </div>
  );
}

// ---- Matched tab ----

export function LandlordMatchedTab() {
  const { data, isLoading } = useMatched<MutualMatch>();

  if (isLoading) return <Loading />;

  if ((data?.items ?? []).length === 0) {
    return (
      <EmptyState
        icon={<Heart size={32} strokeWidth={1.5} className="text-gray-300" />}
        title="尚無媒合結果"
        description="繼續瀏覽租客需求卡，或等待租客對你的房源表示興趣"
      />
    );
  }

  return (
    <div className="space-y-3">
      {(data?.items ?? []).map((m) => {
        const match = m as unknown as LandlordMatchItem;
        return (
          <div
            key={match.match_id}
            className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
          >
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
              <Badge tone="success">媒合成功</Badge>
              <span>{new Date(match.matched_at).toLocaleDateString("zh-TW")}</span>
              {match.listing_name && <span>房源：{match.listing_name}</span>}
            </div>
            <div className="mt-3">
              <div className="text-sm font-medium text-gray-950">
                {tenantHeader(match)}
              </div>
              {match.tenant_description && (
                <ExpandableText
                  text={match.tenant_description}
                  className="mt-1 text-sm text-gray-600"
                />
              )}
            </div>
            <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
              <p className="mb-1 text-xs text-gray-400">
                以下為對方自填資料，平台不保證真實性，請自行確認。
              </p>
              <p className="text-sm font-medium text-gray-950">{match.contact_info}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
