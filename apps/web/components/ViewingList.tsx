"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Viewing } from "@/types";
import { dateKey, formatSlot, VIEWING_STATUS_BADGE } from "@/lib/viewings";
import { SlotPicker } from "@/components/SlotPicker";

// ViewingList renders 帶看 grouped by date for either side.
// Landlord: marks attendance + cancel. Tenant: sees revealed contact/address + reschedule/cancel.
export function ViewingList({ role }: { role: "tenant" | "landlord" }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{ items: Viewing[] }>({
    queryKey: ["viewings", role],
    queryFn: () => api.get(`/viewings?role=${role}`).then((r) => r.data),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["viewings", role] });

  const attendance = useMutation({
    mutationFn: (p: { id: string; attendance: "attended" | "absent" }) =>
      api.post(`/viewings/${p.id}/attendance`, { attendance: p.attendance }),
    onSuccess: invalidate,
  });
  const cancel = useMutation({
    mutationFn: (id: string) => api.post(`/viewings/${id}/cancel`),
    onSuccess: invalidate,
  });
  const reschedule = useMutation({
    mutationFn: (p: { id: string; starts_at: string }) =>
      api.post(`/viewings/${p.id}/reschedule`, { starts_at: p.starts_at }),
    onSuccess: () => {
      invalidate();
      qc.invalidateQueries({ queryKey: ["viewing-slots"] });
    },
  });
  const rebook = useMutation({
    mutationFn: (p: { match_id: string; starts_at: string }) =>
      api.post(`/viewings`, { match_id: p.match_id, starts_at: p.starts_at }),
    onSuccess: () => {
      invalidate();
      qc.invalidateQueries({ queryKey: ["viewing-slots"] });
    },
  });

  // One slot-picker modal serves both reschedule (confirmed) and re-book (cancelled).
  const [slotModal, setSlotModal] = useState<{ viewing: Viewing; mode: "reschedule" | "rebook" } | null>(null);
  const [pickedSlot, setPickedSlot] = useState("");

  const grouped = useMemo(() => {
    const map = new Map<string, Viewing[]>();
    for (const v of data?.items ?? []) {
      const k = dateKey(v.starts_at);
      (map.get(k) ?? map.set(k, []).get(k)!).push(v);
    }
    return [...map.entries()];
  }, [data]);

  if (isLoading) return <p className="py-10 text-center text-sm text-gray-400">載入中…</p>;
  if (grouped.length === 0)
    return (
      <p className="py-10 text-center text-sm text-gray-400">
        {role === "landlord" ? "尚無帶看安排。" : "尚無帶看行程。媒合成功並選擇時段後會出現在這裡。"}
      </p>
    );

  return (
    <div className="space-y-5">
      {grouped.map(([day, items]) => (
        <div key={day}>
          <p className="mb-2 text-sm font-semibold text-gray-700">{day}</p>
          <div className="space-y-2">
            {items.map((v) => {
              const badge = VIEWING_STATUS_BADGE[v.status];
              return (
                <div key={v.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900">{formatSlot(v.starts_at, v.ends_at)}</p>
                      <p className="mt-0.5 truncate text-xs text-gray-500">
                        {role === "landlord"
                          ? v.profile_name
                          : v.listing_name || `$${v.rent.toLocaleString()}`}
                      </p>
                    </div>
                    <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${badge.cls}`}>
                      {v.status === "completed" && v.attendance
                        ? v.attendance === "attended"
                          ? "已到場"
                          : "未到場"
                        : badge.label}
                    </span>
                  </div>

                  {/* Tenant: contact/address only present when the match is active */}
                  {role === "tenant" && v.status === "confirmed" && (v.contact_info || v.address) && (
                    <div className="mt-2 rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
                      {v.address && <p>帶看地址：{v.address}</p>}
                      {v.contact_info && <p>房東聯絡方式：{v.contact_info}</p>}
                    </div>
                  )}

                  {/* Landlord attendance on confirmed viewings */}
                  {role === "landlord" && v.status === "confirmed" && (
                    <div className="mt-3 flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => attendance.mutate({ id: v.id, attendance: "attended" })}
                        className="rounded-lg bg-primary-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-primary-500"
                      >
                        已到場
                      </button>
                      <button
                        type="button"
                        onClick={() => attendance.mutate({ id: v.id, attendance: "absent" })}
                        className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
                      >
                        未到場
                      </button>
                      <button
                        type="button"
                        onClick={() => cancel.mutate(v.id)}
                        className="ml-auto rounded-lg px-2.5 py-1.5 text-xs text-red-500 hover:bg-red-50"
                      >
                        取消此時段
                      </button>
                    </div>
                  )}

                  {/* Tenant actions on confirmed viewings */}
                  {role === "tenant" && v.status === "confirmed" && (
                    <div className="mt-3 flex gap-3 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setSlotModal({ viewing: v, mode: "reschedule" });
                          setPickedSlot("");
                        }}
                        className="font-medium text-primary-600 hover:underline"
                      >
                        改期
                      </button>
                      <button
                        type="button"
                        onClick={() => cancel.mutate(v.id)}
                        className="text-red-500 hover:underline"
                      >
                        取消預約
                      </button>
                    </div>
                  )}

                  {/* Tenant re-book on cancelled viewings while the match is still active */}
                  {role === "tenant" &&
                    (v.status === "cancelled" || v.status === "cancelled_landlord") &&
                    v.match_active && (
                      <div className="mt-3 text-xs">
                        <button
                          type="button"
                          onClick={() => {
                            setSlotModal({ viewing: v, mode: "rebook" });
                            setPickedSlot("");
                          }}
                          className="font-medium text-primary-600 hover:underline"
                        >
                          重新預約
                        </button>
                      </div>
                    )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {slotModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
          onClick={() => setSlotModal(null)}
        >
          <div
            className="w-full max-w-sm rounded-t-2xl bg-white p-5 sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-3 text-sm font-semibold text-gray-900">
              {slotModal.mode === "reschedule" ? "改期 — 選擇新的帶看時段" : "重新預約 — 選擇帶看時段"}
            </p>
            <SlotPicker listingId={slotModal.viewing.listing_id} value={pickedSlot} onChange={setPickedSlot} />
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setSlotModal(null)}
                className="flex-1 rounded-lg border border-gray-200 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                取消
              </button>
              <button
                type="button"
                disabled={!pickedSlot || reschedule.isPending || rebook.isPending}
                onClick={() => {
                  if (slotModal.mode === "reschedule") {
                    reschedule.mutate(
                      { id: slotModal.viewing.id, starts_at: pickedSlot },
                      { onSuccess: () => setSlotModal(null) }
                    );
                  } else {
                    rebook.mutate(
                      { match_id: slotModal.viewing.match_id, starts_at: pickedSlot },
                      { onSuccess: () => setSlotModal(null) }
                    );
                  }
                }}
                className="flex-1 rounded-lg bg-primary-600 py-2 text-sm font-medium text-white hover:bg-primary-500 disabled:opacity-50"
              >
                {slotModal.mode === "reschedule" ? "確認改期" : "確認預約"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
