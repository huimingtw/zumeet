"use client";

import { type ReactNode, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal } from "lucide-react";
import { api } from "@/lib/api";
import { qk } from "@/features/queryKeys";
import type { Listing } from "@/types";
import { ROOM_TYPE_LABELS } from "@/types";

const STATUS_LABELS: Record<string, string> = {
  draft: "草稿",
  active: "刊登中",
  paused: "暫停",
  rented: "已出租",
};

export function ListingMgmtCard({
  listing,
  onEdit,
  onBrowse,
  onChanged,
}: {
  listing: Listing;
  onEdit: () => void;
  onBrowse: () => void;
  onChanged: () => void;
}) {
  const qc = useQueryClient();

  const changeStatus = useMutation({
    mutationFn: (status: string) =>
      api.patch(`/listings/${listing.id}/status`, { status }),
    onSuccess: () => {
      onChanged();
      qc.invalidateQueries({ queryKey: qk.listings() });
    },
  });
  const deleteListing = useMutation({
    mutationFn: () => api.delete(`/listings/${listing.id}`),
    onSuccess: onChanged,
  });

  const statusBadgeClass =
    listing.status === "active"
      ? "bg-[#D1FAE5] text-[#059669]"
      : listing.status === "draft"
        ? "bg-[#FEF3C7] text-[#92400E]"
        : listing.status === "rented"
          ? "bg-blue-100 text-blue-700"
          : "bg-gray-100 text-gray-500";

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {listing.name && (
              <span className="text-base font-semibold text-gray-950">{listing.name}</span>
            )}
            <span
              className={
                listing.name ? "text-sm text-gray-500" : "text-base font-semibold text-gray-950"
              }
            >
              ${listing.rent.toLocaleString()}
            </span>
            <span className="text-sm text-gray-500">
              {ROOM_TYPE_LABELS[listing.room_type] ?? listing.room_type} {listing.area_ping}坪
            </span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass}`}>
              {STATUS_LABELS[listing.status] ?? listing.status}
            </span>
          </div>
          <p className="mt-1 text-xs text-gray-400">
            可入住：{new Date(listing.available_from).toLocaleDateString("zh-TW")} ／{" "}
            {listing.photos.length} 張照片
          </p>
        </div>

        <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
          {listing.status === "draft" && (
            <button
              type="button"
              onClick={() => changeStatus.mutate("active")}
              disabled={listing.photos.length === 0}
              title={listing.photos.length === 0 ? "請先上傳至少一張照片" : ""}
              className="rounded-lg bg-[#10B981] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[#059669] disabled:opacity-40"
            >
              發布上架
            </button>
          )}
          {listing.status === "active" && (
            <button
              type="button"
              onClick={onBrowse}
              className="bg-primary-600 hover:bg-primary-500 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition"
            >
              找租客
            </button>
          )}
          {listing.status === "paused" && (
            <button
              type="button"
              onClick={() => changeStatus.mutate("active")}
              className="rounded-lg bg-[#10B981] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[#059669]"
            >
              重新上架
            </button>
          )}

          <button
            type="button"
            onClick={onEdit}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-700 transition hover:bg-gray-50"
          >
            編輯
          </button>

          <OverflowMenu>
            {listing.status === "active" && (
              <>
                <MenuItem onClick={() => changeStatus.mutate("paused")}>暫停曝光</MenuItem>
                <MenuItem onClick={() => changeStatus.mutate("rented")}>標記已出租</MenuItem>
              </>
            )}
            <MenuItem
              danger
              onClick={() => {
                if (confirm("確定刪除這筆房源？")) deleteListing.mutate();
              }}
            >
              刪除
            </MenuItem>
          </OverflowMenu>
        </div>
      </div>
    </div>
  );
}

function OverflowMenu({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-lg border border-gray-200 px-2 py-1.5 text-gray-700 transition hover:bg-gray-50"
        aria-label="更多動作"
      >
        <MoreHorizontal size={16} strokeWidth={1.5} />
      </button>
      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-10"
            aria-label="關閉選單"
            onClick={() => setOpen(false)}
          />
          <div className="absolute top-9 right-0 z-20 min-w-[9rem] rounded-xl border border-gray-200 bg-white py-1 shadow-md">
            {children}
          </div>
        </>
      )}
    </div>
  );
}

function MenuItem({
  onClick,
  danger,
  children,
}: {
  onClick: () => void;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full px-4 py-2 text-left text-sm transition hover:bg-gray-50 ${
        danger ? "text-red-600" : "text-gray-700"
      }`}
    >
      {children}
    </button>
  );
}
