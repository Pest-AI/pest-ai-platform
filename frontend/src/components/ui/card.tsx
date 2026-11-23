import type * as React from "react";

import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("rounded-xl border border-line bg-canvas shadow-card", className)} {...props} />;
}

/** Libellé de section en petites capitales (style du Design System). */
export function SectionLabel({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      className={cn("font-sans text-[11px] font-semibold tracking-[0.08em] text-muted uppercase", className)}
      {...props}
    />
  );
}
