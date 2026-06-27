"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Building2 } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonListingMgmtCard } from "@/components/ui/Skeletons";
import { qk } from "@/features/queryKeys";
import { useListings } from "@/features/listings/useListings";
import { ListingMgmtCard } from "@/features/listings/ListingMgmtCard";
import { ListingFormModal } from "@/features/listings/ListingFormModal";

export function ListingsTab({
  onSelectListing,
}: {
  onSelectListing: (id: string) => void;
}) {
  const qc = useQueryClient();
  const { data: listings = [], isLoading } = useListings();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<"all" | "active" | "rented">("all");

  const filtered =
    filter === "all" ? listings : listings.filter((l) => l.status === filter);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[0, 1].map((i) => (
          <SkeletonListingMgmtCard key={i} />
        ))}
      </div>
    );
  }

  if (!isLoading && listings.length === 0) {
    return (
      <>
        <EmptyState
          icon={<Building2 size={32} strokeWidth={1.5} className="text-gray-300" />}
          title="尚無房源"
          description="建立第一筆房源，就能開始找符合條件的租客"
          action={{
            label: "新增第一筆房源",
            onClick: () => {
              setEditingId(null);
              setShowForm(true);
            },
          }}
        />
        {showForm && (
          <ListingFormModal
            editingId={null}
            onClose={() => setShowForm(false)}
            onSaved={() => {
              qc.invalidateQueries({ queryKey: qk.listings() });
              setShowForm(false);
            }}
          />
        )}
      </>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-950">我的房源</h2>
        <button
          type="button"
          onClick={() => {
            setEditingId(null);
            setShowForm(true);
          }}
          className="bg-primary-600 hover:bg-primary-500 rounded-lg px-3 py-1.5 text-sm font-medium text-white transition"
        >
          + 新增房源
        </button>
      </div>
      <div className="mb-4 flex gap-1.5">
        {(
          [
            ["all", "全部"],
            ["active", "刊登中"],
            ["rented", "已出租"],
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
      {filtered.length === 0 && (
        <p className="py-8 text-center text-sm text-gray-400">此分類沒有房源</p>
      )}
      <div className="space-y-3">
        {filtered.map((l) => (
          <ListingMgmtCard
            key={l.id}
            listing={l}
            onEdit={() => {
              setEditingId(l.id);
              setShowForm(true);
            }}
            onBrowse={() => onSelectListing(l.id)}
            onChanged={() => qc.invalidateQueries({ queryKey: qk.listings() })}
          />
        ))}
      </div>
      {showForm && (
        <ListingFormModal
          editingId={editingId}
          onClose={() => {
            setShowForm(false);
            setEditingId(null);
          }}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: qk.listings() });
            setShowForm(false);
            setEditingId(null);
          }}
        />
      )}
    </div>
  );
}
