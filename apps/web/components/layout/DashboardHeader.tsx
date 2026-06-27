"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { qk } from "@/features/queryKeys";

interface Me {
  email: string;
  name: string;
  avatar_url: string;
}

// Prefer the Google name; fall back to the email local-part for older accounts.
function displayName(me: Me): string {
  return me.name || me.email.split("@")[0] || me.email;
}

// Deterministic background color from the name, so the initial avatar is stable per user.
const AVATAR_COLORS = [
  "#0052CC",
  "#00875A",
  "#5243AA",
  "#DE350B",
  "#FF8B00",
  "#00A3BF",
  "#6554C0",
];
function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// Google avatar if present, otherwise a Jira-style initial avatar.
function Avatar({ me }: { me: Me }) {
  const name = displayName(me);
  if (me.avatar_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={me.avatar_url}
        alt=""
        width={32}
        height={32}
        className="h-8 w-8 shrink-0 rounded-full bg-gray-100 object-cover"
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      style={{ backgroundColor: avatarColor(name) }}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

export function DashboardHeader() {
  const { data: me } = useQuery<Me>({
    queryKey: qk.me(),
    queryFn: () => api.get("/profile/me").then((r) => r.data),
  });

  async function logout() {
    await api.post("/auth/logout");
    window.location.href = "/";
  }

  const name = me ? displayName(me) : "";

  return (
    <header className="border-b border-gray-200 bg-white px-4 py-3">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
        <span className="text-lg font-bold text-gray-950">Zumeet</span>
        <div className="flex min-w-0 items-center gap-3">
          {me && (
            <div className="flex min-w-0 items-center gap-2">
              <Avatar me={me} />
              <span className="hidden truncate text-sm text-gray-700 sm:inline">
                {name}
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={logout}
            className="shrink-0 text-sm text-gray-500 hover:text-gray-800"
          >
            登出
          </button>
        </div>
      </div>
    </header>
  );
}
