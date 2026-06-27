import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { adminApi } from "@/features/admin/api";
import { aqk } from "@/features/admin/queryKeys";
import { type Report } from "@/features/admin/types";
import { StatusBadge } from "@/features/admin/components/StatusBadge";
import { CopyableId } from "@/features/admin/components/CopyableId";
import { useActionConfirm } from "@/features/admin/components/ActionConfirmDialog";
import { Button } from "@/components/ui/Button";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-3 border-b border-gray-100 last:border-0">
      <dt className="text-xs font-medium text-ink-400 uppercase tracking-wide mb-1">{label}</dt>
      <dd className="text-sm text-ink-900">{children}</dd>
    </div>
  );
}

export function ReportDetail({
  report,
  statusFilter,
  onClose,
}: {
  report: Report;
  statusFilter: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [confirmEl, confirm] = useActionConfirm();

  function invalidate() {
    qc.invalidateQueries({ queryKey: aqk.reports(statusFilter) });
    qc.invalidateQueries({ queryKey: aqk.actions() });
  }

  const resolve = useMutation({
    mutationFn: ({ status, note }: { status: "resolved" | "dismissed"; note: string }) =>
      adminApi.post(`/reports/${report.id}/resolve`, { status, note }),
    onSuccess: () => {
      invalidate();
      onClose();
    },
  });

  const removeListing = useMutation({
    mutationFn: () => adminApi.post(`/listings/${report.listing_id}/remove`),
    onSuccess: invalidate,
  });

  async function handleResolve(status: "resolved" | "dismissed") {
    const label = status === "resolved" ? "處理" : "忽略";
    const result = await confirm({
      level: 2,
      title: `${label}此檢舉`,
      message: "請輸入處理原因（將記錄於稽核紀錄）。",
      confirmLabel: label,
    });
    if (result) resolve.mutate({ status, note: result.note });
  }

  async function handleRemoveListing() {
    const result = await confirm({
      level: 2,
      title: "下架此房源",
      message: "房源將立即從媒合瀏覽中移除，可隨時復原。",
      confirmLabel: "下架",
    });
    if (result) removeListing.mutate();
  }

  const isPending = report.status === "pending" || report.status === "reviewing";

  return (
    <>
      {confirmEl}
      <dl className="divide-y divide-gray-100">
        <Field label="狀態">
          <StatusBadge status={report.status} />
        </Field>
        <Field label="檢舉 ID">
          <CopyableId id={report.id} truncate={12} />
        </Field>
        <Field label="原因">{report.reason}</Field>
        <Field label="檢舉人">
          <div className="flex items-center gap-2">
            <CopyableId id={report.reporter_id} />
            <Link
              to={`/users/${report.reporter_id}`}
              className="text-primary-600 hover:underline text-xs"
              onClick={onClose}
            >
              查看帳號 →
            </Link>
          </div>
        </Field>
        <Field label="被檢舉人">
          <div className="flex items-center gap-2">
            <CopyableId id={report.reported_id} />
            <Link
              to={`/users/${report.reported_id}`}
              className="text-primary-600 hover:underline text-xs"
              onClick={onClose}
            >
              查看帳號 →
            </Link>
          </div>
        </Field>
        {report.listing_id && (
          <Field label="相關房源">
            <CopyableId id={report.listing_id} />
          </Field>
        )}
        <Field label="時間">{new Date(report.created_at).toLocaleString("zh-TW")}</Field>
      </dl>

      {isPending && (
        <div className="mt-6 space-y-2">
          <div className="flex gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleResolve("resolved")}
              disabled={resolve.isPending}
            >
              標記已處理
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleResolve("dismissed")}
              disabled={resolve.isPending}
            >
              忽略
            </Button>
          </div>
          {report.listing_id && (
            <Button
              variant="danger"
              size="sm"
              onClick={handleRemoveListing}
              disabled={removeListing.isPending}
            >
              下架相關房源
            </Button>
          )}
        </div>
      )}
    </>
  );
}
