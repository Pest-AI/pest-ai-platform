import type * as React from "react";

import { cn } from "@/lib/utils";

const FIELD =
  "flex h-11 w-full items-center rounded-lg border border-field bg-canvas text-[15px] text-ink transition-colors focus-within:border-brand-800 focus-within:ring-3 focus-within:ring-gold/35";

/** Champ de saisie, avec un préfixe et un élément de fin facultatifs (indicatif, bouton…). */
export function Input({
  className,
  prefix,
  icon,
  end,
  ...props
}: Omit<React.ComponentProps<"input">, "prefix"> & {
  prefix?: React.ReactNode;
  icon?: React.ReactNode;
  end?: React.ReactNode;
}) {
  return (
    <div className={cn(FIELD, className)}>
      {icon ? (
        <span className="flex h-full items-center pl-3.5 text-muted [&_svg]:size-[18px]" aria-hidden>
          {icon}
        </span>
      ) : null}
      {prefix ? (
        <span className="flex h-full items-center gap-1.5 rounded-l-lg border-r border-line bg-surface px-3 text-[14px] font-medium text-ink">
          {prefix}
        </span>
      ) : null}
      <input
        className="h-full min-w-0 flex-1 bg-transparent px-3 outline-none placeholder:text-muted"
        {...props}
      />
      {end}
    </div>
  );
}
