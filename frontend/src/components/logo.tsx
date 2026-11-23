import Image from "next/image";

import { cn } from "@/lib/utils";

/**
 * Logo officiel PEST AI.
 * - `mark` : symbole « P » seul (navigation, favicon), suivi du nom « PEST AI OS ».
 * - `full` : logo complet (symbole + « PEST AI »).
 * Règles d'usage : Design System PEST AI OS (ne pas recolorer ni déformer le logo).
 */
export function Logo({
  variant = "mark",
  inverted = false,
  className,
}: {
  variant?: "mark" | "full";
  inverted?: boolean;
  className?: string;
}) {
  if (variant === "full") {
    return (
      <Image
        src="/brand/pest-ai-logo.png"
        alt="PEST AI"
        width={340}
        height={391}
        className={cn("h-20 w-auto", className)}
        priority
      />
    );
  }
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-lg",
          inverted ? "bg-white" : "bg-transparent",
        )}
      >
        <Image src="/brand/pest-ai-mark.png" alt="" width={280} height={310} className="h-6 w-auto" priority />
      </span>
      <span
        className={cn(
          "font-display text-[15px] font-bold tracking-tight",
          inverted ? "text-white" : "text-ink",
        )}
      >
        PEST AI <span className={inverted ? "text-gold" : "text-leaf"}>OS</span>
      </span>
    </span>
  );
}
