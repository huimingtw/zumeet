import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/features/admin/api";
import { aqk } from "@/features/admin/queryKeys";
import { type AdminAction, ACTION_LABELS } from "@/features/admin/types";
import { DataTable, type Column } from "@/features/admin/components/DataTable";
import { CopyableId } from "@/features/admin/components/CopyableId";

const COLUMNS: Column<AdminAction>[] = [
  {
    key: "id",
    header: "ID",
    width: "110px",
    render: (a) => <CopyableId id={a.id} />,
  },
  {
    key: "action",
    header: "操作",
    width: "120px",
    render: (a) => ACTION_LABELS[a.action] ?? a.action,
  },
  {
    key: "target_type",
    header: "目標類型",
    width: "100px",
    render: (a) => <span className="text-ink-400">{a.target_type}</span>,
  },
  {
    key: "target_id",
    header: "目標 ID",
    width: "130px",
    render: (a) => (
      <div className="flex items-center gap-1.5">
        <CopyableId id={a.target_id} />
        {a.target_type === "user" && (
          <Link
            to={`/users/${a.target_id}`}
            className="text-primary-600 hover:underline text-[11px]"
            onClick={(e) => e.stopPropagation()}
          >
            →
          </Link>
        )}
      </div>
    ),
  },
  {
    key: "admin_id",
    header: "操作人",
    width: "110px",
    render: (a) => <CopyableId id={a.admin_id} />,
  },
  {
    key: "note",
    header: "備註",
    render: (a) => (
      <span className="line-clamp-1 text-ink-400" title={a.note ?? ""}>
        {a.note ?? "—"}
      </span>
    ),
  },
  {
    key: "created_at",
    header: "時間",
    width: "150px",
    render: (a) => (
      <span className="font-mono text-[12px] text-ink-400">
        {new Date(a.created_at).toLocaleString("zh-TW")}
      </span>
    ),
  },
];

export default function Actions() {
  const { data, isLoading } = useQuery({
    queryKey: aqk.actions(),
    queryFn: () => adminApi.get<AdminAction[]>("/actions").then((r) => r.data),
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-ink-900">稽核紀錄</h1>
      <DataTable
        columns={COLUMNS}
        data={data ?? []}
        isLoading={isLoading}
        emptyState="尚無操作紀錄"
      />
    </div>
  );
}
