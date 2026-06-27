"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, extractFieldErrors } from "@/lib/api";
import { qk } from "@/features/queryKeys";
import { useListingDetail, useListingEdit } from "@/features/listings/useListings";
import { LOCATION_CITY_DISTRICT, LOCATION_GROUPS, ROOM_TYPE_LABELS } from "@/types";
import { Dropdown } from "@/components/ui/Dropdown";

type PhotoRecord = { id: string; public_url: string; position: number };

function PhotoSection({
  listingId,
  onChanged,
}: {
  listingId: string;
  onChanged: () => void;
}) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(
    null
  );
  const [uploadError, setUploadError] = useState("");

  const { data: listing } = useListingDetail(listingId);

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const remaining = 10 - photos.length;
    const all = Array.from(e.target.files ?? []);
    const files = all.slice(0, remaining);
    if (files.length === 0) return;
    setUploadProgress({ done: 0, total: files.length });
    setUploadError(
      all.length > remaining
        ? `已選 ${all.length} 張，僅上傳前 ${remaining} 張（上限 10 張）`
        : ""
    );
    let succeeded = 0;
    try {
      for (let i = 0; i < files.length; i++) {
        const fd = new FormData();
        fd.append("photo", files[i]);
        try {
          await api.post(`/listings/${listingId}/photos`, fd);
          succeeded++;
          setUploadProgress({ done: i + 1, total: files.length });
        } catch (err: unknown) {
          const msg =
            err && typeof err === "object" && "response" in err
              ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
              : undefined;
          setUploadError(msg ?? "上傳失敗");
          break;
        }
      }
    } finally {
      if (succeeded > 0) {
        qc.invalidateQueries({ queryKey: qk.listingDetail(listingId) });
        onChanged();
      }
      setUploadProgress(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const deletePhoto = useMutation({
    mutationFn: (photoId: string) => api.delete(`/listings/${listingId}/photos/${photoId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.listingDetail(listingId) });
      onChanged();
    },
  });

  const reorderPhotos = useMutation({
    mutationFn: (photoIds: string[]) =>
      api.patch(`/listings/${listingId}/photos/order`, { photo_ids: photoIds }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.listingDetail(listingId) });
      onChanged();
    },
  });

  const serverPhotos: PhotoRecord[] = listing?.photo_list ?? [];
  const [localOrder, setLocalOrder] = useState<string[] | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const photos: PhotoRecord[] = localOrder
    ? (localOrder.map((id) => serverPhotos.find((p) => p.id === id)).filter(Boolean) as PhotoRecord[])
    : serverPhotos;

  useEffect(() => {
    if (!localOrder) return;
    const serverIds = serverPhotos.map((p) => p.id).join(",");
    if (serverIds === localOrder.join(",")) setLocalOrder(null);
  }, [serverPhotos, localOrder]);

  function onDragStart(id: string) {
    setDragId(id);
  }
  function onDragOver(e: React.DragEvent, overId: string) {
    e.preventDefault();
    if (!dragId || dragId === overId) return;
    const current = (localOrder ?? serverPhotos.map((p) => p.id)).slice();
    const from = current.indexOf(dragId);
    const to = current.indexOf(overId);
    if (from < 0 || to < 0) return;
    current.splice(from, 1);
    current.splice(to, 0, dragId);
    setLocalOrder(current);
  }
  function onDragEnd() {
    const order = localOrder;
    setDragId(null);
    if (!order) return;
    const original = serverPhotos.map((p) => p.id);
    if (order.join(",") === original.join(",")) return;
    reorderPhotos.mutate(order);
  }

  return (
    <div>
      <p className="mb-2 text-sm font-medium text-gray-700">
        照片（最多 10 張，可拖曳調整順序）
      </p>
      <div className="mb-3 grid grid-cols-3 gap-2">
        {photos.map((p) => (
          <div
            key={p.id}
            draggable
            onDragStart={() => onDragStart(p.id)}
            onDragOver={(e) => onDragOver(e, p.id)}
            onDragEnd={onDragEnd}
            className={`relative aspect-square cursor-grab overflow-hidden rounded-lg bg-gray-100 transition ${
              dragId === p.id ? "opacity-50" : ""
            } active:cursor-grabbing`}
          >
            <Image src={p.public_url} alt="" fill className="object-cover" sizes="120px" />
            <button
              type="button"
              onClick={() => deletePhoto.mutate(p.id)}
              className="absolute top-1 right-1 flex items-center justify-center rounded-full bg-black/70 text-xs leading-none text-white"
              style={{ width: "22px", height: "22px" }}
            >
              ✕
            </button>
          </div>
        ))}
        {photos.length < 10 && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={!!uploadProgress}
            className="flex aspect-square items-center justify-center rounded-lg border-2 border-dashed border-gray-300 text-gray-400 transition hover:border-gray-400 hover:text-gray-500 disabled:opacity-40"
          >
            {uploadProgress ? `${uploadProgress.done}/${uploadProgress.total}` : "+ 新增"}
          </button>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={upload}
      />
      <p className="text-xs text-gray-400">接受 JPEG / PNG / WebP，每張最大 5MB。</p>
      {uploadError && <p className="mt-1 text-xs text-red-600">{uploadError}</p>}
    </div>
  );
}

export function ListingFormModal({
  editingId,
  onClose,
  onSaved,
}: {
  editingId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { data: existing } = useListingEdit(editingId ?? "");

  const [form, setForm] = useState({
    city: "",
    district: "",
    address: "",
    name: "",
    rent: 0,
    management_fee: 0,
    room_type: "",
    area_ping: 0,
    num_bedrooms: 0,
    num_living_rooms: 0,
    num_bathrooms: 0,
    num_balconies: 0,
    available_from: new Date().toISOString().split("T")[0],
    min_lease_months: 12,
    allow_pets: false,
    allow_subsidy: false,
    allow_tax_receipt: false,
    allow_household_registration: false,
    allow_cooking: false,
    has_parking: false,
    allow_smoking: false,
    description: "",
    contact_info: "",
    compliance_confirmed: false,
  });

  useEffect(() => {
    if (!existing) return;
    setForm((f) => ({
      ...f,
      city: LOCATION_CITY_DISTRICT[existing.location_id]?.city ?? "",
      district: LOCATION_CITY_DISTRICT[existing.location_id]?.district ?? "",
      address: existing.address ?? "",
      name: existing.name ?? "",
      rent: existing.rent,
      management_fee: existing.management_fee ?? 0,
      room_type: existing.room_type,
      area_ping: existing.area_ping,
      num_bedrooms: existing.num_bedrooms ?? 0,
      num_living_rooms: existing.num_living_rooms ?? 0,
      num_bathrooms: existing.num_bathrooms ?? 0,
      num_balconies: existing.num_balconies ?? 0,
      available_from: existing.available_from
        ? new Date(existing.available_from).toISOString().split("T")[0]
        : "",
      min_lease_months: existing.min_lease_months,
      allow_pets: existing.allow_pets,
      allow_subsidy: existing.allow_subsidy,
      allow_tax_receipt: existing.allow_tax_receipt,
      allow_household_registration: existing.allow_household_registration,
      allow_cooking: existing.allow_cooking,
      has_parking: existing.has_parking,
      allow_smoking: existing.allow_smoking,
      description: existing.description ?? "",
      contact_info: existing.contact_info ?? "",
    }));
  }, [existing]);

  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [formSaved, setFormSaved] = useState(false);

  const activeId = editingId ?? savedId;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.city) { setError("請選擇縣市"); return; }
    if (!form.district) { setError("請選擇地區"); return; }
    if (!form.rent || form.rent <= 0) { setError("請填寫租金"); return; }
    if (form.rent > 999999) { setError("租金不得超過 999,999 元"); return; }
    if (!form.area_ping || form.area_ping <= 0) { setError("請填寫坪數"); return; }
    if (form.area_ping >= 1000) { setError("坪數不得超過 999.99"); return; }
    if (form.management_fee < 0 || form.management_fee > 999999) {
      setError("管理費需介於 0 ~ 999,999 元"); return;
    }
    if (!form.room_type) { setError("請選擇房型"); return; }
    if (form.room_type === "whole_floor") {
      if (form.num_bedrooms <= 0 || form.num_living_rooms <= 0 || form.num_bathrooms <= 0 || form.num_balconies < 0) {
        setError("整層房型請填寫房廳衛陽台數量"); return;
      }
    }
    if (!form.available_from) { setError("請填寫可入住日"); return; }
    if (!form.min_lease_months || form.min_lease_months <= 0) { setError("請填寫最短租期"); return; }
    if (!form.contact_info.trim()) { setError("請填寫聯絡方式"); return; }
    if (!editingId && !form.compliance_confirmed) { setError("請勾選合規確認才能建立房源"); return; }

    setLoading(true);
    setError("");
    const isWholeFloor = form.room_type === "whole_floor";
    const payload = {
      ...form,
      rent: Number(form.rent),
      management_fee: Number(form.management_fee || 0),
      area_ping: Number(form.area_ping),
      min_lease_months: Number(form.min_lease_months),
      num_bedrooms: isWholeFloor ? Number(form.num_bedrooms) : null,
      num_living_rooms: isWholeFloor ? Number(form.num_living_rooms) : null,
      num_bathrooms: isWholeFloor ? Number(form.num_bathrooms) : null,
      num_balconies: isWholeFloor ? Number(form.num_balconies) : null,
      available_from: form.available_from ? `${form.available_from}T00:00:00Z` : form.available_from,
    };
    try {
      if (editingId) {
        await api.put(`/listings/${editingId}`, payload);
        setFormSaved(true);
        setTimeout(() => setFormSaved(false), 2000);
      } else {
        const res = await api.post("/listings", payload);
        setSavedId((res.data as { id: string }).id);
      }
    } catch (err: unknown) {
      const fe = extractFieldErrors(err);
      if (Object.keys(fe).length > 0) {
        setFieldErrors(fe);
        setError("請修正欄位錯誤");
      } else if (err && typeof err === "object" && "response" in err) {
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
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="關閉"
        onClick={activeId ? onSaved : onClose}
      />
      <div className="no-scrollbar relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-6 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-950">
            {editingId ? "編輯房源" : savedId ? "上傳照片" : "新增房源"}
          </h3>
          <button
            type="button"
            onClick={activeId ? onSaved : onClose}
            className="text-gray-400 hover:text-gray-700"
            aria-label="關閉"
          >
            ✕
          </button>
        </div>

        {savedId ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">房源已建立，可以上傳照片（選填）。</p>
            <PhotoSection listingId={savedId} onChanged={onSaved} />
            <button
              type="button"
              onClick={onSaved}
              className="bg-primary-600 hover:bg-primary-500 w-full rounded-lg py-3 text-sm font-medium text-white transition"
            >
              關閉
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div>
              <label htmlFor="listing-name" className="mb-1 block text-sm font-medium text-gray-700">
                房源名稱（選填）
              </label>
              <input
                id="listing-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="input"
                placeholder="例：台北大安捷運套房"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="mb-1 text-sm font-medium text-gray-700">
                  縣市<span className="ml-0.5 text-red-500">*</span>
                </p>
                <Dropdown
                  value={form.city}
                  placeholder="請選擇縣市"
                  options={LOCATION_GROUPS.map((g) => ({ value: g.cityLabel, label: g.cityLabel }))}
                  onChange={(v) => setForm((f) => ({ ...f, city: v, district: "" }))}
                />
              </div>
              <div>
                <p className="mb-1 text-sm font-medium text-gray-700">
                  地區<span className="ml-0.5 text-red-500">*</span>
                </p>
                <Dropdown
                  value={form.district}
                  placeholder="請選擇地區"
                  disabled={!form.city}
                  options={(
                    LOCATION_GROUPS.find((g) => g.cityLabel === form.city)?.districts ?? []
                  ).map((d) => ({ value: d.districtLabel, label: d.districtLabel }))}
                  onChange={(v) => setForm((f) => ({ ...f, district: v }))}
                />
              </div>
            </div>

            <div>
              <label htmlFor="address" className="mb-1 block text-sm font-medium text-gray-700">
                詳細地址
              </label>
              <input
                id="address"
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                className="input"
                placeholder="例：台北市大安區忠孝東路四段 100 號 5 樓"
              />
              <p className="mt-1 text-xs text-gray-400">
                媒合成功後才會顯示給租客。系統將自動定位經緯度。
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label htmlFor="rent" className="mb-1 block text-sm font-medium text-gray-700">
                  租金（元/月）<span className="ml-0.5 text-red-500">*</span>
                </label>
                <input
                  id="rent"
                  required
                  type="number"
                  min={1}
                  value={form.rent || ""}
                  onChange={(e) => setForm((f) => ({ ...f, rent: Number(e.target.value) }))}
                  className="input"
                />
              </div>
              <div>
                <label
                  htmlFor="management_fee"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  管理費（元/月）
                </label>
                <input
                  id="management_fee"
                  type="number"
                  min={0}
                  value={form.management_fee || ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, management_fee: Number(e.target.value) }))
                  }
                  className="input"
                />
              </div>
              <div>
                <label htmlFor="area_ping" className="mb-1 block text-sm font-medium text-gray-700">
                  坪數<span className="ml-0.5 text-red-500">*</span>
                </label>
                <input
                  id="area_ping"
                  required
                  type="number"
                  min={1}
                  step="0.1"
                  value={form.area_ping || ""}
                  onChange={(e) => setForm((f) => ({ ...f, area_ping: Number(e.target.value) }))}
                  className="input"
                />
              </div>
            </div>

            <div>
              <p className="mb-1 text-sm font-medium text-gray-700">
                房型<span className="ml-0.5 text-red-500">*</span>
              </p>
              <div className="flex gap-2">
                {Object.entries(ROOM_TYPE_LABELS).map(([rt, label]) => (
                  <button
                    key={rt}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, room_type: rt }))}
                    className={`rounded-full px-3 py-1 text-sm font-medium transition ${
                      form.room_type === rt
                        ? "bg-primary-600 text-white"
                        : "border border-gray-200 text-gray-600 hover:border-gray-400"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {form.room_type === "whole_floor" && (
              <div>
                <p className="mb-1 text-sm font-medium text-gray-700">格局</p>
                <div className="grid grid-cols-4 gap-2">
                  {(
                    [
                      ["num_bedrooms", "房"],
                      ["num_living_rooms", "廳"],
                      ["num_bathrooms", "衛"],
                      ["num_balconies", "陽台"],
                    ] as const
                  ).map(([key, label]) => (
                    <div key={key}>
                      <input
                        type="number"
                        min={0}
                        value={form[key] || ""}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, [key]: Number(e.target.value) }))
                        }
                        className="input"
                        placeholder={label}
                      />
                      <p className="mt-1 text-center text-xs text-gray-400">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="available_from"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  可入住日<span className="ml-0.5 text-red-500">*</span>
                </label>
                <input
                  id="available_from"
                  required
                  type="date"
                  min={new Date().toISOString().split("T")[0]}
                  value={form.available_from}
                  onChange={(e) => setForm((f) => ({ ...f, available_from: e.target.value }))}
                  className="input"
                />
              </div>
              <div>
                <label
                  htmlFor="min_lease_months"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  最短租期（月）<span className="ml-0.5 text-red-500">*</span>
                </label>
                <input
                  id="min_lease_months"
                  required
                  type="number"
                  min={1}
                  value={form.min_lease_months || ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, min_lease_months: Number(e.target.value) }))
                  }
                  className="input"
                />
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">房源條件</p>
              {(
                [
                  ["allow_pets", "可養寵物"],
                  ["allow_subsidy", "可申請租屋補助"],
                  ["allow_tax_receipt", "可報稅"],
                  ["allow_household_registration", "可遷入戶籍"],
                  ["allow_cooking", "可開伙"],
                ] as const
              ).map(([key, label]) => (
                <label
                  key={key}
                  className="flex cursor-pointer items-center gap-2 text-sm text-gray-700"
                >
                  <input
                    type="checkbox"
                    checked={form[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.checked }))}
                    className="accent-primary-600 h-4 w-4 rounded border-gray-300"
                  />
                  {label}
                </label>
              ))}
            </div>

            <div>
              <label htmlFor="description" className="mb-1 block text-sm font-medium text-gray-700">
                房源說明（選填）
              </label>
              <textarea
                id="description"
                rows={4}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="input resize-none"
                placeholder="描述房源特色、生活環境、附近交通或其他租客需要知道的資訊"
              />
            </div>

            <div>
              <label
                htmlFor="contact_info"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                聯絡方式（媒合成功後才對租客顯示）
                <span className="ml-0.5 text-red-500">*</span>
              </label>
              <input
                id="contact_info"
                required
                value={form.contact_info}
                onChange={(e) => {
                  setForm((f) => ({ ...f, contact_info: e.target.value }));
                  if (fieldErrors.contact_info)
                    setFieldErrors((fe) => ({ ...fe, contact_info: "" }));
                }}
                className={`input ${fieldErrors.contact_info ? "border-red-500" : ""}`}
                placeholder="例：Line ID: xxx 或 0912-345-678"
              />
              {fieldErrors.contact_info ? (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.contact_info}</p>
              ) : (
                <p className="mt-1 text-xs text-gray-400">
                  媒合成功後才會顯示給租客，請填真實聯絡方式
                </p>
              )}
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
                    onChange={(e) =>
                      setForm((f) => ({ ...f, compliance_confirmed: e.target.checked }))
                    }
                    className="mt-0.5 h-4 w-4 rounded border-amber-300 accent-amber-800"
                  />
                  <span>我確認此房源符合上述合規條件</span>
                </label>
              </div>
            )}

            {editingId && (
              <>
                <hr className="border-gray-100" />
                <PhotoSection listingId={editingId} onChanged={() => {}} />
              </>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={loading || formSaved}
              className="bg-primary-600 hover:bg-primary-500 w-full rounded-lg py-3 text-sm font-medium text-white transition disabled:opacity-40"
            >
              {loading ? "儲存中…" : editingId ? (formSaved ? "已儲存 ✓" : "儲存") : "建立房源"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={onSaved}
                className="w-full rounded-lg border border-gray-200 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                關閉
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
