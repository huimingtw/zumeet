"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { api } from "@/lib/api";
import { qk } from "@/features/queryKeys";
import type { MeResponse } from "@/types";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { Button } from "@/components/ui/Button";

export default function AccountPage() {
  const qc = useQueryClient();
  const { data: me } = useQuery<MeResponse>({
    queryKey: qk.me(),
    queryFn: () => api.get("/profile/me").then((r) => r.data),
  });

  const {
    register,
    handleSubmit,
    formState: { isSubmitting, errors },
  } = useForm<{ contact_info: string }>({
    values: { contact_info: me?.contact_info ?? "" },
  });

  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(data: { contact_info: string }) {
    setError("");
    setSaved(false);
    try {
      await api.put("/profile/me", { contact_info: data.contact_info.trim() });
      qc.invalidateQueries({ queryKey: qk.me() });
      setSaved(true);
    } catch {
      setError("儲存失敗，請稍後再試");
    }
  }

  return (
    <div className="min-h-screen">
      <DashboardHeader />
      <div className="mx-auto max-w-md px-4 pt-6">
        <h1 className="mb-1 text-lg font-bold text-gray-950">帳號設定</h1>
        <p className="mb-6 text-sm text-gray-500">
          聯絡方式只需填一次，所有需求卡與房源共用。媒合成功後才會顯示給對方。
        </p>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div>
            <label
              htmlFor="contact_info"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              聯絡方式<span className="ml-0.5 text-red-500">*</span>
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
              <p className="mt-1 text-xs text-gray-400">媒合成功後才會顯示，請填真實聯絡方式。</p>
            )}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {saved && (
            <p className="text-sm text-green-600">已儲存 ✓ 可關閉此分頁返回繼續填寫。</p>
          )}

          <Button type="submit" size="lg" fullWidth disabled={isSubmitting}>
            {isSubmitting ? "儲存中…" : "儲存"}
          </Button>
        </form>
      </div>
    </div>
  );
}
