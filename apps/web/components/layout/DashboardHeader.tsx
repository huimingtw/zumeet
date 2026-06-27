"use client";

import { api } from "@/lib/api";

export function DashboardHeader() {
  async function logout() {
    await api.post("/auth/logout");
    window.location.href = "/";
  }

  return (
    <header className="border-b border-gray-200 bg-white px-4 py-3">
      <div className="mx-auto flex max-w-4xl items-center justify-between">
        <span className="text-lg font-bold text-gray-950">Zumeet</span>
        <button
          type="button"
          onClick={logout}
          className="text-sm text-gray-500 hover:text-gray-800"
        >
          登出
        </button>
      </div>
    </header>
  );
}
