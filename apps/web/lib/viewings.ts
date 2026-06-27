import type { ViewingStatus } from "@/types";

export const WEEKDAY_LABELS = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];

export const VIEWING_STATUS_BADGE: Record<ViewingStatus, { label: string; cls: string }> =
  {
    confirmed: { label: "已確認", cls: "bg-[#D1FAE5] text-[#059669]" },
    completed: { label: "已完成", cls: "bg-gray-100 text-gray-500" },
    cancelled: { label: "已取消", cls: "bg-[#FEE2E2] text-[#991B1B]" },
    cancelled_landlord: { label: "房東已取消", cls: "bg-[#FFF7ED] text-[#C2410C]" },
  };

// formatSlot renders an ISO range as e.g. "6/25（三）14:00–14:30" in Asia/Taipei.
export function formatSlot(startISO: string, endISO: string): string {
  const s = new Date(startISO);
  const e = new Date(endISO);
  const opts: Intl.DateTimeFormatOptions = { timeZone: "Asia/Taipei" };
  const day = s.toLocaleDateString("zh-TW", {
    ...opts,
    month: "numeric",
    day: "numeric",
    weekday: "short",
  });
  const t = (d: Date) =>
    d.toLocaleTimeString("zh-TW", {
      ...opts,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  return `${day} ${t(s)}–${t(e)}`;
}

// dateKey groups slots by their Taipei calendar date.
export function dateKey(iso: string): string {
  return new Date(iso).toLocaleDateString("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
  });
}
