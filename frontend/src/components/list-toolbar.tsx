import { LayoutGrid, Search, Table2 } from "lucide-react";
import Link from "next/link";
import type * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Carte de filtres d'une liste (maquette AI Studio) : recherche, compteur,
 * bascule Tableau / Cartes, puis une rangée de filtres. Formulaire GET : l'état est dans l'URL.
 */
export function ListToolbar({
  action,
  q,
  placeholder,
  count,
  total,
  noun,
  view,
  viewHref,
  hidden,
  filters,
}: {
  action: string;
  q: string;
  placeholder: string;
  count: number;
  total: number;
  noun: string;
  view?: "tableau" | "cartes";
  viewHref?: (view: "tableau" | "cartes") => string;
  hidden?: Record<string, string>;
  filters?: React.ReactNode;
}) {
  return (
    <form
      action={action}
      role="search"
      className="mt-5 space-y-3 rounded-2xl border border-line bg-canvas p-3.5 shadow-[0_2px_10px_-4px_rgb(11_25_41/0.06)]"
    >
      {Object.entries(hidden ?? {}).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div className="relative max-w-md flex-1">
          <label htmlFor="list-q" className="sr-only">
            Rechercher
          </label>
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            id="list-q"
            name="q"
            defaultValue={q}
            placeholder={placeholder}
            className="h-10 w-full rounded-xl border border-line bg-surface pr-3 pl-10 text-[14px] placeholder:text-muted focus:border-leaf focus:bg-canvas focus:ring-2 focus:ring-leaf/15 focus:outline-none"
          />
        </div>
        <div className="flex items-center justify-between gap-3 md:justify-end">
          <span className="text-[13px] text-muted">
            <strong className="tabular font-mono font-semibold text-ink">{count}</strong> sur{" "}
            <span className="tabular font-mono">{total}</span> {noun}
          </span>
          {view && viewHref ? (
            <span className="inline-flex rounded-xl bg-subtle p-1">
              {(
                [
                  ["tableau", "Tableau", Table2],
                  ["cartes", "Cartes", LayoutGrid],
                ] as const
              ).map(([key, label, Icon]) => (
                <Link
                  key={key}
                  href={viewHref(key)}
                  aria-current={view === key ? "true" : undefined}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors",
                    view === key ? "bg-canvas text-forest shadow-card" : "text-muted hover:text-ink",
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                  {label}
                </Link>
              ))}
            </span>
          ) : null}
        </div>
      </div>
      {filters ? <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">{filters}</div> : null}
    </form>
  );
}

/** Pastille de statut avec point (maquette AI Studio). */
export function StatusPill({
  tone,
  children,
}: {
  tone: "success" | "warning" | "danger" | "neutral";
  children: React.ReactNode;
}) {
  const styles = {
    success: "border-brand-100 bg-brand-50 text-success",
    warning: "border-gold/40 bg-warning-bg text-[#8a5a00]",
    danger: "border-danger/20 bg-danger-bg text-danger",
    neutral: "border-line bg-subtle text-muted",
  }[tone];
  const dot = { success: "bg-leaf", warning: "bg-gold", danger: "bg-danger", neutral: "bg-line-strong" }[tone];
  return (
    <span className={cn("inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-[12px] font-semibold whitespace-nowrap", styles)}>
      <span aria-hidden className={cn("size-1.5 rounded-full", dot)} />
      {children}
    </span>
  );
}
