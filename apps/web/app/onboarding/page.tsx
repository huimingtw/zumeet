"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";

const TOS = `本平台（Zumeet）為租客與房東條件媒合平台，非仲介服務，不保證任何資訊真實性，不介入租賃交易、不處理租金押金、不做身份收入產權驗證。

刊登資料（含聯絡方式）由使用者自填，平台不負責驗證。媒合成功後才顯示對方聯絡方式，由雙方自行確認並承擔實際租賃關係。

房東刊登房源時確認：房源非頂樓加蓋、違建或依法不得出租之空間；刊登內容不包含性別、性傾向、種族、宗教、身心障礙等敏感屬性限制。

個人資料（含聯絡方式）僅用於媒合後顯示，不寫進系統日誌，不用於其他用途。帳號刪除後資料立即從平台移除。

使用本平台即表示同意上述條款。`;

function OnboardingForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [role, setRole] = useState<"tenant" | "landlord" | "">("");
  const [agreed, setAgreed] = useState(false);
  const [oauthState, setOauthState] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const state = searchParams.get("state");
    if (!state) {
      setError("缺少登入狀態，請重新以 Google 登入");
    } else {
      setOauthState(state);
    }
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!role || !agreed || !oauthState) return;
    setLoading(true);
    setError("");
    try {
      await api.post("/auth/onboarding", {
        role,
        accepted_tos: true,
        oauth_state: oauthState,
      });
      router.push(role === "tenant" ? "/dashboard/tenant" : "/dashboard/landlord");
    } catch (err: unknown) {
      if (err && typeof err === "object" && "response" in err) {
        const axiosErr = err as { response?: { data?: { error?: string } } };
        setError(axiosErr.response?.data?.error ?? "發生錯誤，請稍後再試");
      } else {
        setError("發生錯誤，請稍後再試");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold">歡迎加入 Zumeet</h1>
          <p className="mt-1 text-sm text-zinc-500">請完成以下設定後即可開始使用</p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm space-y-6">
          <div>
            <p className="mb-3 text-sm font-medium">您的身份</p>
            <div className="grid grid-cols-2 gap-3">
              <RoleCard selected={role === "tenant"} onClick={() => setRole("tenant")} title="租客" desc="我在找房子" />
              <RoleCard selected={role === "landlord"} onClick={() => setRole("landlord")} title="房東" desc="我有房子出租" />
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">服務條款</p>
            <div className="h-40 overflow-y-auto rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs leading-relaxed text-zinc-600 whitespace-pre-line">
              {TOS}
            </div>
            <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-zinc-300 accent-zinc-900"
              />
              <span>我已閱讀並同意上述服務條款與平台免責聲明</span>
            </label>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={!role || !agreed || !oauthState || loading}
            className="w-full rounded-xl bg-zinc-900 py-3 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-40"
          >
            {loading ? "請稍候…" : "完成設定，開始使用"}
          </button>
        </form>
      </div>
    </div>
  );
}

function RoleCard({
  selected, onClick, title, desc,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border-2 p-4 text-left transition ${
        selected ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-white text-zinc-800 hover:border-zinc-400"
      }`}
    >
      <p className="font-semibold">{title}</p>
      <p className={`mt-1 text-xs ${selected ? "text-zinc-300" : "text-zinc-500"}`}>{desc}</p>
    </button>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-sm text-zinc-400">載入中…</div>}>
      <OnboardingForm />
    </Suspense>
  );
}
