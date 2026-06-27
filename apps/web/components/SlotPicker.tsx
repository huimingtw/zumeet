"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ViewingSlot } from "@/types";
import { dateKey, formatSlot } from "@/lib/viewings";
import { groupBy } from "@/lib/groupBy";
import { qk } from "@/features/queryKeys";

// SlotPicker shows a listing's open 帶看 slots grouped by date and lets the user pick one.
// value/onChange carry the selected slot start (ISO string), or "" for none.
export function SlotPicker({
  listingId,
  value,
  onChange,
}: {
  listingId: string;
  value: string;
  onChange: (startISO: string) => void;
}) {
  const { data, isLoading } = useQuery<{ enabled: boolean; slots: ViewingSlot[] }>({
    queryKey: qk.viewingSlots(listingId),
    queryFn: () => api.get(`/listings/${listingId}/viewing-slots`).then((r) => r.data),
  });

  const grouped = useMemo(
    () => groupBy(data?.slots ?? [], (s) => dateKey(s.start)),
    [data]
  );

  if (isLoading) return <p className="text-sm text-gray-400">載入可預約時段…</p>;
  if (!data?.enabled) return null;
  if (grouped.length === 0)
    return <p className="text-sm text-gray-400">目前沒有可預約的帶看時段。</p>;

  const timeOf = (iso: string) =>
    new Date(iso).toLocaleTimeString("zh-TW", {
      timeZone: "Asia/Taipei",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

  return (
    <div className="max-h-64 space-y-3 overflow-y-auto">
      {grouped.map(([day, slots]) => (
        <div key={day}>
          <p className="mb-1.5 text-xs font-medium text-gray-500">{day}</p>
          <div className="flex flex-wrap gap-1.5">
            {slots.map((s) => {
              const full = s.booked_count >= s.capacity;
              return (
                <button
                  key={s.start}
                  type="button"
                  disabled={full}
                  onClick={() => onChange(value === s.start ? "" : s.start)}
                  className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                    full
                      ? "cursor-not-allowed border-gray-100 text-gray-300"
                      : value === s.start
                        ? "border-primary-600 bg-primary-50 text-primary-600"
                        : "border-gray-200 text-gray-700 hover:border-gray-400"
                  }`}
                >
                  {timeOf(s.start)}
                  {s.capacity > 1 && (
                    <span className="ml-1 text-[10px] text-gray-400">
                      {s.booked_count}/{s.capacity}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <p className="text-xs text-gray-400">
        雙方確認媒合後才會交換聯絡方式；帶看時段不會額外揭露聯絡資訊。
      </p>
    </div>
  );
}

export { formatSlot };
