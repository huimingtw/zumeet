"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { ROOM_TYPE_LABELS } from "@/types";
import type { MatchedListingCard, MutualMatch, TenantProfile } from "@/types";

type Tab = "profiles" | "browse" | "incoming" | "outgoing" | "matched";

export default function TenantDashboard() {
  const [tab, setTab] = useState<Tab>("profiles");
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

  return (
    <div className="min-h-screen">
      <Header />
      <div className="mx-auto max-w-4xl px-4 py-6">
        <nav className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-zinc-200 bg-white p-1">
          {(
            [
              ["profiles", "我的需求卡"],
              ["browse", "找房源"],
              ["incoming", "對我有興趣"],
              ["outgoing", "我送出的興趣"],
              ["matched", "已媒合"],
            ] as [Tab, string][]
          ).map(([t, label]) => (
            <button
              type="button"
              key={t}
              onClick={() => setTab(t)}
              className={`flex-shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition ${
                tab === t ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        {tab === "profiles" && (
          <ProfilesTab onSelectProfile={(id) => { setSelectedProfileId(id); setTab("browse"); }} />
        )}
        {tab === "browse" && (
          <BrowseTab selectedProfileId={selectedProfileId} onSelectProfile={setSelectedProfileId} />
        )}
        {tab === "incoming" && <IncomingTab />}
        {tab === "outgoing" && <OutgoingTab />}
        {tab === "matched" && <MatchedTab />}
      </div>
    </div>
  );
}

function Header() {
  async function logout() {
    await api.post("/auth/logout");
    window.location.href = "/";
  }
  return (
    <header className="border-b border-zinc-200 bg-white px-4 py-3">
      <div className="mx-auto flex max-w-4xl items-center justify-between">
        <span className="font-bold text-lg">Zumeet</span>
        <button type="button" onClick={logout} className="text-sm text-zinc-500 hover:text-zinc-800">
          登出
        </button>
      </div>
    </header>
  );
}

// ---- Profiles Tab ----

function ProfilesTab({ onSelectProfile }: { onSelectProfile: (id: string) => void }) {
  const qc = useQueryClient();
  const { data: profiles = [], isLoading } = useQuery<TenantProfile[]>({
    queryKey: ["tenant-profiles"],
    queryFn: () => api.get("/tenant-profiles").then((r) => r.data),
  });
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  if (isLoading) return <Loading />;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold text-lg">我的找房需求卡</h2>
        {profiles.length < 3 && (
          <button
            type="button"
            onClick={() => { setEditingId(null); setShowForm(true); }}
            className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm text-white hover:bg-zinc-700"
          >
            + 新增需求卡
          </button>
        )}
      </div>
      {profiles.length === 0 && <EmptyState message="尚無需求卡。請新增一張需求卡以開始找房。" />}
      <div className="space-y-3">
        {profiles.map((p) => (
          <ProfileCard
            key={p.id}
            profile={p}
            onEdit={() => { setEditingId(p.id); setShowForm(true); }}
            onBrowse={() => onSelectProfile(p.id)}
            onDeleted={() => qc.invalidateQueries({ queryKey: ["tenant-profiles"] })}
          />
        ))}
      </div>
      {showForm && (
        <ProfileFormModal
          editingId={editingId}
          onClose={() => { setShowForm(false); setEditingId(null); }}
          onSaved={() => { qc.invalidateQueries({ queryKey: ["tenant-profiles"] }); setShowForm(false); setEditingId(null); }}
        />
      )}
    </div>
  );
}

function ProfileCard({ profile, onEdit, onBrowse, onDeleted }: {
  profile: TenantProfile;
  onEdit: () => void;
  onBrowse: () => void;
  onDeleted: () => void;
}) {
  const qc = useQueryClient();
  const toggleStatus = useMutation({
    mutationFn: () => api.patch(`/tenant-profiles/${profile.id}/status`, { is_active: !profile.is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tenant-profiles"] }),
  });
  const deleteProfile = useMutation({
    mutationFn: () => api.delete(`/tenant-profiles/${profile.id}`),
    onSuccess: onDeleted,
  });

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">{profile.name}</h3>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              profile.is_active ? "bg-green-100 text-green-700" : "bg-zinc-100 text-zinc-500"
            }`}>
              {profile.is_active ? "啟用中" : "已停用"}
            </span>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            預算 ${profile.budget_min.toLocaleString()}–${profile.budget_max.toLocaleString()} ／{" "}
            {profile.preferred_room_types.map((t) => ROOM_TYPE_LABELS[t] ?? t).join("、")}
          </p>
        </div>
        <div className="flex flex-shrink-0 gap-2">
          {profile.is_active && (
            <button type="button" onClick={onBrowse} className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700">
              找房源
            </button>
          )}
          <button type="button" onClick={onEdit} className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs hover:bg-zinc-50">
            編輯
          </button>
          <button type="button" onClick={() => toggleStatus.mutate()} className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs hover:bg-zinc-50">
            {profile.is_active ? "停用" : "啟用"}
          </button>
          <button
            type="button"
            onClick={() => { if (confirm("確定刪除這張需求卡？")) deleteProfile.mutate(); }}
            className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
          >
            刪除
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Browse Tab ----

function BrowseTab({ selectedProfileId, onSelectProfile }: {
  selectedProfileId: string | null;
  onSelectProfile: (id: string) => void;
}) {
  const { data: profiles = [] } = useQuery<TenantProfile[]>({
    queryKey: ["tenant-profiles"],
    queryFn: () => api.get("/tenant-profiles").then((r) => r.data),
  });

  const activeProfiles = profiles.filter((p) => p.is_active);
  const currentId = activeProfiles.find((p) => p.id === selectedProfileId)?.id ?? activeProfiles[0]?.id ?? null;

  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{ items: MatchedListingCard[] }>({
    queryKey: ["listings-browse", currentId],
    queryFn: () => api.get(`/tenant-profiles/${currentId}/listings?limit=20`).then((r) => r.data),
    enabled: !!currentId,
  });

  const expressInterest = useMutation({
    mutationFn: (listingId: string) =>
      api.post(`/tenant-profiles/${currentId}/listings/${listingId}/interest`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["listings-browse", currentId] }),
  });

  if (activeProfiles.length === 0) {
    return <EmptyState message="請先啟用至少一張需求卡，才能開始瀏覽房源。" />;
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <label htmlFor="profile-select" className="text-sm font-medium text-zinc-700">使用需求卡</label>
        <select
          id="profile-select"
          value={currentId ?? ""}
          onChange={(e) => onSelectProfile(e.target.value)}
          className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm"
        >
          {activeProfiles.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>
      {isLoading && <Loading />}
      {!isLoading && data?.items.length === 0 && (
        <EmptyState message="目前沒有符合條件的房源，請稍後再查看。" />
      )}
      <div className="space-y-3">
        {data?.items.map((listing) => (
          <ListingCard
            key={listing.id}
            listing={listing}
            onInterest={() => expressInterest.mutate(listing.id)}
          />
        ))}
      </div>
    </div>
  );
}

function ListingCard({ listing, onInterest }: { listing: MatchedListingCard; onInterest: () => void }) {
  const tags = [
    listing.allow_pets && "接受寵物",
    listing.allow_subsidy && "接受租補",
    listing.allow_tax_receipt && "開立收據",
    listing.allow_household_registration && "可入籍",
    listing.allow_cooking && "可開伙",
    listing.has_parking && "有車位",
    listing.allow_smoking && "可抽菸",
  ].filter(Boolean) as string[];

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-lg font-bold">${listing.rent.toLocaleString()}</span>
            <span className="text-sm text-zinc-500">{ROOM_TYPE_LABELS[listing.room_type] ?? listing.room_type}</span>
            <span className="text-sm text-zinc-500">{listing.area_ping} 坪</span>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            可入住：{new Date(listing.available_from).toLocaleDateString("zh-TW")}
          </p>
          {tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {tags.map((tag) => (
                <span key={tag} className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">{tag}</span>
              ))}
            </div>
          )}
        </div>
        <div className="flex-shrink-0">
          {listing.interest_sent ? (
            <span className="rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-500">已送出</span>
          ) : (
            <button type="button" onClick={onInterest} className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700">
              有興趣
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- Incoming Tab ----

function IncomingTab() {
  const { data: profiles = [] } = useQuery<TenantProfile[]>({
    queryKey: ["tenant-profiles"],
    queryFn: () => api.get("/tenant-profiles").then((r) => r.data),
  });
  const qc = useQueryClient();
  const [expandedProfile, setExpandedProfile] = useState<string | null>(null);

  return (
    <div>
      <h2 className="mb-4 font-semibold text-lg">對我有興趣的房源</h2>
      {profiles.map((profile) => (
        <ProfileIncoming
          key={profile.id}
          profile={profile}
          expanded={expandedProfile === profile.id}
          onToggle={() => setExpandedProfile(expandedProfile === profile.id ? null : profile.id)}
          onMatched={() => qc.invalidateQueries({ queryKey: ["matched"] })}
        />
      ))}
      {profiles.length === 0 && <EmptyState message="尚無需求卡。" />}
    </div>
  );
}

function ProfileIncoming({ profile, expanded, onToggle, onMatched }: {
  profile: TenantProfile;
  expanded: boolean;
  onToggle: () => void;
  onMatched: () => void;
}) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{ items: MatchedListingCard[] }>({
    queryKey: ["incoming", profile.id],
    queryFn: () =>
      api.get(`/tenant-profiles/${profile.id}/interests/incoming?limit=50`).then((r) => r.data),
    enabled: expanded,
  });

  const expressInterest = useMutation({
    mutationFn: (listingId: string) =>
      api.post(`/tenant-profiles/${profile.id}/listings/${listingId}/interest`),
    onSuccess: (res) => {
      if (res.data.status === "matched") onMatched();
      qc.invalidateQueries({ queryKey: ["incoming", profile.id] });
    },
  });

  return (
    <div className="mb-3 rounded-xl border border-zinc-200 bg-white">
      <button type="button" onClick={onToggle} className="flex w-full items-center justify-between px-4 py-3 text-left">
        <span className="font-medium">{profile.name}</span>
        <span className="text-zinc-400">{expanded ? "▲" : "▼"}</span>
      </button>
      {expanded && (
        <div className="border-t border-zinc-100 px-4 py-3">
          {isLoading && <Loading />}
          {!isLoading && data?.items.length === 0 && <p className="text-sm text-zinc-400">目前無 incoming 興趣</p>}
          <div className="space-y-2">
            {data?.items.map((listing) => (
              <div key={listing.id} className="flex items-center justify-between rounded-lg border border-zinc-100 p-3">
                <div className="text-sm">
                  <span className="font-medium">${listing.rent.toLocaleString()}</span>
                  <span className="ml-2 text-zinc-500">{ROOM_TYPE_LABELS[listing.room_type] ?? listing.room_type} {listing.area_ping}坪</span>
                </div>
                <button
                  type="button"
                  onClick={() => expressInterest.mutate(listing.id)}
                  className="rounded-lg bg-zinc-900 px-3 py-1 text-xs font-medium text-white hover:bg-zinc-700"
                >
                  有興趣 → 媒合
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Outgoing Tab ----

type OutgoingItem = { listing_id: string; rent: number; room_type: string; area_ping: number; tenant_profile_name: string };

function OutgoingTab() {
  const { data, isLoading } = useQuery<{ items: OutgoingItem[] }>({
    queryKey: ["outgoing"],
    queryFn: () => api.get("/matches/outgoing?limit=50").then((r) => r.data),
  });
  if (isLoading) return <Loading />;
  return (
    <div>
      <h2 className="mb-4 font-semibold text-lg">我送出的興趣（等待回應）</h2>
      {(data?.items ?? []).length === 0 && <EmptyState message="尚未送出任何興趣。" />}
      <div className="space-y-2">
        {(data?.items ?? []).map((i) => (
          <div key={i.listing_id} className="rounded-xl border border-zinc-200 bg-white p-4">
            <div className="flex items-center justify-between text-sm">
              <div>
                <span className="font-medium">${i.rent.toLocaleString()}</span>
                <span className="ml-2 text-zinc-500">{ROOM_TYPE_LABELS[i.room_type] ?? i.room_type} {i.area_ping}坪</span>
              </div>
              <span className="text-xs text-zinc-400">需求卡：{i.tenant_profile_name}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Matched Tab ----

type MatchItem = { match_id: string; listing_id: string; contact_info: string; matched_at: string; rent?: number; room_type?: string; area_ping?: number };

function MatchedTab() {
  const { data, isLoading } = useQuery<{ items: MutualMatch[] }>({
    queryKey: ["matched"],
    queryFn: () => api.get("/matches/mutual?limit=50").then((r) => r.data),
  });
  if (isLoading) return <Loading />;
  return (
    <div>
      <h2 className="mb-4 font-semibold text-lg">已媒合</h2>
      {(data?.items ?? []).length === 0 && <EmptyState message="尚無媒合結果。" />}
      <div className="space-y-3">
        {(data?.items ?? []).map((m) => {
          const match = m as unknown as MatchItem;
          return (
            <div key={match.match_id} className="rounded-xl border border-zinc-200 bg-white p-4">
              <p className="mb-2 text-sm text-zinc-500">
                媒合時間：{new Date(match.matched_at).toLocaleDateString("zh-TW")}
              </p>
              {match.rent && (
                <p className="text-sm font-medium">
                  ${match.rent.toLocaleString()} / {ROOM_TYPE_LABELS[match.room_type ?? ""] ?? match.room_type} {match.area_ping}坪
                </p>
              )}
              <div className="mt-3 rounded-lg bg-zinc-50 p-3">
                <p className="mb-1 text-xs text-zinc-400">房東聯絡方式（自填資料，平台不保證真實性）</p>
                <p className="text-sm font-medium">{match.contact_info}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---- Profile Form Modal ----

const LOCATIONS = [
  { id: "taipei-daan", label: "台北・大安" },
  { id: "taipei-zhongzheng", label: "台北・中正" },
  { id: "taipei-zhongshan", label: "台北・中山" },
  { id: "taipei-xinyi", label: "台北・信義" },
  { id: "taipei-songshan", label: "台北・松山" },
  { id: "taipei-shilin", label: "台北・士林" },
  { id: "taipei-neihu", label: "台北・內湖" },
  { id: "taipei-wenshan", label: "台北・文山" },
  { id: "taipei-wanhua", label: "台北・萬華" },
  { id: "taipei-datong", label: "台北・大同" },
  { id: "taipei-beitou", label: "台北・北投" },
  { id: "taipei-nangang", label: "台北・南港" },
  { id: "newtaipei-banqiao", label: "新北・板橋" },
  { id: "newtaipei-zhonghe", label: "新北・中和" },
  { id: "newtaipei-yonghe", label: "新北・永和" },
  { id: "newtaipei-xindian", label: "新北・新店" },
  { id: "newtaipei-sanchong", label: "新北・三重" },
  { id: "newtaipei-xinzhuang", label: "新北・新莊" },
];

function ProfileFormModal({ editingId, onClose, onSaved }: {
  editingId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { data: existing } = useQuery<TenantProfile>({
    queryKey: ["tenant-profile", editingId],
    queryFn: () => api.get(`/tenant-profiles/${editingId}`).then((r) => r.data),
    enabled: !!editingId,
  });

  const [form, setForm] = useState({
    name: existing?.name ?? "",
    budget_min: existing?.budget_min ?? 0,
    budget_max: existing?.budget_max ?? 0,
    locations: existing?.locations ?? [] as string[],
    preferred_room_types: existing?.preferred_room_types ?? [] as string[],
    available_from: existing?.available_from
      ? new Date(existing.available_from).toISOString().split("T")[0]
      : "",
    min_lease_months: existing?.min_lease_months ?? 6,
    min_area_ping: existing?.min_area_ping ? String(existing.min_area_ping) : "",
    has_pets: existing?.has_pets ?? false,
    pet_description: existing?.pet_description ?? "",
    needs_subsidy: existing?.needs_subsidy ?? false,
    needs_tax_receipt: existing?.needs_tax_receipt ?? false,
    needs_household_registration: existing?.needs_household_registration ?? false,
    needs_cooking: existing?.needs_cooking ?? false,
    needs_parking: existing?.needs_parking ?? false,
    smoking: existing?.smoking ?? false,
    occupation: existing?.occupation ?? "",
    contact_info: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function toggleLoc(id: string) {
    setForm((f) => ({
      ...f,
      locations: f.locations.includes(id) ? f.locations.filter((l) => l !== id) : [...f.locations, id],
    }));
  }

  function toggleRoomType(rt: string) {
    setForm((f) => ({
      ...f,
      preferred_room_types: f.preferred_room_types.includes(rt)
        ? f.preferred_room_types.filter((t) => t !== rt)
        : [...f.preferred_room_types, rt],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const payload = {
      ...form,
      budget_min: Number(form.budget_min),
      budget_max: Number(form.budget_max),
      min_lease_months: Number(form.min_lease_months),
      min_area_ping: form.min_area_ping ? Number(form.min_area_ping) : null,
      // Convert date-only string to RFC3339 for Go time.Time binding
      available_from: form.available_from ? `${form.available_from}T00:00:00Z` : form.available_from,
    };
    try {
      if (editingId) {
        await api.put(`/tenant-profiles/${editingId}`, payload);
      } else {
        await api.post("/tenant-profiles", payload);
      }
      onSaved();
    } catch (err: unknown) {
      if (err && typeof err === "object" && "response" in err) {
        const axiosErr = err as { response?: { data?: { error?: string } } };
        setError(axiosErr.response?.data?.error ?? "發生錯誤");
      } else {
        setError("發生錯誤");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-6 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold text-lg">{editingId ? "編輯需求卡" : "新增需求卡"}</h3>
          <button type="button" onClick={onClose} className="text-zinc-400 hover:text-zinc-700">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="profile-name" className="mb-1 block text-sm font-medium text-zinc-700">需求名稱（如：台北套房）</label>
            <input id="profile-name" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="input" placeholder="例：台北大安套房" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="budget-min" className="mb-1 block text-sm font-medium text-zinc-700">最低預算（元）</label>
              <input id="budget-min" required type="number" min={0} value={form.budget_min || ""} onChange={(e) => setForm((f) => ({ ...f, budget_min: Number(e.target.value) }))} className="input" />
            </div>
            <div>
              <label htmlFor="budget-max" className="mb-1 block text-sm font-medium text-zinc-700">最高預算（元）</label>
              <input id="budget-max" required type="number" min={0} value={form.budget_max || ""} onChange={(e) => setForm((f) => ({ ...f, budget_max: Number(e.target.value) }))} className="input" />
            </div>
          </div>

          <div>
            <p className="mb-1 text-sm font-medium text-zinc-700">可接受地區（多選）</p>
            <div className="flex flex-wrap gap-1.5">
              {LOCATIONS.map((loc) => (
                <button
                  key={loc.id}
                  type="button"
                  onClick={() => toggleLoc(loc.id)}
                  className={`rounded-full px-3 py-1 text-xs transition ${
                    form.locations.includes(loc.id)
                      ? "bg-zinc-900 text-white"
                      : "border border-zinc-200 text-zinc-600 hover:border-zinc-400"
                  }`}
                >
                  {loc.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1 text-sm font-medium text-zinc-700">偏好房型（多選）</p>
            <div className="flex gap-2">
              {Object.entries(ROOM_TYPE_LABELS).map(([rt, label]) => (
                <button
                  key={rt}
                  type="button"
                  onClick={() => toggleRoomType(rt)}
                  className={`rounded-full px-3 py-1 text-sm transition ${
                    form.preferred_room_types.includes(rt)
                      ? "bg-zinc-900 text-white"
                      : "border border-zinc-200 text-zinc-600 hover:border-zinc-400"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="available-from" className="mb-1 block text-sm font-medium text-zinc-700">最快入住日</label>
              <input id="available-from" required type="date" value={form.available_from} onChange={(e) => setForm((f) => ({ ...f, available_from: e.target.value }))} className="input" />
            </div>
            <div>
              <label htmlFor="min-lease" className="mb-1 block text-sm font-medium text-zinc-700">最短租期（月）</label>
              <input id="min-lease" required type="number" min={1} value={form.min_lease_months || ""} onChange={(e) => setForm((f) => ({ ...f, min_lease_months: Number(e.target.value) }))} className="input" />
            </div>
          </div>

          <div>
            <label htmlFor="min-area" className="mb-1 block text-sm font-medium text-zinc-700">最小坪數（可不填）</label>
            <input id="min-area" type="number" min={1} value={form.min_area_ping} onChange={(e) => setForm((f) => ({ ...f, min_area_ping: e.target.value }))} className="input" placeholder="不限" />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">條件</p>
            {([
              ["has_pets", "我有養寵物"],
              ["needs_subsidy", "需要租補"],
              ["needs_tax_receipt", "需要報稅收據"],
              ["needs_household_registration", "需要入籍"],
              ["needs_cooking", "需要開伙"],
              ["needs_parking", "需要車位"],
              ["smoking", "會抽菸"],
            ] as const).map(([key, label]) => (
              <label key={key} className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.checked }))}
                  className="h-4 w-4 rounded border-zinc-300 accent-zinc-900"
                />
                {label}
              </label>
            ))}
          </div>

          {form.has_pets && (
            <div>
              <label htmlFor="pet-desc" className="mb-1 block text-sm font-medium text-zinc-700">寵物描述（選填）</label>
              <input id="pet-desc" value={form.pet_description} onChange={(e) => setForm((f) => ({ ...f, pet_description: e.target.value }))} className="input" placeholder="例：一隻小型犬，已結紮" />
            </div>
          )}

          <div>
            <label htmlFor="occupation" className="mb-1 block text-sm font-medium text-zinc-700">職業（選填）</label>
            <input id="occupation" value={form.occupation} onChange={(e) => setForm((f) => ({ ...f, occupation: e.target.value }))} className="input" placeholder="例：上班族、學生、自由工作者" />
          </div>

          <div>
            <label htmlFor="contact-info" className="mb-1 block text-sm font-medium text-zinc-700">聯絡方式（媒合成功後才對房東顯示）</label>
            <input
              id="contact-info"
              required={!editingId}
              value={form.contact_info}
              onChange={(e) => setForm((f) => ({ ...f, contact_info: e.target.value }))}
              className="input"
              placeholder="例：Line ID: xxx 或 0912-345-678"
            />
            <p className="mt-1 text-xs text-zinc-400">媒合成功後才會顯示給對方，請填真實聯絡方式</p>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-zinc-900 py-3 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-40"
          >
            {loading ? "儲存中…" : "儲存需求卡"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ---- Shared UI ----

function Loading() {
  return <div className="py-8 text-center text-sm text-zinc-400">載入中…</div>;
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white py-10 text-center text-sm text-zinc-400">
      {message}
    </div>
  );
}
