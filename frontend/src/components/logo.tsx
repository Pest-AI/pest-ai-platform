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
  size = "md",
  className,
}: {
  variant?: "mark" | "full";
  inverted?: boolean;
  size?: "md" | "lg";
  className?: string;
}) {
  const lg = size === "lg";
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
    <span className={cn("inline-flex items-center", lg ? "gap-3" : "gap-2.5", className)}>
      <span
        className={cn(
          "grid shrink-0 place-items-center",
          lg ? "size-12 rounded-xl" : "size-8 rounded-lg",
          inverted ? "bg-white" : "bg-transparent",
        )}
      >
        <Image src="/brand/pest-ai-mark.png" alt="" width={280} height={310} className={lg ? "h-9 w-auto" : "h-6 w-auto"} priority />
      </span>
      <span
        className={cn(
          "font-display font-bold tracking-tight",
          lg ? "text-[22px]" : "text-[15px]",
          inverted ? "text-white" : "text-ink",
        )}
      >
        PEST AI <span className={inverted ? "text-gold" : "text-leaf"}>OS</span>
      </span>
    </span>
  );
}
