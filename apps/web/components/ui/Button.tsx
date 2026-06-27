"use client";

import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
}

const BASE =
  "inline-flex items-center justify-center rounded-lg font-medium transition disabled:opacity-40";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-primary-600 hover:bg-primary-500 text-white",
  secondary: "border border-gray-200 text-gray-700 hover:bg-gray-50",
  danger: "bg-red-600 hover:bg-red-500 text-white",
};

const SIZES: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2.5 text-sm",
  lg: "w-full py-3 text-sm",
};

export function Button({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className = "",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={[
        BASE,
        VARIANTS[variant],
        SIZES[size],
        fullWidth ? "w-full" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {children}
    </button>
  );
}
