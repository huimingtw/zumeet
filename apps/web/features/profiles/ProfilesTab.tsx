"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ClipboardList } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonMyProfileCard as SkeletonProfileCard } from "@/components/ui/Skeletons";
import { qk } from "@/features/queryKeys";
import { useTenantProfiles } from "@/features/profiles/useTenantProfiles";
import { MyProfileCard } from "@/features/profiles/MyProfileCard";
import { ProfileFormModal } from "@/features/profiles/ProfileFormModal";
import type { TenantProfile } from "@/types";

export function ProfilesTab({
  onSelectProfile,
}: {
  onSelectProfile: (id: string) => void;
}) {
  const qc = useQueryClient();
  const { data: profiles = [], isLoading } = useTenantProfiles();
  const [editingProfile, setEditingProfile] = useState<TenantProfile | null>(null);
  const [showForm, setShowForm] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[0, 1].map((i) => (
          <SkeletonProfileCard key={i} />
        ))}
      </div>
    );
  }

  if (!isLoading && profiles.length === 0) {
    return (
      <>
        <EmptyState
          icon={<ClipboardList size={32} strokeWidth={1.5} className="text-gray-300" />}
          title="尚無需求卡"
          description="建立一張需求卡，系統就能為你媒合符合條件的房源"
          action={{
            label: "新增第一張需求卡",
            onClick: () => {
              setEditingProfile(null);
              setShowForm(true);
            },
          }}
        />
        {showForm && (
          <ProfileFormModal
            editingProfile={null}
            onClose={() => setShowForm(false)}
            onSaved={() => {
              qc.invalidateQueries({ queryKey: qk.tenantProfiles() });
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
        <h2 className="text-base font-semibold text-gray-950">我的找房需求卡</h2>
        <button
          type="button"
          onClick={() => {
            setEditingProfile(null);
            setShowForm(true);
          }}
          disabled={profiles.length >= 3}
          title={profiles.length >= 3 ? "最多可建立 3 張需求卡" : undefined}
          className="bg-primary-600 hover:bg-primary-500 rounded-lg px-3 py-1.5 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-40"
        >
          {profiles.length >= 3 ? "已達上限 (3/3)" : "+ 新增需求卡"}
        </button>
      </div>
      <div className="space-y-3">
        {profiles.map((p) => (
          <MyProfileCard
            key={p.id}
            profile={p}
            onEdit={() => {
              setEditingProfile(p);
              setShowForm(true);
            }}
            onBrowse={() => onSelectProfile(p.id)}
            onDeleted={() => qc.invalidateQueries({ queryKey: qk.tenantProfiles() })}
          />
        ))}
      </div>
      {showForm && (
        <ProfileFormModal
          editingProfile={editingProfile}
          onClose={() => {
            setShowForm(false);
            setEditingProfile(null);
          }}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: qk.tenantProfiles() });
            setShowForm(false);
            setEditingProfile(null);
          }}
        />
      )}
    </div>
  );
}
