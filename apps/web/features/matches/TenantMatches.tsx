"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Heart, Inbox, SendHorizonal } from "lucide-react";
import { useConfirm } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Loading } from "@/components/ui/Loading";
import { api } from "@/lib/api";
import {
  ListingCard,
  ListingDetailDialog,
  BookViewingModal,
  toListingCard,
  type IncomingListingItem,
  type OutgoingItem,
  type MatchItem,
} from "@/features/listings/TenantListingCard";
import { useTenantProfiles, useIncoming } from "@/features/profiles/useTenantProfiles";
import { useOutgoing, useMatched } from "@/features/matches/useMatches";
import { qk } from "@/features/queryKeys";
import { formatSlot } from "@/lib/viewings";
import type { MatchedListingCard, TenantProfile, Viewing } from "@/types";

// ---- Incoming tab ----

export function TenantIncomingTab() {
  const { data: profiles = [], isLoading } = useTenantProfiles();
  const qc = useQueryClient();
  const [expandedSet, setExpandedSet] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (profiles.length > 0) setExpandedSet(new Set(profiles.map((p) => p.id))); // eslint-disable-line react-hooks/set-state-in-effect
  }, [profiles]);

  if (isLoading) return <Loading />;

  if (profiles.length === 0) {
    return (
      <EmptyState
        icon={<Inbox size={32} strokeWidth={1.5} className="text-gray-300" />}
        title="尚無需求卡"
        description="建立需求卡後，才能接收房東的媒合興趣"
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
      {profiles.map((profile) => (
        <ProfileIncoming
          key={profile.id}
          profile={profile}
          expanded={expandedSet.has(profile.id)}
          onToggle={() => toggle(profile.id)}
          onMatched={() => qc.invalidateQueries({ queryKey: qk.matched() })}
        />
      ))}
    </div>
  );
}

function ProfileIncoming({
  profile,
  expanded,
  onToggle,
  onMatched,
}: {
  profile: TenantProfile;
  expanded: boolean;
  onToggle: () => void;
  onMatched: () => void;
}) {
  const qc = useQueryClient();
  const { data, isLoading } = useIncoming<IncomingListingItem>(profile.id, {
    enabled: expanded,
  });
  const [detail, setDetail] = useState<MatchedListingCard | null>(null);

  const expressInterest = useMutation({
    mutationFn: (listingId: string) =>
      api.post(`/tenant-profiles/${profile.id}/listings/${listingId}/interest`),
    onSuccess: (res) => {
      if (res.data.status === "matched") onMatched();
      qc.invalidateQueries({ queryKey: qk.incoming(profile.id) });
    },
  });

  const items = data?.items ?? [];
  const pendingCount = items.filter((i) => !i.interest_sent).length;

  return (
    <>
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <button
          type="button"
          onClick={onToggle}
          className="flex w-full items-center justify-between px-4 py-3 text-left"
        >
          <span className="text-sm font-medium text-gray-700">{profile.name}</span>
          <div className="flex items-center gap-2">
            {pendingCount > 0 && (
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
          <div className="border-t border-gray-100 px-3 py-3">
            {isLoading && <Loading />}
            {!isLoading && items.length === 0 && (
              <p className="py-4 text-center text-sm text-gray-400">目前無房東表示興趣</p>
            )}
            <div className="space-y-3">
              {items.map((item) => {
                const card = toListingCard(item);
                return (
                  <ListingCard
                    key={item.listing_id}
                    listing={card}
                    onClick={() => setDetail(card)}
                    action={
                      item.interest_sent ? (
                        <span className="rounded-full bg-[#EDE9FE] px-2.5 py-0.5 text-xs font-medium text-[#5B21B6]">
                          已送出
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => expressInterest.mutate(item.listing_id)}
                          className="bg-primary-600 hover:bg-primary-500 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition"
                        >
                          回應興趣
                        </button>
                      )
                    }
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>
      {detail && (
        <ListingDetailDialog
          listing={detail}
          onClose={() => setDetail(null)}
          action={
            detail.interest_sent ? (
              <p className="text-center text-sm text-gray-400">
                已送出興趣，等待房東回應
              </p>
            ) : (
              <button
                type="button"
                onClick={() => {
                  expressInterest.mutate(detail.id);
                  setDetail(null);
                }}
                className="bg-primary-600 hover:bg-primary-500 w-full rounded-lg py-3 text-sm font-medium text-white transition"
              >
                回應興趣
              </button>
            )
          }
        />
      )}
    </>
  );
}

// ---- Outgoing tab ----

export function TenantOutgoingTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useOutgoing<OutgoingItem>();
  const [detail, setDetail] = useState<OutgoingItem | null>(null);
  const [confirmEl, confirm] = useConfirm();

  const withdraw = useMutation({
    mutationFn: (i: OutgoingItem) =>
      api.delete(
        `/tenant-profiles/${i.tenant_profile_id}/listings/${i.listing_id}/interest`
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.outgoing() });
      setDetail(null);
    },
  });

  if (isLoading) return <Loading />;

  if ((data?.items ?? []).length === 0) {
    return (
      <EmptyState
        icon={<SendHorizonal size={32} strokeWidth={1.5} className="text-gray-300" />}
        title="尚未送出任何興趣"
        description="前往找房源，對感興趣的房源按「有興趣」"
      />
    );
  }

  return (
    <>
      <div className="space-y-3">
        {(data?.items ?? []).map((i) => {
          const card = toListingCard(i);
          return (
            <ListingCard
              key={i.listing_id}
              listing={card}
              onClick={() => setDetail(i)}
              action={
                <button
                  type="button"
                  disabled={withdraw.isPending}
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (
                      await confirm({
                        message: "確定收回對這筆房源的興趣？",
                        confirmText: "收回興趣",
                        danger: true,
                      })
                    )
                      withdraw.mutate(i);
                  }}
                  className="rounded-full border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
                >
                  收回興趣
                </button>
              }
            />
          );
        })}
      </div>
      {detail && (
        <ListingDetailDialog
          listing={toListingCard(detail)}
          onClose={() => setDetail(null)}
          action={
            <button
              type="button"
              disabled={withdraw.isPending}
              onClick={async () => {
                if (
                  await confirm({
                    message: "確定收回對這筆房源的興趣？",
                    confirmText: "收回興趣",
                    danger: true,
                  })
                )
                  withdraw.mutate(detail);
              }}
              className="w-full rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
            >
              收回興趣
            </button>
          }
        />
      )}
      {confirmEl}
    </>
  );
}

