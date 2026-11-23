import { Sprout } from "lucide-react";

import { cn } from "@/lib/utils";

/** Marque PEST AI OS (provisoire, en attendant le logo officiel). */
export function Brand({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-bold", className)}>
      <span className="grid size-9 place-items-center rounded-lg bg-sun text-forest">
        <Sprout className="size-5" aria-hidden />
      </span>
      <span className={cn("text-lg tracking-tight", inverted ? "text-white" : "text-forest")}>
        PEST AI <span className={inverted ? "text-sun" : "text-leaf"}>OS</span>
      </span>
    </span>
  );
}
