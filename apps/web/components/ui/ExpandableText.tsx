"use client";

import { useState } from "react";

export function ExpandableText({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  if (!text) return null;
  const long = text.length > 50;
  return (
    <div>
      <p
        className={`${open || !long ? "whitespace-pre-wrap" : "line-clamp-2"} ${className}`}
      >
        {text}
      </p>
      {long && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="text-primary-600 mt-0.5 text-xs font-medium hover:underline"
        >
          {open ? "收合" : "顯示更多"}
        </button>
      )}
    </div>
  );
}
