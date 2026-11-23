import type * as React from "react";

import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-lg border border-line bg-white px-3 text-base text-night placeholder:text-muted focus:border-leaf focus:outline-2 focus:outline-leaf-light",
        className,
      )}
      {...props}
    />
  );
}
