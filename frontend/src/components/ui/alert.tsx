import type * as React from "react";

import { cn } from "@/lib/utils";

export function Alert({
  tone = "danger",
  className,
  ...props
}: React.ComponentProps<"p"> & { tone?: "danger" | "info" }) {
  return (
    <p
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "rounded-lg px-4 py-3 text-sm",
        tone === "danger" ? "bg-danger-light text-danger" : "bg-leaf-light text-forest",
        className,
      )}
      {...props}
    />
  );
}
