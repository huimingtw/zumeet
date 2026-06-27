"use client";

import { type ReactNode } from "react";

export function BottomTabItem({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-1 flex-col items-center justify-center gap-0.5 transition ${
        active ? "text-primary-600" : "text-gray-400"
      }`}
    >
      {icon}
      <span className="text-[10px]">{label}</span>
    </button>
  );
}
