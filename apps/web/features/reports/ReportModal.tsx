"use client";

import { useId, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useReport } from "./useReport";

const REASONS = [
  { value: "詐騙/虛假資訊", label: "詐騙 / 虛假資訊" },
  { value: "不當言論或內容", label: "不當言論或內容" },
  { value: "騷擾", label: "騷擾" },
  { value: "其他", label: "其他" },
] as const;

export function ReportModal({
  open,
  onClose,
  reportedId,
  listingId,
}: {
  open: boolean;
  onClose: () => void;
  reportedId: string;
  listingId?: string;
}) {
  const headingId = useId();
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const report = useReport();

  function handleClose() {
    setReason("");
    setNote("");
    report.reset();
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fullReason = note.trim() ? `${reason}\n${note.trim()}` : reason;
    await report.mutateAsync(
      { reported_id: reportedId, listing_id: listingId, reason: fullReason },
      {
        onSuccess: () => {
          handleClose();
          alert("已送出檢舉，我們將盡快審核。");
        },
      }
    );
  }

  return (
    <Modal open={open} onClose={handleClose} labelledBy={headingId} align="center">
      <div className="p-5">
        <h2 id={headingId} className="mb-4 text-base font-semibold text-gray-900">
          檢舉
        </h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-gray-700">
              請選擇檢舉原因
            </legend>
            <div className="space-y-2">
              {REASONS.map(({ value, label }) => (
                <label key={value} className="flex cursor-pointer items-center gap-2.5">
                  <input
                    type="radio"
                    name="reason"
                    value={value}
                    checked={reason === value}
                    onChange={() => setReason(value)}
                    className="accent-primary-600 h-4 w-4"
                  />
                  <span className="text-sm text-gray-800">{label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <label
              htmlFor="report-note"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              補充說明（選填）
            </label>
            <textarea
              id="report-note"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="請提供更多細節…"
              className="input w-full resize-none text-sm"
            />
          </div>

          {report.isError && (
            <p className="text-sm text-red-600">送出失敗，請稍後再試。</p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={!reason || report.isPending}
              className="bg-primary-600 hover:bg-primary-500 disabled:bg-primary-300 rounded-lg px-4 py-2 text-sm font-medium text-white transition disabled:cursor-not-allowed"
            >
              {report.isPending ? "送出中…" : "送出檢舉"}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
