"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { ROOM_TYPE_LABELS } from "@/types";
import type { Listing, MatchedTenantProfileCard, MutualMatch } from "@/types";

type Tab = "listings" | "browse" | "incoming" | "outgoing" | "matched";

export default function LandlordDashboard() {
  const [tab, setTab] = useState<Tab>("listings");
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);

  return (
    <div className="min-h-screen">
      <Header />
      <div className="mx-auto max-w-4xl px-4 py-6">
        <nav className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-zinc-200 bg-white p-1">
          {(
            [
              ["listings", "我的房源"],
              ["browse", "找租客"],
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

        {tab === "listings" && (
          <ListingsTab onSelectListing={(id) => { setSelectedListingId(id); setTab("browse"); }} />
        )}
        {tab === "browse" && (
          <BrowseTab selectedListingId={selectedListingId} onSelectListing={setSelectedListingId} />
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

// ---- Listings Tab ----

function ListingsTab({ onSelectListing }: { onSelectListing: (id: string) => void }) {
  const qc = useQueryClient();
  const { data: listings = [], isLoading } = useQuery<Listing[]>({
    queryKey: ["listings"],
    queryFn: () => api.get("/listings").then((r) => r.data),
  });
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  if (isLoading) return <Loading />;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold text-lg">我的房源</h2>
        <button
          type="button"
          onClick={() => { setEditingId(null); setShowForm(true); }}
          className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm text-white hover:bg-zinc-700"
        >
          + 新增房源
        </button>
      </div>
      {listings.length === 0 && <EmptyState message="尚無房源。請新增第一筆房源。" />}
      <div className="space-y-3">
        {listings.map((l) => (
          <ListingCard
            key={l.id}
            listing={l}
            onEdit={() => { setEditingId(l.id); setShowForm(true); }}
            onBrowse={() => onSelectListing(l.id)}
            onChanged={() => qc.invalidateQueries({ queryKey: ["listings"] })}
          />
        ))}
      </div>
      {showForm && (
        <ListingFormModal
          editingId={editingId}
          onClose={() => { setShowForm(false); setEditingId(null); }}
          onSaved={() => { qc.invalidateQueries({ queryKey: ["listings"] }); setShowForm(false); setEditingId(null); }}
        />
      )}
    </div>
  );
}

const STATUS_LABELS: Record<string, string> = {
  draft: "草稿",
  active: "上架中",
  paused: "已暫停",
  rented: "已出租",
};

function ListingCard({
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
  const [showPhotoMgr, setShowPhotoMgr] = useState(false);

  const changeStatus = useMutation({
    mutationFn: (status: string) => api.patch(`/listings/${listing.id}/status`, { status }),
    onSuccess: () => { onChanged(); qc.invalidateQueries({ queryKey: ["listings"] }); },
  });
  const deleteListing = useMutation({
    mutationFn: () => api.delete(`/listings/${listing.id}`),
    onSuccess: onChanged,
  });

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">${listing.rent.toLocaleString()}</span>
            <span className="text-sm text-zinc-500">{ROOM_TYPE_LABELS[listing.room_type] ?? listing.room_type} {listing.area_ping}坪</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              listing.status === "active" ? "bg-green-100 text-green-700"
              : listing.status === "draft" ? "bg-yellow-100 text-yellow-700"
              : "bg-zinc-100 text-zinc-500"
            }`}>
              {STATUS_LABELS[listing.status] ?? listing.status}
            </span>
          </div>
          <p className="mt-1 text-xs text-zinc-400">
            可入住：{new Date(listing.available_from).toLocaleDateString("zh-TW")} ／ {listing.photos.length} 張照片
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {listing.status === "active" && (
            <button type="button" onClick={onBrowse} className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700">
              找租客
            </button>
          )}
          <button type="button" onClick={() => setShowPhotoMgr(true)} className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs hover:bg-zinc-50">
            照片管理
          </button>
          <button type="button" onClick={onEdit} className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs hover:bg-zinc-50">
            編輯
          </button>
          {listing.status === "draft" && (
            <button
              type="button"
              onClick={() => changeStatus.mutate("active")}
              disabled={listing.photos.length === 0}
              title={listing.photos.length === 0 ? "請先上傳至少一張照片" : ""}
              className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-40"
            >
              發布上架
            </button>
          )}
          {listing.status === "active" && (
            <>
              <button type="button" onClick={() => changeStatus.mutate("paused")} className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs hover:bg-zinc-50">
                暫停
              </button>
              <button type="button" onClick={() => changeStatus.mutate("rented")} className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs hover:bg-zinc-50">
                已出租
              </button>
            </>
          )}
          {listing.status === "paused" && (
            <button type="button" onClick={() => changeStatus.mutate("active")} className="rounded-lg bg-green-600 px-3 py-1.5 text-xs text-white hover:bg-green-700">
              重新上架
            </button>
          )}
          <button
            type="button"
            onClick={() => { if (confirm("確定刪除這筆房源？")) deleteListing.mutate(); }}
            className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
          >
            刪除
          </button>
        </div>
      </div>
      {showPhotoMgr && (
        <PhotoManager listingId={listing.id} onClose={() => setShowPhotoMgr(false)} onChanged={onChanged} />
      )}
    </div>
  );
}

// ---- Photo Manager ----

type PhotoRecord = { id: string; public_url: string; position: number };

function PhotoManager({ listingId, onClose, onChanged }: {
  listingId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: listing } = useQuery({
    queryKey: ["listing-detail", listingId],
    queryFn: () => api.get(`/listings/${listingId}`).then((r) => r.data as { photo_list: PhotoRecord[] }),
  });

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("photo", file);
      await api.post(`/listings/${listingId}/photos`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      qc.invalidateQueries({ queryKey: ["listing-detail", listingId] });
      onChanged();
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const deletePhoto = useMutation({
    mutationFn: (photoId: string) => api.delete(`/listings/${listingId}/photos/${photoId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["listing-detail", listingId] }); onChanged(); },
  });

  const photos: PhotoRecord[] = listing?.photo_list ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-2xl bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold">照片管理（最多 6 張）</h3>
          <button type="button" onClick={onClose} className="text-zinc-400 hover:text-zinc-700">✕</button>
        </div>
        <div className="mb-4 grid grid-cols-3 gap-2">
          {photos.map((p) => (
            <div key={p.id} className="relative aspect-square overflow-hidden rounded-lg bg-zinc-100">
              <Image src={p.public_url} alt="" fill className="object-cover" sizes="120px" />
              <button
                type="button"
                onClick={() => deletePhoto.mutate(p.id)}
                className="absolute right-1 top-1 rounded-full bg-red-600 p-0.5 text-xs leading-none text-white"
              >
                ✕
              </button>
            </div>
          ))}
          {photos.length < 6 && (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex aspect-square items-center justify-center rounded-lg border-2 border-dashed border-zinc-300 text-zinc-400 hover:border-zinc-400 hover:text-zinc-500 disabled:opacity-40"
            >
              {uploading ? "上傳中…" : "+ 新增"}
            </button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={upload} />
        <p className="text-xs text-zinc-400">接受 JPEG / PNG / WebP，每張最大 5MB。</p>
      </div>
    </div>
  );
}

// ---- Browse Tab ----

function BrowseTab({ selectedListingId, onSelectListing }: {
  selectedListingId: string | null;
  onSelectListing: (id: string) => void;
}) {
  const { data: listings = [] } = useQuery<Listing[]>({
    queryKey: ["listings"],
    queryFn: () => api.get("/listings").then((r) => r.data),
  });

  const activeListings = listings.filter((l) => l.status === "active");
  const currentId = activeListings.find((l) => l.id === selectedListingId)?.id ?? activeListings[0]?.id ?? null;

  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{ items: MatchedTenantProfileCard[] }>({
    queryKey: ["profiles-browse", currentId],
    queryFn: () => api.get(`/listings/${currentId}/tenant-profiles?limit=20`).then((r) => r.data),
    enabled: !!currentId,
  });

  const expressInterest = useMutation({
    mutationFn: (profileId: string) =>
      api.post(`/listings/${currentId}/tenant-profiles/${profileId}/interest`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profiles-browse", currentId] }),
  });

  if (activeListings.length === 0) {
    return <EmptyState message="請先將房源狀態設為「上架中」，才能瀏覽符合條件的租客。" />;
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <label htmlFor="listing-select" className="text-sm font-medium text-zinc-700">使用房源</label>
        <select
          id="listing-select"
          value={currentId ?? ""}
          onChange={(e) => onSelectListing(e.target.value)}
          className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm"
        >
          {activeListings.map((l) => (
            <option key={l.id} value={l.id}>
              ${l.rent.toLocaleString()} {ROOM_TYPE_LABELS[l.room_type] ?? l.room_type}
            </option>
          ))}
        </select>
      </div>
      {isLoading && <Loading />}
      {!isLoading && data?.items.length === 0 && (
        <EmptyState message="目前沒有符合條件的租客需求卡，請稍後再查看。" />
      )}
      <div className="space-y-3">
        {data?.items.map((profile) => (
          <TenantProfileCard key={profile.id} profile={profile} onInterest={() => expressInterest.mutate(profile.id)} />
        ))}
      </div>
    </div>
  );
}

function TenantProfileCard({ profile, onInterest }: { profile: MatchedTenantProfileCard; onInterest: () => void }) {
  const tags = [
    profile.has_pets && "有寵物",
    profile.needs_subsidy && "需租補",
    profile.needs_tax_receipt && "需收據",
    profile.needs_parking && "需車位",
    profile.smoking && "抽菸",
  ].filter(Boolean) as string[];

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="font-semibold">{profile.name}</span>
            <span className="text-sm text-zinc-500">
              預算 ${profile.budget_min.toLocaleString()}–${profile.budget_max.toLocaleString()}
            </span>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            {profile.preferred_room_types.map((t) => ROOM_TYPE_LABELS[t] ?? t).join("、")} ／ 可入住：{new Date(profile.available_from).toLocaleDateString("zh-TW")}
          </p>
          {profile.occupation && <p className="mt-0.5 text-xs text-zinc-400">職業：{profile.occupation}</p>}
          {tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {tags.map((tag) => (
                <span key={tag} className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">{tag}</span>
              ))}
            </div>
          )}
        </div>
        <div className="flex-shrink-0">
          {profile.interest_sent ? (
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
  const { data: listings = [] } = useQuery<Listing[]>({
    queryKey: ["listings"],
    queryFn: () => api.get("/listings").then((r) => r.data),
  });
  const qc = useQueryClient();
  const [expandedListing, setExpandedListing] = useState<string | null>(null);

  return (
    <div>
      <h2 className="mb-4 font-semibold text-lg">對我房源有興趣的租客</h2>
      {listings.map((listing) => (
        <ListingIncoming
          key={listing.id}
          listing={listing}
          expanded={expandedListing === listing.id}
          onToggle={() => setExpandedListing(expandedListing === listing.id ? null : listing.id)}
          onMatched={() => qc.invalidateQueries({ queryKey: ["matched"] })}
        />
      ))}
      {listings.length === 0 && <EmptyState message="尚無房源。" />}
    </div>
  );
}

function ListingIncoming({ listing, expanded, onToggle, onMatched }: {
  listing: Listing;
  expanded: boolean;
  onToggle: () => void;
  onMatched: () => void;
}) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{ items: MatchedTenantProfileCard[] }>({
    queryKey: ["incoming-listing", listing.id],
    queryFn: () => api.get(`/listings/${listing.id}/tenant-profiles?limit=50`).then((r) => r.data),
    enabled: expanded,
  });

  const expressInterest = useMutation({
    mutationFn: (profileId: string) =>
      api.post(`/listings/${listing.id}/tenant-profiles/${profileId}/interest`),
    onSuccess: (res) => {
      if (res.data.status === "matched") onMatched();
      qc.invalidateQueries({ queryKey: ["incoming-listing", listing.id] });
    },
  });

  return (
    <div className="mb-3 rounded-xl border border-zinc-200 bg-white">
      <button type="button" onClick={onToggle} className="flex w-full items-center justify-between px-4 py-3 text-left">
        <span className="font-medium">
          ${listing.rent.toLocaleString()} {ROOM_TYPE_LABELS[listing.room_type] ?? listing.room_type}
        </span>
        <span className="text-zinc-400">{expanded ? "▲" : "▼"}</span>
      </button>
      {expanded && (
        <div className="border-t border-zinc-100 px-4 py-3">
          {isLoading && <Loading />}
          {!isLoading && data?.items.length === 0 && <p className="text-sm text-zinc-400">目前無 incoming 興趣</p>}
          <div className="space-y-2">
            {data?.items
              .filter((p) => !p.interest_sent)
              .map((profile) => (
                <div key={profile.id} className="flex items-center justify-between rounded-lg border border-zinc-100 p-3">
                  <div className="text-sm">
                    <span className="font-medium">{profile.name}</span>
                    <span className="ml-2 text-zinc-500">
                      預算 ${profile.budget_min.toLocaleString()}–${profile.budget_max.toLocaleString()}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => expressInterest.mutate(profile.id)}
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

type OutgoingItem = { tenant_profile_id: string; profile_name: string; budget_min: number; budget_max: number };

function OutgoingTab() {
  const { data, isLoading } = useQuery<{ items: OutgoingItem[] }>({
    queryKey: ["outgoing"],
    queryFn: () => api.get("/matches/outgoing?limit=50").then((r) => r.data),
  });
  if (isLoading) return <Loading />;
  return (
    <div>
      <h2 className="mb-4 font-semibold text-lg">我送出的興趣（等待租客回應）</h2>
      {(data?.items ?? []).length === 0 && <EmptyState message="尚未送出任何興趣。" />}
      <div className="space-y-2">
        {(data?.items ?? []).map((i) => (
          <div key={i.tenant_profile_id} className="rounded-xl border border-zinc-200 bg-white p-4 text-sm">
            <span className="font-medium">{i.profile_name}</span>
            <span className="ml-2 text-zinc-500">預算 ${i.budget_min.toLocaleString()}–${i.budget_max.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Matched Tab ----

type MatchItem = { match_id: string; tenant_profile_id: string; contact_info: string; matched_at: string; profile_name?: string };

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
                {match.profile_name && <span className="ml-2">需求卡：{match.profile_name}</span>}
              </p>
              <div className="mt-3 rounded-lg bg-zinc-50 p-3">
                <p className="mb-1 text-xs text-zinc-400">租客聯絡方式（自填資料，平台不保證真實性）</p>
                <p className="text-sm font-medium">{match.contact_info}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---- Listing Form Modal ----

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

function ListingFormModal({ editingId, onClose, onSaved }: {
  editingId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { data: existing } = useQuery<Listing>({
    queryKey: ["listing-edit", editingId],
    queryFn: () => api.get(`/listings/${editingId}`).then((r) => r.data),
    enabled: !!editingId,
  });

  const [form, setForm] = useState({
    location_id: existing?.location_id ?? "",
    rent: existing?.rent ?? 0,
    room_type: existing?.room_type ?? "",
    area_ping: existing?.area_ping ?? 0,
    available_from: existing?.available_from
      ? new Date(existing.available_from).toISOString().split("T")[0]
      : "",
    min_lease_months: existing?.min_lease_months ?? 6,
    allow_pets: existing?.allow_pets ?? false,
    allow_subsidy: existing?.allow_subsidy ?? false,
    allow_tax_receipt: existing?.allow_tax_receipt ?? false,
    allow_household_registration: existing?.allow_household_registration ?? false,
    allow_cooking: existing?.allow_cooking ?? false,
    has_parking: existing?.has_parking ?? false,
    allow_smoking: existing?.allow_smoking ?? false,
    contact_info: "",
    compliance_confirmed: false,
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId && !form.compliance_confirmed) {
      setError("請勾選合規確認才能建立房源");
      return;
    }
    setLoading(true);
    setError("");
    const payload = {
      ...form,
      rent: Number(form.rent),
      area_ping: Number(form.area_ping),
      min_lease_months: Number(form.min_lease_months),
      // Convert date-only string to RFC3339 for Go time.Time binding
      available_from: form.available_from ? `${form.available_from}T00:00:00Z` : form.available_from,
    };
    try {
      if (editingId) {
        await api.put(`/listings/${editingId}`, payload);
      } else {
        await api.post("/listings", payload);
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
          <h3 className="font-semibold text-lg">{editingId ? "編輯房源" : "新增房源"}</h3>
          <button type="button" onClick={onClose} className="text-zinc-400 hover:text-zinc-700">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="location_id" className="mb-1 block text-sm font-medium text-zinc-700">地區</label>
            <select
              id="location_id"
              required
              value={form.location_id}
              onChange={(e) => setForm((f) => ({ ...f, location_id: e.target.value }))}
              className="input"
            >
              <option value="">請選擇地區</option>
              {LOCATIONS.map((loc) => (
                <option key={loc.id} value={loc.id}>{loc.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="rent" className="mb-1 block text-sm font-medium text-zinc-700">租金（元/月）</label>
              <input id="rent" required type="number" min={1} value={form.rent || ""} onChange={(e) => setForm((f) => ({ ...f, rent: Number(e.target.value) }))} className="input" />
            </div>
            <div>
              <label htmlFor="area_ping" className="mb-1 block text-sm font-medium text-zinc-700">坪數</label>
              <input id="area_ping" required type="number" min={1} step="0.1" value={form.area_ping || ""} onChange={(e) => setForm((f) => ({ ...f, area_ping: Number(e.target.value) }))} className="input" />
            </div>
          </div>

          <div>
            <p className="mb-1 text-sm font-medium text-zinc-700">房型</p>
            <div className="flex gap-2">
              {Object.entries(ROOM_TYPE_LABELS).map(([rt, label]) => (
                <button
                  key={rt}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, room_type: rt }))}
                  className={`rounded-full px-3 py-1 text-sm transition ${
                    form.room_type === rt
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
              <label htmlFor="available_from" className="mb-1 block text-sm font-medium text-zinc-700">可入住日</label>
              <input id="available_from" required type="date" value={form.available_from} onChange={(e) => setForm((f) => ({ ...f, available_from: e.target.value }))} className="input" />
            </div>
            <div>
              <label htmlFor="min_lease_months" className="mb-1 block text-sm font-medium text-zinc-700">最短租期（月）</label>
              <input id="min_lease_months" required type="number" min={1} value={form.min_lease_months || ""} onChange={(e) => setForm((f) => ({ ...f, min_lease_months: Number(e.target.value) }))} className="input" />
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">房源條件</p>
            {([
              ["allow_pets", "接受寵物"],
              ["allow_subsidy", "接受租補"],
              ["allow_tax_receipt", "開立報稅收據"],
              ["allow_household_registration", "可入籍"],
              ["allow_cooking", "可開伙"],
              ["has_parking", "有車位"],
              ["allow_smoking", "可抽菸"],
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

          <div>
            <label htmlFor="contact_info" className="mb-1 block text-sm font-medium text-zinc-700">聯絡方式（媒合成功後才對租客顯示）</label>
            <input
              id="contact_info"
              required={!editingId}
              value={form.contact_info}
              onChange={(e) => setForm((f) => ({ ...f, contact_info: e.target.value }))}
              className="input"
              placeholder="例：Line ID: xxx 或 0912-345-678"
            />
            <p className="mt-1 text-xs text-zinc-400">媒合成功後才會顯示給租客，請填真實聯絡方式</p>
          </div>

          {!editingId && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="mb-2 text-sm font-medium text-amber-800">合規確認</p>
              <p className="mb-3 text-xs text-amber-700">
                建立房源前，請確認此房源不是頂樓加蓋、違建或依法不得出租之空間，且刊登內容不包含性別或其他敏感屬性限制。
              </p>
              <label className="flex cursor-pointer items-start gap-2 text-sm text-amber-800">
                <input
                  type="checkbox"
                  checked={form.compliance_confirmed}
                  onChange={(e) => setForm((f) => ({ ...f, compliance_confirmed: e.target.checked }))}
                  className="mt-0.5 h-4 w-4 rounded border-amber-300 accent-amber-800"
                />
                <span>我確認此房源符合上述合規條件</span>
              </label>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-zinc-900 py-3 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-40"
          >
            {loading ? "儲存中…" : "儲存房源"}
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
