"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { qk } from "@/features/queryKeys";
import type { MeResponse } from "@/types";

// Contact info is a user-level value set once at /account and reused by every
// profile/listing. This shows the current value (read-only) with an edit link,
// or prompts the user to set it when empty. The editing form should disable its
// submit while it's empty (see `useContactInfo`).
export function ContactInfoField({ audience }: { audience: "landlord" | "tenant" }) {
  const me = useContactInfo();
  const who = audience === "landlord" ? "房東" : "租客";
  const contact = me?.contact_info ?? "";

  return (
    <div>
      <p className="mb-1 text-sm font-medium text-gray-700">
        聯絡方式（媒合成功後才對{who}顯示）<span className="ml-0.5 text-red-500">*</span>
      </p>
      {contact ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
          <span className="truncate text-sm text-gray-700">{contact}</span>
          <a
            href="/account"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-600 shrink-0 text-sm font-medium hover:underline"
          >
            編輯
          </a>
        </div>
      ) : (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
          <p className="text-sm text-amber-800">
            您尚未填寫聯絡方式，媒合成功後需要它才能讓對方聯絡您。
          </p>
          <a
            href="/account"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-600 mt-1 inline-block text-sm font-medium hover:underline"
          >
            前往填寫聯絡方式 ›
          </a>
        </div>
      )}
    </div>
  );
}

// useContactInfo returns the cached /profile/me (warm from RoleGuard). Forms use
// `!me?.contact_info` to disable submit until contact info exists.
export function useContactInfo(): MeResponse | undefined {
  const { data } = useQuery<MeResponse>({
    queryKey: qk.me(),
    queryFn: () => api.get("/profile/me").then((r) => r.data),
  });
  return data;
}
