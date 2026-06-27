"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MoreVertical } from "lucide-react";
import { useConfirm } from "@/components/ConfirmDialog";
import { Badge } from "@/components/ui/Badge";
import { api } from "@/lib/api";
import { qk } from "@/features/queryKeys";
import type { TenantProfile } from "@/types";
import { ROOM_TYPE_LABELS } from "@/types";

export function MyProfileCard({
  profile,
  onEdit,
  onBrowse,
  onDeleted,
}: {
  profile: TenantProfile;
  onEdit: () => void;
  onBrowse: () => void;
  onDeleted: () => void;
}) {
  const qc = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [confirmEl, confirm] = useConfirm();

  useEffect(() => {
    if (!menuOpen) return;
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const toggleStatus = useMutation({
    mutationFn: () =>
      api.patch(`/tenant-profiles/${profile.id}/status`, {
        is_active: !profile.is_active,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.tenantProfiles() }),
  });

  const deleteProfile = useMutation({
    mutationFn: () => api.delete(`/tenant-profiles/${profile.id}`),
    onSuccess: onDeleted,
  });

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between p-4 sm:p-5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-950">{profile.name}</h3>
            <Badge tone={profile.is_active ? "success" : "neutral"}>
              {profile.is_active ? "啟用中" : "已停用"}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            預算 ${profile.budget_min.toLocaleString()}–$
            {profile.budget_max.toLocaleString()} ／{" "}
            {profile.preferred_room_types.map((t) => ROOM_TYPE_LABELS[t] ?? t).join("、")}
          </p>
        </div>

        {profile.is_active && (
          <button
            type="button"
            onClick={onBrowse}
            className="bg-primary-600 hover:bg-primary-500 ml-2 hidden rounded-lg px-3 py-1.5 text-xs font-medium text-white transition sm:block"
          >
            找房源
          </button>
        )}

        <div ref={menuRef} className="relative ml-2 flex-shrink-0">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
            aria-label="更多動作"
          >
            <MoreVertical size={18} strokeWidth={1.5} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 z-30 mt-1 w-32 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onEdit();
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 transition hover:bg-gray-50"
              >
                編輯
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  toggleStatus.mutate();
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 transition hover:bg-gray-50"
              >
                {profile.is_active ? "停用" : "啟用"}
              </button>
              <button
                type="button"
                onClick={async () => {
                  setMenuOpen(false);
                  if (
                    await confirm({
                      message: "確定刪除這張需求卡？",
                      confirmText: "刪除",
                      danger: true,
                    })
                  )
                    deleteProfile.mutate();
                }}
                className="w-full px-4 py-2 text-left text-sm text-red-600 transition hover:bg-red-50"
              >
                刪除
              </button>
            </div>
          )}
        </div>
      </div>

      {profile.is_active && (
        <div className="border-t border-gray-100 px-4 pt-3 pb-4 sm:hidden">
          <button
            type="button"
            onClick={onBrowse}
            className="bg-primary-600 hover:bg-primary-500 w-full rounded-lg py-2.5 text-sm font-medium text-white transition"
          >
            找房源
          </button>
        </div>
      )}
      {confirmEl}
    </div>
  );
}
