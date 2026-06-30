"use client";

import { ExpandableText } from "@/components/ui/ExpandableText";
import { Badge } from "@/components/ui/Badge";
import { PROFILE_TAGS } from "@/lib/listingTags";
import { ROOM_TYPE_LABELS } from "@/types";

// Normalized tenant info shared by browse card + incoming/outgoing/matched tabs.
// Budget is intentionally absent — landlords must never see tenants' budgets.
export type TenantInfo = {
  account_name?: string;
  name?: string;
  occupation?: string;
  age?: number;
  has_pets?: boolean;
  smoking?: boolean;
  preferred_room_types?: string[];
  available_from?: string;
  min_lease_months?: number;
  needs_subsidy?: boolean;
  needs_tax_receipt?: boolean;
  needs_household_registration?: boolean;
  needs_cooking?: boolean;
  needs_parking?: boolean;
  description?: string;
};

// The aggregated match/interest endpoints prefix tenant fields with tenant_*
// (to avoid colliding with the listing fields in the same row).
export type TenantTabItem = {
  profile_name?: string;
  tenant_occupation?: string;
  tenant_age?: number;
  tenant_has_pets?: boolean;
  tenant_smoking?: boolean;
  tenant_preferred_room_types?: string[];
  tenant_available_from?: string;
  tenant_account_name?: string;
  tenant_min_lease_months?: number;
  tenant_needs_subsidy?: boolean;
  tenant_needs_tax_receipt?: boolean;
  tenant_needs_household_registration?: boolean;
  tenant_needs_cooking?: boolean;
  tenant_needs_parking?: boolean;
  tenant_description?: string;
};

export function tenantInfoFromTab(p: TenantTabItem): TenantInfo {
  return {
    account_name: p.tenant_account_name,
    name: p.profile_name,
    occupation: p.tenant_occupation,
    age: p.tenant_age,
    has_pets: p.tenant_has_pets,
    smoking: p.tenant_smoking,
    preferred_room_types: p.tenant_preferred_room_types,
    available_from: p.tenant_available_from,
    min_lease_months: p.tenant_min_lease_months,
    needs_subsidy: p.tenant_needs_subsidy,
    needs_tax_receipt: p.tenant_needs_tax_receipt,
    needs_household_registration: p.tenant_needs_household_registration,
    needs_cooking: p.tenant_needs_cooking,
    needs_parking: p.tenant_needs_parking,
    description: p.tenant_description,
  };
}

// 職業/年齡，可能為空字串
function occupationAge(info: TenantInfo): string {
  const parts = [
    info.occupation,
    info.age != null ? `${info.age} 歲` : null,
  ].filter(Boolean) as string[];
  return parts.join(" · ");
}

// 過了可入住日就顯示「可立即入住」，否則顯示日期
function moveInLabel(availableFrom: string): string {
  const d = new Date(availableFrom);
  d.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d <= today ? "可立即入住" : `${d.toLocaleDateString("zh-TW")} 可入住`;
}

export function TenantSummary({ info }: { info: TenantInfo }) {
  const title = info.account_name || info.name || "";
  const sub = occupationAge(info);
  const tags = PROFILE_TAGS.filter((t) => info[t.key]);
  const rooms = (info.preferred_room_types ?? []).map(
    (t) => ROOM_TYPE_LABELS[t] ?? t
  );
  const hasConditions =
    rooms.length > 0 || !!info.available_from || (info.min_lease_months ?? 0) > 0;

  return (
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-sm font-semibold text-gray-950">
          {title || sub || "租客"}
        </span>
        {title && sub && (
          <span className="text-xs text-gray-500">{sub}</span>
        )}
      </div>
      {hasConditions && (
        // 關鍵條件列 — 預算刻意不顯示，房東不得看到租客預算
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500">
          {rooms.length > 0 && <span>{rooms.join("／")}</span>}
          {info.available_from && <span>{moveInLabel(info.available_from)}</span>}
          {(info.min_lease_months ?? 0) > 0 && (
            <span>至少 {info.min_lease_months} 個月</span>
          )}
        </div>
      )}
      {info.description && (
        <ExpandableText
          text={info.description}
          className="mt-1.5 text-sm text-gray-600"
        />
      )}
      {tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {tags.map((tag) => (
            <Badge
              key={tag.key}
              // 生活型態（寵物/吸菸）房東需留意 → 顯眼；需求已被媒合滿足 → 淡色
              tone={tag.kind === "lifestyle" ? "warning" : "neutral"}
              className="px-3 py-1"
            >
              {tag.kind === "need" ? `需${tag.label}` : tag.label}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
