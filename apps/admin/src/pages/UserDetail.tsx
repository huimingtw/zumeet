import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/features/admin/api";
import { aqk } from "@/features/admin/queryKeys";
import { type AdminUser, type AdminAction, ACTION_LABELS } from "@/features/admin/types";
import { StatusBadge } from "@/features/admin/components/StatusBadge";
import { CopyableId } from "@/features/admin/components/CopyableId";
import { useActionConfirm } from "@/features/admin/components/ActionConfirmDialog";
import { DataTable, type Column } from "@/features/admin/components/DataTable";
import { Button } from "@/components/ui/Button";

function userStatus(u: AdminUser): string {
  if (u.deleted_at) return "deleted";
  if (u.suspended_at) return "suspended";
  return "active";
}

const ACTION_COLS: Column<AdminAction>[] = [
  {
    key: "action",
    header: "操作",
    render: (a) => ACTION_LABELS[a.action] ?? a.action,
  },
  {
    key: "note",
    header: "備註",
    render: (a) => <span className="text-ink-400">{a.note ?? "—"}</span>,
  },
  {
    key: "created_at",
    header: "時間",
    width: "150px",
    render: (a) => (
      <span className="font-mono text-[12px] text-ink-400">
        {new Date(a.created_at).toLocaleDateString("zh-TW")}
      </span>
    ),
  },
];

export default function UserDetail() {
  const { userId = "" } = useParams();
  const qc = useQueryClient();
  const [confirmEl, confirm] = useActionConfirm();

  const { data: user, isLoading } = useQuery({
    queryKey: aqk.user(userId),
    queryFn: () => adminApi.get<AdminUser>(`/users/${userId}`).then((r) => r.data),
    enabled: !!userId,
  });

  const { data: allActions } = useQuery({
    queryKey: aqk.actions(),
    queryFn: () => adminApi.get<AdminAction[]>("/actions").then((r) => r.data),
  });

  const userActions = allActions?.filter((a) => a.target_id === userId) ?? [];

  function invalidate() {
    qc.invalidateQueries({ queryKey: aqk.user(userId) });
    qc.invalidateQueries({ queryKey: aqk.actions() });
  }

  const suspend = useMutation({
    mutationFn: (note: string) => adminApi.post(`/users/${userId}/suspend`, { note }),
    onSuccess: invalidate,
  });

  const unsuspend = useMutation({
    mutationFn: () => adminApi.post(`/users/${userId}/unsuspend`),
    onSuccess: invalidate,
  });

  const deleteUser = useMutation({
    mutationFn: (note: string) => adminApi.post(`/users/${userId}/delete`, { note }),
    onSuccess: () => {
      invalidate();
      qc.invalidateQueries({ queryKey: ["admin", "reports"] });
    },
  });

  async function handleSuspend() {
    const result = await confirm({
      level: 2,
      title: "停用帳號",
      message: "停用後，該用戶將無法出現在媒合瀏覽中。可隨時復原。",
      confirmLabel: "停用",
    });
    if (result) suspend.mutate(result.note);
  }

  async function handleDelete() {
    if (!user) return;
    const result = await confirm({
      level: 3,
      title: "刪除帳號",
      message: "此操作將軟刪除用戶帳號及所有相關資料。稽核紀錄將永久保留。",
      confirmLabel: "確認刪除",
      matchValue: userId,
    });
    if (result) deleteUser.mutate(result.note);
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-gray-100 rounded animate-pulse" />
        <div className="card p-6 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-5 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!user) return <p className="text-ink-400">找不到用戶</p>;

  const status = userStatus(user);

  return (
    <>
      {confirmEl}
      <div className="space-y-6 max-w-2xl">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-ink-900">用戶詳情</h1>
          <StatusBadge status={status} />
        </div>

        <div className="card p-6">
          <dl className="divide-y divide-gray-100">
            {(
              [
                ["Email", user.email],
                ["ID", <CopyableId key="id" id={user.id} truncate={16} />],
                ["房源數", user.listing_count],
                ["租客資料數", user.profile_count],
                [
                  "停用時間",
                  user.suspended_at ? new Date(user.suspended_at).toLocaleString("zh-TW") : "—",
                ],
                [
                  "刪除時間",
                  user.deleted_at ? new Date(user.deleted_at).toLocaleString("zh-TW") : "—",
                ],
              ] as [string, React.ReactNode][]
            ).map(([label, value]) => (
              <div key={label} className="py-3 flex justify-between text-sm">
                <dt className="text-ink-400 font-medium">{label}</dt>
                <dd className="text-ink-900">{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        {!user.deleted_at && (
          <div className="flex flex-wrap gap-2">
            {!user.suspended_at ? (
              <Button
                variant="danger"
                size="sm"
                onClick={handleSuspend}
                disabled={suspend.isPending}
              >
                停用帳號
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => unsuspend.mutate()}
                disabled={unsuspend.isPending}
              >
                復原帳號
              </Button>
            )}
            <Button
              variant="danger"
              size="sm"
              onClick={handleDelete}
              disabled={deleteUser.isPending}
            >
              刪除帳號
            </Button>
          </div>
        )}

        <div>
          <h2 className="text-base font-semibold text-ink-900 mb-3">稽核紀錄</h2>
          <DataTable
            columns={ACTION_COLS}
            data={userActions}
            isLoading={false}
            emptyState="尚無操作紀錄"
          />
        </div>
      </div>
    </>
  );
}