// ---- Matched tab ----

export function TenantMatchedTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useMatched<MatchItem>();
  // Cross-reference existing viewings so each matched listing shows 預約/已預約 state.
  const { data: viewingsData } = useQuery<{ items: Viewing[] }>({
    queryKey: qk.viewings("tenant"),
    queryFn: () => api.get("/viewings?role=tenant").then((r) => r.data),
  });
  const viewingByListing = new Map<string, Viewing>();
  for (const v of viewingsData?.items ?? []) {
    if (v.status === "confirmed") viewingByListing.set(v.listing_id, v);
  }

  const [detail, setDetail] = useState<{
    card: MatchedListingCard;
    contactInfo: string;
  } | null>(null);
  const [bookFor, setBookFor] = useState<MatchItem | null>(null);

  const book = useMutation({
    mutationFn: (p: { matchId: string; startsAt: string }) =>
      api.post("/viewings", { match_id: p.matchId, starts_at: p.startsAt }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.viewings() });
      qc.invalidateQueries({ queryKey: qk.viewingSlots() });
    },
  });

  if (isLoading) return <Loading />;

  if ((data?.items ?? []).length === 0) {
    return (
      <EmptyState
        icon={<Heart size={32} strokeWidth={1.5} className="text-gray-300" />}
        title="尚無媒合結果"
        description="繼續瀏覽房源，或等待房東對你的需求卡表示興趣"
      />
    );
  }

  return (
    <>
      <div className="space-y-3">
        {(data?.items ?? []).map((m) => {
          const card = toListingCard({
            listing_id: m.listing_id,
            listing_name: m.listing_name,
            rent: m.rent ?? 0,
            room_type: m.room_type ?? "",
            area_ping: m.area_ping ?? 0,
            location_id: m.location_id,
            photos: m.photos,
            available_from: m.available_from,
            allow_pets: m.allow_pets,
            allow_subsidy: m.allow_subsidy,
            allow_tax_receipt: m.allow_tax_receipt,
            allow_household_registration: m.allow_household_registration,
            allow_cooking: m.allow_cooking,
            has_parking: m.has_parking,
            allow_smoking: m.allow_smoking,
            address: m.address,
            lat: m.lat,
            lng: m.lng,
          });
          const viewing = viewingByListing.get(m.listing_id);
          const rented = m.status === "listing_rented";
          return (
            <ListingCard
              key={m.match_id}
              listing={card}
              onClick={() => setDetail({ card, contactInfo: m.contact_info })}
              contactInfo={m.contact_info}
              action={
                rented ? (
                  <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500">
                    房東已標記出租
                  </span>
                ) : viewing ? (
                  <span className="rounded-full bg-[#D1FAE5] px-2.5 py-0.5 text-xs font-medium text-[#059669]">
                    已預約 {formatSlot(viewing.starts_at, viewing.ends_at)}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setBookFor(m);
                    }}
                    className="bg-primary-600 hover:bg-primary-500 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition"
                  >
                    預約看房
                  </button>
                )
              }
            />
          );
        })}
      </div>
      {detail && (
        <ListingDetailDialog
          listing={detail.card}
          onClose={() => setDetail(null)}
          contactInfo={detail.contactInfo}
        />
      )}
      {bookFor && (
        <BookViewingModal
          match={bookFor}
          pending={book.isPending}
          onClose={() => setBookFor(null)}
          onSubmit={(startsAt) =>
            book.mutate(
              { matchId: bookFor.match_id, startsAt },
              { onSuccess: () => setBookFor(null) }
            )
          }
        />
      )}
    </>
  );
}
