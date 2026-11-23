import type * as React from "react";

import { cn } from "@/lib/utils";

const TONES = {
  neutral: "bg-subtle text-ink",
  brand: "bg-brand-50 text-brand-800",
  success: "bg-success-bg text-success",
  warning: "bg-warning-bg text-warning",
  danger: "bg-danger-bg text-danger",
  info: "bg-info-bg text-info",
  dark: "bg-night text-white",
} as const;

export type BadgeTone = keyof typeof TONES;

export function Badge({
  tone = "neutral",
  className,
  ...props
}: React.ComponentProps<"span"> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-md px-2 text-[12px] font-medium whitespace-nowrap [&_svg]:size-3.5",
        TONES[tone],
        className,
      )}
      {...props}
    />
  );
}

/** Statut avec pastille de couleur (Active, En attente…). */
export function StatusDot({ tone, children }: { tone: "success" | "warning" | "danger" | "neutral"; children: React.ReactNode }) {
  const dot = { success: "bg-leaf", warning: "bg-gold", danger: "bg-danger", neutral: "bg-line-strong" }[tone];
  const text = { success: "text-success", warning: "text-warning", danger: "text-danger", neutral: "text-muted" }[tone];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[13px] font-medium whitespace-nowrap", text)}>
      <span className={cn("size-1.5 rounded-full", dot)} aria-hidden />
      {children}
    </span>
  );
}
