"use client";

import { useEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";

type MenuItem = { label: string; onClick: () => void; danger?: boolean };

export function CardMenu({ items }: { items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="flex h-7 w-7 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
        aria-label="更多選項"
      >
        <MoreHorizontal size={16} strokeWidth={1.5} />
      </button>
      {open && (
        <ul className="absolute right-0 z-30 mt-1 min-w-[120px] rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
          {items.map((item) => (
            <li key={item.label}>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); item.onClick(); setOpen(false); }}
                className={`w-full px-4 py-2 text-left text-sm transition hover:bg-gray-50 ${item.danger ? "text-red-500" : "text-gray-700"}`}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
