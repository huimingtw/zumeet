"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

export function Dropdown({
  value,
  placeholder,
  options,
  onChange,
  disabled = false,
}: {
  value: string;
  placeholder: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);
  const listId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Reset active index when list closes
  useEffect(() => {
    if (!open) setActiveIdx(-1);
  }, [open]);

  const select = useCallback(
    (val: string) => {
      onChange(val);
      setOpen(false);
      triggerRef.current?.focus();
    },
    [onChange]
  );

  function onKeyDown(e: React.KeyboardEvent) {
    if (disabled) return;
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setOpen(true);
        setActiveIdx(options.findIndex((o) => o.value === value));
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActiveIdx(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActiveIdx(options.length - 1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (activeIdx >= 0 && activeIdx < options.length) {
        select(options[activeIdx].value);
      }
    }
  }

  const activeOptionId =
    open && activeIdx >= 0 ? `${listId}-opt-${activeIdx}` : undefined;

  return (
    <div ref={ref} className="relative" onKeyDown={onKeyDown}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={activeOptionId}
        onClick={() => setOpen((v) => !v)}
        className={`input flex w-full items-center justify-between text-left ${
          disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
        } ${value ? "text-gray-900" : "text-gray-400"}`}
      >
        <span className="truncate">
          {value ? (options.find((o) => o.value === value)?.label ?? value) : placeholder}
        </span>
        <ChevronDown
          size={16}
          strokeWidth={1.5}
          className={`ml-2 flex-shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label={placeholder}
          className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white py-1 shadow-lg"
        >
          {options.map((opt, idx) => (
            <li
              key={opt.value}
              id={`${listId}-opt-${idx}`}
              role="option"
              aria-selected={opt.value === value}
              onMouseEnter={() => setActiveIdx(idx)}
              onClick={() => select(opt.value)}
              className={`cursor-default px-4 py-2 text-sm transition ${
                idx === activeIdx ? "bg-gray-50" : ""
              } ${
                opt.value === value
                  ? "text-primary-600 font-medium"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
