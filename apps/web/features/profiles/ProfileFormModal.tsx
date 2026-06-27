"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { LocationPicker } from "@/components/LocationPicker";
import { api, extractFieldErrors } from "@/lib/api";
import type { TenantProfile } from "@/types";
import { LOCATION_CITY_DISTRICT, LOCATION_LABELS, ROOM_TYPE_LABELS } from "@/types";

type FormValues = {
  name: string;
  budget_min: number;
  budget_max: number;
  locations: string[];
  preferred_room_types: string[];
  available_from: string;
  min_lease_months: number;
  min_area_ping: string;
  has_pets: boolean;
  pet_description: string;
  needs_subsidy: boolean;
  needs_tax_receipt: boolean;
  needs_household_registration: boolean;
  needs_cooking: boolean;
  needs_parking: boolean;
  smoking: boolean;
  occupation: string;
  age: string;
  description: string;
  contact_info: string;
};

export function ProfileFormModal({
  editingProfile,
  onClose,
  onSaved,
}: {
  editingProfile: TenantProfile | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      name: editingProfile?.name ?? "",
      budget_min: editingProfile?.budget_min ?? 0,
      budget_max: editingProfile?.budget_max ?? 0,
      locations: editingProfile?.locations ?? [],
      preferred_room_types: editingProfile?.preferred_room_types ?? [],
      available_from: editingProfile?.available_from
        ? new Date(editingProfile.available_from).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0],
      min_lease_months: editingProfile?.min_lease_months ?? 12,
      min_area_ping: editingProfile?.min_area_ping ? String(editingProfile.min_area_ping) : "",
      has_pets: editingProfile?.has_pets ?? false,
      pet_description: editingProfile?.pet_description ?? "",
      needs_subsidy: editingProfile?.needs_subsidy ?? false,
      needs_tax_receipt: editingProfile?.needs_tax_receipt ?? false,
      needs_household_registration: editingProfile?.needs_household_registration ?? false,
      needs_cooking: editingProfile?.needs_cooking ?? false,
      needs_parking: editingProfile?.needs_parking ?? false,
      smoking: editingProfile?.smoking ?? false,
      occupation: editingProfile?.occupation ?? "",
      age: editingProfile?.age ? String(editingProfile.age) : "",
      description: editingProfile?.description ?? "",
      contact_info: editingProfile?.contact_info ?? "",
    },
  });

  const [locPickerOpen, setLocPickerOpen] = useState(false);
  const [globalError, setGlobalError] = useState("");
  const [formSaved, setFormSaved] = useState(false);

  const locations = watch("locations");
  const preferredRoomTypes = watch("preferred_room_types");
  const hasPets = watch("has_pets");
  const budgetMin = watch("budget_min");
  const budgetMax = watch("budget_max");

  function toggleRoomType(rt: string) {
    const current = preferredRoomTypes ?? [];
    setValue(
      "preferred_room_types",
      current.includes(rt) ? current.filter((t) => t !== rt) : [...current, rt],
      { shouldValidate: true }
    );
  }

  async function onSubmit(data: FormValues) {
    setGlobalError("");
    const payload = {
      ...data,
      locations: data.locations.map((id) => LOCATION_CITY_DISTRICT[id]).filter(Boolean),
      budget_min: Number(data.budget_min),
      budget_max: Number(data.budget_max),
      min_lease_months: Number(data.min_lease_months),
      min_area_ping: data.min_area_ping ? Number(data.min_area_ping) : null,
      age: data.age ? Number(data.age) : null,
      available_from: data.available_from
        ? `${data.available_from}T00:00:00Z`
        : data.available_from,
    };
    try {
      if (editingProfile) {
        await api.put(`/tenant-profiles/${editingProfile.id}`, payload);
        setFormSaved(true);
        setTimeout(() => setFormSaved(false), 2000);
      } else {
        await api.post("/tenant-profiles", payload);
      }
      onSaved();
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
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="關閉"
        onClick={onClose}
      />
      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white sm:rounded-2xl">
        <div className="flex flex-shrink-0 items-center justify-between border-b border-gray-100 px-6 py-4">
          <h3 className="text-base font-semibold text-gray-950">
            {editingProfile ? "編輯需求卡" : "新增需求卡"}
          </h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700" aria-label="關閉">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex min-h-0 flex-1 flex-col">
          <div className="no-scrollbar flex-1 space-y-4 overflow-y-auto px-6 py-4">
            <div>
              <label htmlFor="profile-name" className="mb-1 block text-sm font-medium text-gray-700">
                需求名稱（如：台北套房）<span className="ml-0.5 text-red-500">*</span>
              </label>
              <input
                id="profile-name"
                {...register("name", { required: "請填寫需求名稱" })}
                className={`input ${errors.name ? "border-red-500" : ""}`}
                placeholder="例：台北大安套房"
              />
              {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
            </div>

            {/* Budget quick-select chips */}
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  [10000, 15000, "1–1.5 萬"],
                  [15000, 20000, "1.5–2 萬"],
                  [20000, 30000, "2–3 萬"],
                  [30000, 50000, "3–5 萬"],
                  [50000, 100000, "5 萬以上"],
                ] as [number, number, string][]
              ).map(([mn, mx, label]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => { setValue("budget_min", mn); setValue("budget_max", mx); }}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    budgetMin === mn && budgetMax === mx
                      ? "bg-primary-600 text-white"
                      : "border border-gray-200 text-gray-600 hover:border-gray-400"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="budget-min" className="mb-1 block text-sm font-medium text-gray-700">
                  最低預算（元）<span className="ml-0.5 text-red-500">*</span>
                </label>
                <input
                  id="budget-min"
                  type="number"
                  min={0}
                  {...register("budget_min", {
                    required: "請填寫最低預算",
                    min: { value: 1, message: "請填寫最低預算" },
                    valueAsNumber: true,
                  })}
                  className={`input ${errors.budget_min ? "border-red-500" : ""}`}
                />
                {errors.budget_min && (
                  <p className="mt-1 text-xs text-red-600">{errors.budget_min.message}</p>
                )}
              </div>
              <div>
                <label htmlFor="budget-max" className="mb-1 block text-sm font-medium text-gray-700">
                  最高預算（元）<span className="ml-0.5 text-red-500">*</span>
                </label>
                <input
                  id="budget-max"
                  type="number"
                  min={0}
                  {...register("budget_max", {
                    required: "請填寫最高預算",
                    min: { value: 1, message: "請填寫最高預算" },
                    valueAsNumber: true,
                    validate: (v) =>
                      Number(v) >= Number(watch("budget_min")) || "最低預算不能高於最高預算",
                  })}
                  className={`input ${errors.budget_max ? "border-red-500" : ""}`}
                />
                {errors.budget_max && (
                  <p className="mt-1 text-xs text-red-600">{errors.budget_max.message}</p>
                )}
              </div>
            </div>

            <div>
              <p className="mb-1 text-sm font-medium text-gray-700">
                可接受地區（多選）<span className="ml-0.5 text-red-500">*</span>
              </p>
              <Controller
                name="locations"
                control={control}
                rules={{ validate: (v) => v.length > 0 || "請至少選擇一個地區" }}
                render={({ field }) => (
                  <>
                    <button
                      type="button"
                      onClick={() => setLocPickerOpen(true)}
                      className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:border-gray-400 hover:text-gray-800"
                    >
                      {field.value.length > 0 ? `已選 ${field.value.length} 個地區` : "選擇地區 ›"}
                    </button>
                    {field.value.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {field.value.map((id) => (
                          <span
                            key={id}
                            className="flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-0.5 text-xs text-orange-700"
                          >
                            {LOCATION_LABELS[id] ?? id}
                            <button
                              type="button"
                              onClick={() =>
                                field.onChange(field.value.filter((l) => l !== id))
                              }
                              className="ml-0.5 text-orange-400 hover:text-orange-600"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    <LocationPicker
                      open={locPickerOpen}
                      value={field.value}
                      onChange={field.onChange}
                      onClose={() => setLocPickerOpen(false)}
                    />
                  </>
                )}
              />
              {errors.locations && (
                <p className="mt-1 text-xs text-red-600">{errors.locations.message}</p>
              )}
            </div>

            <div>
              <p className="mb-1 text-sm font-medium text-gray-700">
                偏好房型（多選）<span className="ml-0.5 text-red-500">*</span>
              </p>
              <div className="flex gap-2">
                {Object.entries(ROOM_TYPE_LABELS).map(([rt, label]) => (
                  <button
                    key={rt}
                    type="button"
                    onClick={() => toggleRoomType(rt)}
                    className={`rounded-full px-3 py-1 text-sm font-medium transition ${
                      (preferredRoomTypes ?? []).includes(rt)
                        ? "bg-primary-600 text-white"
                        : "border border-gray-200 text-gray-600 hover:border-gray-400"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {errors.preferred_room_types && (
                <p className="mt-1 text-xs text-red-600">{errors.preferred_room_types.message}</p>
              )}
              {/* hidden input to trigger validation */}
              <input
                type="hidden"
                {...register("preferred_room_types", {
                  validate: (v) => v.length > 0 || "請至少選擇一種偏好房型",
                })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="available-from" className="mb-1 block text-sm font-medium text-gray-700">
                  最快入住日<span className="ml-0.5 text-red-500">*</span>
                </label>
                <input
                  id="available-from"
                  type="date"
                  min={new Date().toISOString().split("T")[0]}
                  {...register("available_from", { required: "請填寫最快入住日" })}
                  className={`input ${errors.available_from ? "border-red-500" : ""}`}
                />
                {errors.available_from && (
                  <p className="mt-1 text-xs text-red-600">{errors.available_from.message}</p>
                )}
              </div>
              <div>
                <label htmlFor="min-lease" className="mb-1 block text-sm font-medium text-gray-700">
                  最短租期（月）<span className="ml-0.5 text-red-500">*</span>
                </label>
                <input
                  id="min-lease"
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
                  <p className="mt-1 text-xs text-red-600">{errors.min_lease_months.message}</p>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="min-area" className="mb-1 block text-sm font-medium text-gray-700">
                最小坪數（可不填）
              </label>
              <input
                id="min-area"
                type="number"
                min={1}
                {...register("min_area_ping", {
                  validate: (v) => !v || Number(v) < 1000 || "最大坪數不得超過 999.99",
                })}
                className={`input ${errors.min_area_ping ? "border-red-500" : ""}`}
                placeholder="不限"
              />
              {errors.min_area_ping && (
                <p className="mt-1 text-xs text-red-600">{errors.min_area_ping.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">條件</p>
              {(
                [
                  ["has_pets", "我有養寵物"],
                  ["needs_subsidy", "需要租補"],
                  ["needs_tax_receipt", "需要報稅收據"],
                  ["needs_household_registration", "需要入籍"],
                  ["needs_cooking", "需要開伙"],
                  ["needs_parking", "需要車位"],
                  ["smoking", "會抽菸"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    {...register(key)}
                    className="accent-primary-600 h-4 w-4 rounded border-gray-300"
                  />
                  {label}
                </label>
              ))}
            </div>

            {hasPets && (
              <div>
                <label htmlFor="pet-desc" className="mb-1 block text-sm font-medium text-gray-700">
                  寵物描述（選填）
                </label>
                <input
                  id="pet-desc"
                  {...register("pet_description")}
                  className="input"
                  placeholder="例：一隻小型犬，已結紮"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="occupation" className="mb-1 block text-sm font-medium text-gray-700">
                  職業（選填）
                </label>
                <input
                  id="occupation"
                  {...register("occupation")}
                  className="input"
                  placeholder="例：上班族、學生"
                />
              </div>
              <div>
                <label htmlFor="age" className="mb-1 block text-sm font-medium text-gray-700">
                  年齡（選填）
                </label>
                <input
                  id="age"
                  type="number"
                  min={18}
                  max={120}
                  {...register("age")}
                  className="input"
                  placeholder="例：28"
                />
              </div>
            </div>

            <div>
              <label htmlFor="description" className="mb-1 block text-sm font-medium text-gray-700">
                自我介紹（選填）
              </label>
              <textarea
                id="description"
                rows={4}
                {...register("description")}
                className="input resize-none"
                placeholder="介紹自己的生活習慣、工作狀況或其他想讓房東了解的資訊"
              />
            </div>

            <div>
              <label htmlFor="contact-info" className="mb-1 block text-sm font-medium text-gray-700">
                聯絡方式（媒合成功後才對房東顯示）
                <span className="ml-0.5 text-red-500">*</span>
              </label>
              <input
                id="contact-info"
                {...register("contact_info", { required: "請填寫聯絡方式" })}
                className={`input ${errors.contact_info ? "border-red-500" : ""}`}
                placeholder="例：Line ID: xxx 或 0912-345-678"
              />
              {errors.contact_info ? (
                <p className="mt-1 text-xs text-red-600">{errors.contact_info.message}</p>
              ) : (
                <p className="mt-1 text-xs text-gray-400">
                  媒合成功後才會顯示給對方，請填真實聯絡方式
                </p>
              )}
            </div>

            {globalError && <p className="text-sm text-red-600">{globalError}</p>}
          </div>

          <div className="flex-shrink-0 space-y-2 border-t border-gray-100 bg-white px-6 pt-3 pb-[max(16px,env(safe-area-inset-bottom))]">
            <button
              type="submit"
              disabled={isSubmitting || formSaved}
              className="bg-primary-600 hover:bg-primary-500 w-full rounded-lg py-3 text-sm font-medium text-white transition disabled:opacity-40"
            >
              {isSubmitting
                ? "儲存中…"
                : editingProfile
                  ? formSaved
                    ? "已儲存 ✓"
                    : "儲存"
                  : "建立需求卡"}
            </button>
            {editingProfile && (
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-lg border border-gray-200 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                關閉
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
