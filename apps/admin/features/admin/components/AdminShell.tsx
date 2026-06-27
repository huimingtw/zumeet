import { type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { FileWarning, BookOpen, LogOut } from "lucide-react";
import { adminApi } from "@/features/admin/api";
import { EnvBadge } from "./EnvBadge";

const NAV_ITEMS = [
  { href: "/reports", label: "檢舉佇列", icon: FileWarning },
  { href: "/actions", label: "稽核紀錄", icon: BookOpen },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();

  const logout = useMutation({
    mutationFn: () => adminApi.post("/logout"),
    onSettled: () => {
      window.location.href = "/login";
    },
  });

  return (
    <div className="flex h-screen flex-col text-[14px] leading-[1.5] bg-gray-50">
      {/* topbar */}
      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-4">
        <span className="font-semibold text-ink-900">Zumeet Admin</span>
        <EnvBadge />
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => logout.mutate()}
          className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-ink-500 hover:bg-gray-100 hover:text-ink-900 transition-colors"
        >
          <LogOut size={15} />
          登出
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* sidebar */}
        <nav className="flex w-56 shrink-0 flex-col border-r border-gray-200 bg-white py-4 px-2">
          <ul className="space-y-1 flex-1">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const active = pathname.startsWith(href);
              return (
                <li key={href}>
                  <Link
                    to={href}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      active
                        ? "bg-primary-50 text-primary-700 border-l-2 border-primary-600"
                        : "text-ink-500 hover:bg-gray-50 hover:text-ink-900"
                    }`}
                  >
                    <Icon size={16} />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* content */}
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
