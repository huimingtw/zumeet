export type ReportStatus = "pending" | "reviewing" | "resolved" | "dismissed";

export interface Report {
  id: string;
  reporter_id: string;
  reported_id: string;
  listing_id: string | null;
  reason: string;
  status: ReportStatus;
  created_at: string;
}

export interface ResolveReportPayload {
  status: "resolved" | "dismissed";
  note: string;
}

export interface AdminUser {
  id: string;
  email: string;
  suspended_at: string | null;
  deleted_at: string | null;
  listing_count: number;
  profile_count: number;
}

export interface AdminAction {
  id: string;
  admin_id: string;
  action: string;
  target_type: string;
  target_id: string;
  note: string | null;
  created_at: string;
}

export const ACTION_LABELS: Record<string, string> = {
  suspend_user: "帳號停用",
  unsuspend_user: "帳號復原",
  delete_user: "帳號刪除",
  remove_listing: "房源下架",
  restore_listing: "房源復原",
  resolve_report: "檢舉處理",
  dismiss_report: "檢舉忽略",
};
