"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { qk } from "@/features/queryKeys";

interface Me {
  email: string;
  name: string;
  avatar_url: string;
  roles: string[];
}

// Land directly on the role dashboard so we skip the "/" login page (which only
// redirects after a client-side /profile/me round-trip, causing a login flash).
function homeHref(me: Me | undefined): string {
  if (me?.roles?.includes("landlord")) return "/dashboard/landlord";
  if (me?.roles?.includes("tenant")) return "/dashboard/tenant";
  return "/";
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

  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close the dropdown on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function logout() {
    await api.post("/auth/logout");
    window.location.href = "/";
  }

  return (
    <header className="border-b border-gray-200 bg-white px-4 py-3">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
        <a href={homeHref(me)} className="text-lg font-bold text-gray-950 hover:opacity-80">
          Zumeet
        </a>
        {me && (
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={open}
              className="flex items-center rounded-full hover:opacity-80"
            >
              <Avatar me={me} />
            </button>
            {open && (
              <div
                role="menu"
                className="absolute right-0 z-10 mt-2 w-44 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
              >
                <a
                  href="/account"
                  role="menuitem"
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  onClick={() => setOpen(false)}
                >
                  帳號設定
                </a>
                <button
                  type="button"
                  role="menuitem"
                  onClick={logout}
                  className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                >
                  登出
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
