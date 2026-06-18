"use client";

import { useEffect } from "react";

import { useRouter } from "next/navigation";

import { api } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    api
      .get<{ roles: string[] }>("/profile/me")
      .then((res) => {
        const roles = res.data.roles ?? [];
        if (roles.includes("landlord")) {
          router.replace("/dashboard/landlord");
        } else if (roles.includes("tenant")) {
          router.replace("/dashboard/tenant");
        }
      })
      .catch(() => {});
  }, [router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-100 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <h1 className="text-[32px] font-bold leading-10 tracking-wide text-gray-950">
            Zumeet
          </h1>
          <p className="mt-2 text-sm text-gray-500">租客與房東條件雙向媒合平台</p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <h2 className="mb-1 text-base font-semibold text-gray-950">登入 / 註冊</h2>
          <p className="mb-6 text-sm text-gray-500">
            目前僅支援 Google 登入。首次登入後需完成個人設定。
          </p>

          <a
            href={`${API_BASE}/api/v1/auth/google`}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-800 shadow-sm transition hover:bg-gray-50 active:bg-gray-100"
          >
            <GoogleIcon />
            以 Google 帳號繼續
          </a>
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          平台僅提供條件媒合功能，不參與租賃交易，不保證資訊真實性。
          <br />
          實際租賃關係由雙方自行確認與承擔。
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z"
        fill="#EA4335"
      />
    </svg>
  );
}
