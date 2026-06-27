import { type ReactNode } from "react";

type Tone = "brand" | "success" | "warning" | "neutral";

const TONES: Record<Tone, string> = {
  brand: "bg-primary-100 text-primary-700",
  success: "bg-success-50 text-success-600",
  warning: "bg-warning-50 text-warning-800",
  neutral: "bg-gray-100 text-gray-500",
};

export function Badge({
  tone = "neutral",
  className = "",
  children,
}: {
  tone?: Tone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
