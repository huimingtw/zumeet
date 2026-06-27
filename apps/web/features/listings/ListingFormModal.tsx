"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import Image from "next/image";
import {
  useForm,
  Controller,
  type Control,
  type FieldErrors,
  type UseFormRegister,
} from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, extractFieldErrors } from "@/lib/api";
import { qk } from "@/features/queryKeys";
import { useListingDetail, useListingEdit } from "@/features/listings/useListings";
import { LOCATION_CITY_DISTRICT, LOCATION_GROUPS, ROOM_TYPE_LABELS } from "@/types";
import { Dropdown } from "@/components/ui/Dropdown";
import { CheckboxGroup } from "@/components/ui/CheckboxGroup";

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
  const [uploadProgress, setUploadProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
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
              ? (err as { response?: { data?: { error?: string } } }).response?.data
                  ?.error
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
    mutationFn: (photoId: string) =>
      api.delete(`/listings/${listingId}/photos/${photoId}`),
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
    ? (localOrder
        .map((id) => serverPhotos.find((p) => p.id === id))
        .filter(Boolean) as PhotoRecord[])
    : serverPhotos;

  useEffect(() => {
    if (!localOrder) return;
    const serverIds = serverPhotos.map((p) => p.id).join(",");
    if (serverIds === localOrder.join(",")) setLocalOrder(null); // eslint-disable-line react-hooks/set-state-in-effect
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
    if (order.join(",") === serverPhotos.map((p) => p.id).join(",")) return;
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
            <Image
              src={p.public_url}
              alt=""
              fill
              className="object-cover"
              sizes="120px"
            />
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

type FormValues = {
  city: string;
  district: string;
  address: string;
  name: string;
  rent: number;
  management_fee: number;
  room_type: string;
  area_ping: number;
  num_bedrooms: number;
  num_living_rooms: number;
  num_bathrooms: number;
  num_balconies: number;
  available_from: string;
  min_lease_months: number;
  allow_pets: boolean;
  allow_subsidy: boolean;
  allow_tax_receipt: boolean;
  allow_household_registration: boolean;
  allow_cooking: boolean;
  has_parking: boolean;
  allow_smoking: boolean;
  description: string;
  contact_info: string;
  compliance_confirmed: boolean;
};

function LocationSelector({
  control,
  errors,
  city,
}: {
  control: Control<FormValues>;
  errors: FieldErrors<FormValues>;
  city: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <p className="mb-1 text-sm font-medium text-gray-700">
          縣市<span className="ml-0.5 text-red-500">*</span>
        </p>
        <Controller
          name="city"
          control={control}
          rules={{ required: "請選擇縣市" }}
          render={({ field }) => (
            <Dropdown
              value={field.value}
              placeholder="請選擇縣市"
              options={LOCATION_GROUPS.map((g) => ({
                value: g.cityLabel,
                label: g.cityLabel,
              }))}
              onChange={field.onChange}
            />
          )}
        />
        {errors.city && (
          <p className="mt-1 text-xs text-red-600">{errors.city.message}</p>
        )}
      </div>
      <div>
        <p className="mb-1 text-sm font-medium text-gray-700">
          地區<span className="ml-0.5 text-red-500">*</span>
        </p>
        <Controller
          name="district"
          control={control}
          rules={{ required: "請選擇地區" }}
          render={({ field }) => (
            <Dropdown
              value={field.value}
              placeholder="請選擇地區"
              disabled={!city}
              options={(
                LOCATION_GROUPS.find((g) => g.cityLabel === city)?.districts ?? []
              ).map((d) => ({ value: d.districtLabel, label: d.districtLabel }))}
              onChange={field.onChange}
            />
          )}
        />
        {errors.district && (
          <p className="mt-1 text-xs text-red-600">{errors.district.message}</p>
        )}
      </div>
    </div>
  );
}

function RoomTypeSelector({
  control,
  errors,
}: {
  control: Control<FormValues>;
  errors: FieldErrors<FormValues>;
}) {
  return (
    <div>
      <p className="mb-1 text-sm font-medium text-gray-700">
        房型<span className="ml-0.5 text-red-500">*</span>
      </p>
      <Controller
        name="room_type"
        control={control}
        rules={{ required: "請選擇房型" }}
        render={({ field }) => (
          <div className="flex gap-2">
            {Object.entries(ROOM_TYPE_LABELS).map(([rt, label]) => (
              <button
                key={rt}
                type="button"
                onClick={() => field.onChange(rt)}
                className={`rounded-full px-3 py-1 text-sm font-medium transition ${
                  field.value === rt
                    ? "bg-primary-600 text-white"
                    : "border border-gray-200 text-gray-600 hover:border-gray-400"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      />
      {errors.room_type && (
        <p className="mt-1 text-xs text-red-600">{errors.room_type.message}</p>
      )}
    </div>
  );
}

function LayoutGrid({ register }: { register: UseFormRegister<FormValues> }) {
  return (
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
              {...register(key, { valueAsNumber: true })}
              className="input"
              placeholder={label}
            />
            <p className="mt-1 text-center text-xs text-gray-400">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ComplianceBox({
  register,
  errors,
  editingId,
}: {
  register: UseFormRegister<FormValues>;
  errors: FieldErrors<FormValues>;
  editingId: string | null;
}) {
  if (editingId) return null;
  return (
    <div className="border-warning-200 bg-warning-50 rounded-lg border p-4">
      <p className="text-warning-800 mb-2 text-sm font-medium">合規確認</p>
      <p className="text-warning-700 mb-3 text-xs">
        建立房源前，請確認此房源不是頂樓加蓋、違建或依法不得出租之空間，且刊登內容不包含性別或其他敏感屬性限制。
      </p>
      <label className="text-warning-800 flex cursor-pointer items-start gap-2 text-sm">
        <input
          type="checkbox"
          {...register("compliance_confirmed", {
            validate: (v) => (editingId ? true : v || "請勾選合規確認才能建立房源"),
          })}
          className="border-warning-200 accent-warning-800 mt-0.5 h-4 w-4 rounded"
        />
        <span>我確認此房源符合上述合規條件</span>
      </label>
      {errors.compliance_confirmed && (
        <p className="mt-1 text-xs text-red-600">{errors.compliance_confirmed.message}</p>
      )}
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

  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
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
    },
  });

  const [savedId, setSavedId] = useState<string | null>(null);
  const [formSaved, setFormSaved] = useState(false);
  const [globalError, setGlobalError] = useState("");

  const city = watch("city");
  const roomType = watch("room_type");
  const activeId = editingId ?? savedId;

  // Hydrate form when editing an existing listing
  useEffect(() => {
    if (!existing) return;
    reset({
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
    });
  }, [existing, reset]);

  async function onSubmit(data: FormValues) {
    setGlobalError("");
    const isWholeFloor = data.room_type === "whole_floor";
    const payload = {
      ...data,
      rent: Number(data.rent),
      management_fee: Number(data.management_fee || 0),
      area_ping: Number(data.area_ping),
      min_lease_months: Number(data.min_lease_months),
      num_bedrooms: isWholeFloor ? Number(data.num_bedrooms) : null,
      num_living_rooms: isWholeFloor ? Number(data.num_living_rooms) : null,
      num_bathrooms: isWholeFloor ? Number(data.num_bathrooms) : null,
      num_balconies: isWholeFloor ? Number(data.num_balconies) : null,
      // TODO(tz): sending UTC midnight; backend stores as time.Time (UTC).
      // date_trunc matching is symmetric so no functional bug, but display near
      // midnight could be off by one day. Fix server-side by accepting date-only
      // strings and storing as Taipei midnight (T00:00:00+08:00).
      available_from: data.available_from
        ? `${data.available_from}T00:00:00Z`
        : data.available_from,
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
        for (const [field, msg] of Object.entries(fe)) {
          setError(field as keyof FormValues, { message: msg });
        }
        setGlobalError("請修正欄位錯誤");
      } else if (err && typeof err === "object" && "response" in err) {
        const axiosErr = err as { response?: { data?: { error?: string } } };
        setGlobalError(axiosErr.response?.data?.error ?? "發生錯誤");
      } else {
        setGlobalError("發生錯誤");
      }
    }
  }

  return (
    <Modal
      open
      onClose={activeId ? onSaved : onClose}
      labelledBy="listing-form-title"
      className="p-6"
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 id="listing-form-title" className="text-base font-semibold text-gray-950">
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
          <Button type="button" size="lg" fullWidth onClick={onSaved}>
            關閉
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div>
            <label
              htmlFor="listing-name"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              房源名稱（選填）
            </label>
            <input
              id="listing-name"
              {...register("name")}
              className="input"
              placeholder="例：台北大安捷運套房"
            />
          </div>

          <LocationSelector control={control} errors={errors} city={city} />

          <div>
            <label
              htmlFor="address"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              詳細地址
            </label>
            <input
              id="address"
              {...register("address")}
              className="input"
              placeholder="例：台北市大安區忠孝東路四段 100 號 5 樓"
            />
            <p className="mt-1 text-xs text-gray-400">
              媒合成功後才會顯示給租客。系統將自動定位經緯度。
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label
                htmlFor="rent"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                租金（元/月）<span className="ml-0.5 text-red-500">*</span>
              </label>
              <input
                id="rent"
                type="number"
                min={1}
                {...register("rent", {
                  required: "請填寫租金",
                  min: { value: 1, message: "請填寫租金" },
                  max: { value: 999999, message: "租金不得超過 999,999 元" },
                  valueAsNumber: true,
                })}
                className={`input ${errors.rent ? "border-red-500" : ""}`}
              />
              {errors.rent && (
                <p className="mt-1 text-xs text-red-600">{errors.rent.message}</p>
              )}
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
                {...register("management_fee", {
                  min: { value: 0, message: "管理費需介於 0 ~ 999,999 元" },
                  max: { value: 999999, message: "管理費需介於 0 ~ 999,999 元" },
                  valueAsNumber: true,
                })}
                className={`input ${errors.management_fee ? "border-red-500" : ""}`}
              />
              {errors.management_fee && (
                <p className="mt-1 text-xs text-red-600">
                  {errors.management_fee.message}
                </p>
              )}
            </div>
            <div>
              <label
                htmlFor="area_ping"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                坪數<span className="ml-0.5 text-red-500">*</span>
              </label>
              <input
                id="area_ping"
                type="number"
                min={1}
                step="0.1"
                {...register("area_ping", {
                  required: "請填寫坪數",
                  min: { value: 0.1, message: "請填寫坪數" },
                  max: { value: 999.99, message: "坪數不得超過 999.99" },
                  valueAsNumber: true,
                })}
                className={`input ${errors.area_ping ? "border-red-500" : ""}`}
              />
              {errors.area_ping && (
                <p className="mt-1 text-xs text-red-600">{errors.area_ping.message}</p>
              )}
            </div>
          </div>

          <RoomTypeSelector control={control} errors={errors} />

          {roomType === "whole_floor" && <LayoutGrid register={register} />}

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
                type="date"
                min={new Date().toISOString().split("T")[0]}
                {...register("available_from", { required: "請填寫可入住日" })}
                className={`input ${errors.available_from ? "border-red-500" : ""}`}
              />
              {errors.available_from && (
                <p className="mt-1 text-xs text-red-600">
                  {errors.available_from.message}
                </p>
              )}
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
                type="number"
                min={1}
                {...register("min_lease_months", {
                  required: "請填寫最短租期",
                  min: { value: 1, message: "請填寫最短租期" },
                  valueAsNumber: true,
                })}
                className={`input ${errors.min_lease_months ? "border-red-500" : ""}`}
              />
              {errors.min_lease_months && (
                <p className="mt-1 text-xs text-red-600">
                  {errors.min_lease_months.message}
                </p>
              )}
            </div>
          </div>

          <CheckboxGroup
            label="房源條件"
            register={register}
            items={[
              ["allow_pets", "可養寵物"],
              ["allow_subsidy", "可申請租屋補助"],
              ["allow_tax_receipt", "可報稅"],
              ["allow_household_registration", "可遷入戶籍"],
              ["allow_cooking", "可開伙"],
            ]}
          />

          <div>
            <label
              htmlFor="description"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              房源說明（選填）
            </label>
            <textarea
              id="description"
              rows={4}
              {...register("description")}
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
              {...register("contact_info", { required: "請填寫聯絡方式" })}
              className={`input ${errors.contact_info ? "border-red-500" : ""}`}
              placeholder="例：Line ID: xxx 或 0912-345-678"
            />
            {errors.contact_info ? (
              <p className="mt-1 text-xs text-red-600">{errors.contact_info.message}</p>
            ) : (
              <p className="mt-1 text-xs text-gray-400">
                媒合成功後才會顯示給租客，請填真實聯絡方式
              </p>
            )}
          </div>

          <ComplianceBox register={register} errors={errors} editingId={editingId} />

          {editingId && (
            <>
              <hr className="border-gray-100" />
              <PhotoSection listingId={editingId} onChanged={() => {}} />
            </>
          )}

          {globalError && <p className="text-sm text-red-600">{globalError}</p>}

          <Button type="submit" size="lg" fullWidth disabled={isSubmitting || formSaved}>
            {isSubmitting
              ? "儲存中…"
              : editingId
                ? formSaved
                  ? "已儲存 ✓"
                  : "儲存"
                : "建立房源"}
          </Button>
          {editingId && (
            <Button
              type="button"
              size="lg"
              fullWidth
              variant="secondary"
              onClick={onSaved}
            >
              關閉
            </Button>
          )}
        </form>
      )}
    </Modal>
  );
}
