import {
  Building2,
  CalendarRange,
  ChartColumn,
  ChevronRight,
  ChevronsUpDown,
  Eye,
  Fingerprint,
  House,
  Layers,
  Leaf,
  Mail,
  Map,
  Route,
  ScrollText,
  ShieldCheck,
  Users,
  Wheat,
} from "lucide-react";
import Link from "next/link";
import type * as React from "react";

import { Logo } from "@/components/logo";
import { LogoutButton } from "@/components/logout-button";
import type { NavIcon, NavSection } from "@/lib/navigation";
import { cn } from "@/lib/utils";

const ICONS: Record<NavIcon, React.ComponentType<{ className?: string }>> = {
  home: House,
  fingerprint: Fingerprint,
  users: Users,
  layers: Layers,
  calendar: CalendarRange,
  wheat: Wheat,
  route: Route,
  eye: Eye,
  leaf: Leaf,
  chart: ChartColumn,
  building: Building2,
  mail: Mail,
  shield: ShieldCheck,
  scroll: ScrollText,
  map: Map,
};

export type ShellUser = { firstName: string; lastName: string; roleLabel: string };
export type ShellWorkspace = { name: string; roleLabel: string; initials: string; dark?: boolean };

function initials(first: string, last: string) {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || "?";
}

/** Coquille des espaces de travail : navigation latérale claire + barre du haut. */
export function AppShell({
  nav,
  activeHref,
  workspace,
  user,
  breadcrumbs,
  children,
}: {
  nav: NavSection[];
  activeHref: string;
  workspace: ShellWorkspace;
  user: ShellUser;
  breadcrumbs: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <aside className="flex shrink-0 flex-col border-b border-line bg-canvas lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:border-r lg:border-b-0">
        <div className="px-5 pt-5 pb-4">
          <Link href="/espaces" aria-label="Accueil PEST AI OS">
            <Logo />
          </Link>
        </div>

        <div className="px-3">
          <Link
            href="/espaces"
            className="flex items-center gap-2.5 rounded-lg border border-line bg-surface px-2.5 py-2 transition-colors hover:border-line-strong"
          >
            <span
              className={cn(
                "grid size-8 shrink-0 place-items-center rounded-md text-[12px] font-semibold",
                workspace.dark ? "bg-night text-gold" : "bg-brand-50 text-brand-800",
              )}
            >
              {workspace.initials}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold">{workspace.name}</span>
              <span className="block truncate text-[12px] text-muted">{workspace.roleLabel}</span>
            </span>
            <ChevronsUpDown className="size-4 shrink-0 text-muted" aria-label="Changer d'espace" />
          </Link>
        </div>

        <nav aria-label="Navigation principale" className="mt-3 flex-1 overflow-y-auto px-3 pb-4">
          {nav.map((section, i) => (
            <div key={section.title ?? i} className="mt-3 first:mt-0">
              {section.title ? (
                <p className="px-2.5 pt-2 pb-1.5 text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">
                  {section.title}
                </p>
              ) : null}
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = ICONS[item.icon];
                  const active = item.href === activeHref;
                  if (!item.href) {
                    return (
                      <li key={item.label}>
                        <span
                          aria-disabled="true"
                          className="flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[14px] text-muted/70"
                        >
                          <Icon className="size-4 shrink-0" />
                          <span className="flex-1 truncate">{item.label}</span>
                          <span className="text-[10px] font-medium tracking-wide uppercase">Bientôt</span>
                        </span>
                      </li>
                    );
                  }
                  return (
                    <li key={item.label}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[14px] transition-colors",
                          active
                            ? "bg-brand-50 font-semibold text-brand-800"
                            : "text-ink hover:bg-subtle",
                        )}
                      >
                        <Icon className={cn("size-4 shrink-0", active ? "text-brand-800" : "text-muted")} />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="flex items-center gap-2.5 border-t border-line px-4 py-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-800 text-[12px] font-semibold text-white">
            {initials(user.firstName, user.lastName)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold">
              {user.firstName} {user.lastName}
            </span>
            <span className="block truncate text-[12px] text-muted">{user.roleLabel}</span>
          </span>
          <LogoutButton />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center border-b border-line bg-canvas/80 px-6 backdrop-blur lg:px-8">
          <nav aria-label="Fil d'Ariane" className="flex items-center gap-1.5 text-[13px] text-muted">
            {breadcrumbs.map((crumb, i) => (
              <span key={crumb} className="flex items-center gap-1.5">
                {i > 0 ? <ChevronRight className="size-3.5" aria-hidden /> : null}
                <span className={i === breadcrumbs.length - 1 ? "font-medium text-ink" : undefined}>{crumb}</span>
              </span>
            ))}
          </nav>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

/** En-tête de page : sur-titre, titre, description et actions. */
export function PageHeader({
  overline,
  title,
  description,
  actions,
}: {
  overline?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {overline ? <p className="text-[13px] font-medium text-muted">{overline}</p> : null}
        <h1 className="mt-0.5 text-[28px] leading-9 font-bold tracking-[-0.02em]">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-[14px] text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** Rangée d'indicateurs séparés par des filets (style du Design System). */
export function StatRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-6 grid grid-cols-2 gap-y-2 border-y border-line lg:grid-cols-4">
      {children}
    </div>
  );
}

export function Stat({
  label,
  value,
  unit,
  hint,
  hintTone = "muted",
}: {
  label: string;
  value: string;
  unit?: string;
  hint?: string;
  hintTone?: "muted" | "success" | "warning";
}) {
  return (
    <div className="border-line py-4 pr-4 lg:border-l lg:pl-5 lg:first:border-l-0 lg:first:pl-0">
      <p className="text-[13px] text-muted">{label}</p>
      <p className="tabular mt-1 font-display text-[26px] leading-8 font-bold tracking-[-0.02em]">
        {value}
        {unit ? <span className="ml-1 font-sans text-[14px] font-normal text-muted">{unit}</span> : null}
      </p>
      {hint ? (
        <p
          className={cn(
            "mt-0.5 text-[12px]",
            hintTone === "success" && "text-success",
            hintTone === "warning" && "text-warning",
            hintTone === "muted" && "text-muted",
          )}
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}
