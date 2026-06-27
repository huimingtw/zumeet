"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dropdown } from "@/components/ui/Dropdown";
import { ViewingList } from "@/components/ViewingList";
import { api } from "@/lib/api";
import { WEEKDAY_LABELS } from "@/lib/viewings";
import { useListings } from "@/features/listings/useListings";
import { useViewingAvailability } from "@/features/listings/useListings";
import { qk } from "@/features/queryKeys";
import type { ViewingAvailability } from "@/types";
import { ROOM_TYPE_LABELS } from "@/types";

type ViewingsSubTab = "schedule" | "list";
type DayForm = { on: boolean; start: string; end: string };

const EMPTY_WEEK: DayForm[] = Array.from({ length: 7 }, () => ({
  on: false,
  start: "09:00",
  end: "18:00",
}));

export function LandlordViewingsView() {
  const [subTab, setSubTab] = useState<ViewingsSubTab>("schedule");
  return (
    <div>
      <div className="mb-4 flex gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
        {(
          [
            ["schedule", "時段設定"],
            ["list", "帶看清單"],
          ] as [ViewingsSubTab, string][]
        ).map(([t, label]) => (
          <button
            key={t}
            type="button"
            onClick={() => setSubTab(t)}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
              subTab === t
                ? "bg-primary-600 text-white"
                : "text-gray-500 hover:bg-gray-100"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {subTab === "schedule" ? <AvailabilityEditor /> : <ViewingList role="landlord" />}
    </div>
  );
}

function AvailabilityEditor() {
  const qc = useQueryClient();
  const { data: listings = [] } = useListings();
  const [listingId, setListingId] = useState("");

  const { data: avail } = useViewingAvailability(listingId);

  const [enabled, setEnabled] = useState(false);
  const [slotMinutes, setSlotMinutes] = useState(30);
  const [slotCapacity, setSlotCapacity] = useState<number | "">(1);
  const [rangeDays, setRangeDays] = useState<number | "">(14);
  const [week, setWeek] = useState<DayForm[]>(EMPTY_WEEK);
  const [exceptions, setExceptions] = useState<string[]>([]);
  const [newException, setNewException] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!avail) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setEnabled(avail.enabled);
    setSlotMinutes(avail.slot_minutes || 30);
    setSlotCapacity(avail.slot_capacity || 1);
    setRangeDays(avail.booking_range_days || 14);
    setExceptions(avail.exceptions ?? []);
    const w = EMPTY_WEEK.map((d) => ({ ...d }));
    for (const [k, windows] of Object.entries(avail.weekly ?? {})) {
      const idx = Number(k);
      if (windows[0] && idx >= 0 && idx < 7)
        w[idx] = { on: true, start: windows[0][0], end: windows[0][1] };
    }
    setWeek(w);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [avail]);

  const save = useMutation({
    mutationFn: () => {
      const weekly: Record<string, [string, string][]> = {};
      week.forEach((d, i) => {
        if (d.on) weekly[String(i)] = [[d.start, d.end]];
      });
      const body: ViewingAvailability = {
        enabled,
        slot_minutes: slotMinutes,
        slot_capacity: slotCapacity === "" ? 1 : slotCapacity,
        weekly,
        booking_range_days: rangeDays === "" ? 14 : rangeDays,
        exceptions,
      };
      return api.put(`/listings/${listingId}/viewing-availability`, body);
    },
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      qc.invalidateQueries({ queryKey: qk.viewingSlots(listingId) });
    },
  });

  function setDay(i: number, patch: Partial<DayForm>) {
    setWeek((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1 text-sm font-medium text-gray-700">選擇房源</p>
        <Dropdown
          value={listingId}
          placeholder="選擇要設定帶看時段的房源"
          options={listings.map((l) => ({
            value: l.id,
            label:
              l.name ||
              `$${l.rent.toLocaleString()} ${ROOM_TYPE_LABELS[l.room_type] ?? l.room_type}`,
          }))}
          onChange={setListingId}
        />
      </div>

      {listingId && (
        <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-800">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="accent-primary-600 h-4 w-4"
            />
            開放租客預約帶看
          </label>

          {enabled && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="mb-1 text-sm font-medium text-gray-700">
                    帶看長度（分鐘）
                  </p>
                  <Dropdown
                    value={String(slotMinutes)}
                    placeholder="帶看長度"
                    options={[15, 30, 45, 60].map((m) => ({
                      value: String(m),
                      label: `${m} 分鐘`,
                    }))}
                    onChange={(v) => setSlotMinutes(Number(v))}
                  />
                </div>
                <div>
                  <p className="mb-1 text-sm font-medium text-gray-700">可預約天數</p>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={rangeDays}
                    onChange={(e) =>
                      setRangeDays(e.target.value === "" ? "" : Number(e.target.value))
                    }
                    className="input"
                  />
                </div>
                <div>
                  <p className="mb-1 text-sm font-medium text-gray-700">
                    每時段可預約組數
                  </p>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={slotCapacity}
                    onChange={(e) =>
                      setSlotCapacity(e.target.value === "" ? "" : Number(e.target.value))
                    }
                    className="input"
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    大於 1 即開放多組同時帶看（團體帶看）。
                  </p>
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-gray-700">每週可帶看時段</p>
                <div className="space-y-2">
                  {week.map((d, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <label className="flex w-16 flex-shrink-0 items-center gap-1.5 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={d.on}
                          onChange={(e) => setDay(i, { on: e.target.checked })}
                          className="accent-primary-600 h-4 w-4"
                        />
                        {WEEKDAY_LABELS[i]}
                      </label>
                      <input
                        type="time"
                        value={d.start}
                        disabled={!d.on}
                        onChange={(e) => setDay(i, { start: e.target.value })}
                        className="input flex-1 disabled:opacity-40"
                      />
                      <span className="text-gray-400">–</span>
                      <input
                        type="time"
                        value={d.end}
                        disabled={!d.on}
                        onChange={(e) => setDay(i, { end: e.target.value })}
                        className="input flex-1 disabled:opacity-40"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-gray-700">
                  例外日期（不可預約）
                </p>
                <div className="mb-2 flex flex-wrap gap-2">
                  {exceptions.length === 0 && (
                    <span className="text-xs text-gray-400">尚未設定例外日期</span>
                  )}
                  {exceptions.map((ex) => (
                    <span
                      key={ex}
                      className="flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                    >
                      {ex}
                      <button
                        type="button"
                        onClick={() => setExceptions((p) => p.filter((x) => x !== ex))}
                        className="text-gray-400 hover:text-red-500"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={newException}
                    onChange={(e) => setNewException(e.target.value)}
                    className="input flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newException && !exceptions.includes(newException)) {
                        setExceptions((p) => [...p, newException].sort());
                        setNewException("");
                      }
                    }}
                    className="flex-shrink-0 rounded-lg border border-gray-200 px-4 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    新增
                  </button>
                </div>
              </div>
            </>
          )}

          <button
            type="button"
            disabled={save.isPending}
            onClick={() => save.mutate()}
            className="bg-primary-600 hover:bg-primary-500 w-full rounded-lg py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {saved ? "已儲存 ✓" : "儲存設定"}
          </button>
        </div>
      )}
    </div>
  );
}
