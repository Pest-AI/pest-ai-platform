import { Fingerprint } from "lucide-react";

import { cn } from "@/lib/utils";

/** Identifiant AgroID d'une parcelle (élément visuel signature de PEST AI). */
export function AgroIdBadge({
  code,
  tone = "dark",
  className,
}: {
  code: string | null;
  tone?: "dark" | "light";
  className?: string;
}) {
  if (!code) {
    return (
      <span
        className={cn(
          "inline-flex h-6 items-center rounded-md border border-dashed border-line-strong px-2 font-mono text-[12px] text-muted",
          className,
        )}
      >
        En attente
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-md pl-1 pr-2 font-mono text-[12px] font-medium tracking-wide whitespace-nowrap",
        tone === "dark" ? "bg-night text-white" : "bg-brand-50 text-brand-800",
        className,
      )}
    >
      <span
        className={cn(
          "grid size-4 place-items-center rounded-[4px]",
          tone === "dark" ? "bg-gold text-night" : "bg-brand-800 text-white",
        )}
      >
        <Fingerprint className="size-3" aria-hidden />
      </span>
      {code}
    </span>
  );
}
