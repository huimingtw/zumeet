"use client";

import { type ReactNode } from "react";

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white py-12 text-center shadow-sm">
      {icon && <div className="mb-3 flex justify-center">{icon}</div>}
      <p className="text-sm font-medium text-gray-700">{title}</p>
      {description && <p className="mt-1 text-xs text-gray-400">{description}</p>}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="border-primary-600 text-primary-600 hover:bg-primary-50 mt-4 rounded-lg border px-4 py-2 text-sm font-medium transition"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
