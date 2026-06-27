import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/features/admin/api";
import { aqk } from "@/features/admin/queryKeys";
import { type Report } from "@/features/admin/types";
import { DataTable, type Column } from "@/features/admin/components/DataTable";
import { FilterBar } from "@/features/admin/components/FilterBar";
import { DetailDrawer } from "@/features/admin/components/DetailDrawer";
import { StatusBadge } from "@/features/admin/components/StatusBadge";
import { CopyableId } from "@/features/admin/components/CopyableId";
import { ReportDetail } from "./ReportDetail";

const STATUS_OPTIONS = [
  { label: "待處理", value: "pending" },
  { label: "已處理", value: "resolved" },
  { label: "已忽略", value: "dismissed" },
];

const COLUMNS: Column<Report>[] = [
  {
    key: "id",
    header: "ID",
    width: "120px",
    render: (r) => <CopyableId id={r.id} />,
  },
  {
    key: "status",
    header: "狀態",
    width: "100px",
    render: (r) => <StatusBadge status={r.status} />,
  },
  {
    key: "reason",
    header: "原因",
    render: (r) => (
      <span className="line-clamp-1 max-w-[200px]" title={r.reason}>
        {r.reason}
      </span>
    ),
  },
  {
    key: "reporter_id",
    header: "檢舉人",
    width: "120px",
    render: (r) => <CopyableId id={r.reporter_id} />,
  },
  {
    key: "reported_id",
    header: "被檢舉人",
    width: "120px",
    render: (r) => <CopyableId id={r.reported_id} />,
  },
  {
    key: "listing_id",
    header: "相關房源",
    width: "120px",
    render: (r) =>
      r.listing_id ? (
        <CopyableId id={r.listing_id} />
      ) : (
        <span className="text-ink-400">—</span>
      ),
  },
  {
    key: "created_at",
    header: "時間",
    width: "150px",
    render: (r) => (
      <span className="text-ink-400 font-mono text-[12px]">
        {new Date(r.created_at).toLocaleDateString("zh-TW")}
      </span>
    ),
  },
];

export default function Reports() {
  const [status, setStatus] = useState("pending");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: aqk.reports(status),
    queryFn: () => adminApi.get<Report[]>(`/reports?status=${status}`).then((r) => r.data),
  });

  const selectedReport = data?.find((r) => r.id === selectedId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-ink-900">檢舉佇列</h1>
        <FilterBar
          options={STATUS_OPTIONS}
          value={status}
          onChange={(v) => {
            setStatus(v);
            setSelectedId(null);
          }}
        />
      </div>

      <DataTable
        columns={COLUMNS}
        data={data ?? []}
        isLoading={isLoading}
        onRowClick={(r) => setSelectedId(r.id)}
        emptyState={
          <span>
            目前沒有{STATUS_OPTIONS.find((o) => o.value === status)?.label}的檢舉 🎉
          </span>
        }
      />

      <DetailDrawer
        open={!!selectedReport}
        onClose={() => setSelectedId(null)}
        title="檢舉詳情"
      >
        {selectedReport && (
          <ReportDetail
            report={selectedReport}
            statusFilter={status}
            onClose={() => setSelectedId(null)}
          />
        )}
      </DetailDrawer>
    </div>
  );
}
