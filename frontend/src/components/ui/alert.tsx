import { CircleAlert, Info } from "lucide-react";
import type * as React from "react";

import { cn } from "@/lib/utils";

export function Alert({
  tone = "danger",
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & { tone?: "danger" | "info" | "warning" }) {
  const Icon = tone === "info" ? Info : CircleAlert;
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2.5 rounded-lg px-3.5 py-3 text-[13px] leading-5",
        tone === "danger" && "bg-danger-bg text-danger",
        tone === "info" && "border border-line bg-surface text-muted",
        tone === "warning" && "bg-warning-bg text-warning",
        className,
      )}
      {...props}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div>{children}</div>
    </div>
  );
}
