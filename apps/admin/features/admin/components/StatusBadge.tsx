import { Badge } from "@/components/ui/Badge";

type Tone = "brand" | "success" | "warning" | "neutral" | "danger";

const TONE_MAP: Record<string, Tone> = {
  pending: "warning",
  reviewing: "warning",
  resolved: "success",
  dismissed: "neutral",
  active: "success",
  suspended: "warning",
  deleted: "danger",
  removed: "danger",
  live: "success",
};

const LABEL_MAP: Record<string, string> = {
  pending: "待處理",
  reviewing: "審核中",
  resolved: "已處理",
  dismissed: "已忽略",
  active: "正常",
  suspended: "已停用",
  deleted: "已刪除",
  removed: "已下架",
  live: "上架中",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge tone={TONE_MAP[status] ?? "neutral"}>
      {LABEL_MAP[status] ?? status}
    </Badge>
  );
}
