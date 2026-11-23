import {
  Bell,
  Building2,
  CalendarRange,
  ChartColumn,
  ChevronRight,
  Eye,
  Fingerprint,
  House,
  Layers,
  LayoutGrid,
  Leaf,
  Mail,
  Map,
  Route,
  ScrollText,
  ShieldCheck,
  UsersRound,
  Users,
  Wheat,
} from "lucide-react";
import Link from "next/link";
import type * as React from "react";

import { Logo } from "@/components/logo";
import { LogoutButton } from "@/components/logout-button";
import { MobileNav } from "@/components/mobile-nav";
import { UserMenu } from "@/components/user-menu";
import type { NavIcon, NavSection } from "@/lib/navigation";
import { cn } from "@/lib/utils";

const ICONS: Record<NavIcon, React.ComponentType<{ className?: string }>> = {
  home: LayoutGrid,
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
  team: UsersRound,
};

export type ShellUser = { firstName: string; lastName: string; roleLabel: string };
export type ShellWorkspace = { name: string; roleLabel: string; initials: string; dark?: boolean };

export function initials(first: string, last: string) {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || "?";
}

/** Contenu de la barre latérale (vert forêt), partagé par l'écran large et le tiroir mobile. */
function SidebarContent({ nav, activeHref, user }: { nav: NavSection[]; activeHref: string; user: ShellUser }) {
  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      {/* Feuille décorative */}
      <svg aria-hidden viewBox="0 0 200 200" className="pointer-events-none absolute bottom-24 -left-10 w-64 text-white opacity-[0.05]">
        <path d="M20 180 C 20 90, 90 20, 190 20 C 190 120, 120 180, 20 180Z" fill="currentColor" />
        <path d="M20 180 L 150 60" stroke="#184429" strokeWidth="4" />
      </svg>

      <div className="px-5 pt-6 pb-6">
        <Link href="/espaces" aria-label="Accueil PEST AI OS" className="inline-block rounded-xl">
          <Logo inverted size="lg" />
        </Link>
      </div>

      <nav aria-label="Navigation principale" className="relative flex-1 overflow-y-auto px-3 pb-4">
        {nav.map((section, i) => (
          <div key={section.title ?? i} className="mt-6 first:mt-0">
            {section.title ? (
              <p className="flex items-center gap-3 px-3 pb-2 text-[11px] font-semibold tracking-[0.1em] text-white/50 uppercase">
                {section.title}
                <span aria-hidden className="h-px flex-1 bg-white/10" />
              </p>
            ) : null}
            <ul className="space-y-1">
              {section.items.map((item) => {
                const Icon = ICONS[item.icon];
                const active = item.href === activeHref;
                if (!item.href) {
                  return (
                    <li key={item.label}>
                      <span
                        aria-disabled="true"
                        title="Bientôt disponible"
                        className="flex h-11 cursor-default items-center gap-3 rounded-xl px-3 text-[15px] text-white/55"
                      >
                        <Icon className="size-5 shrink-0" />
                        <span className="flex-1 truncate">{item.label}</span>
                        <span className="sr-only">(bientôt disponible)</span>
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
                        "flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] transition-colors",
                        active
                          ? "bg-leaf font-semibold text-white shadow-[0_6px_16px_-6px_rgb(58_148_66/0.7)]"
                          : "text-white/90 hover:bg-white/[0.08] hover:text-white",
                      )}
                    >
                      <Icon className="size-5 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="relative m-3 flex items-center gap-3 rounded-2xl bg-white/[0.05] px-3 py-3 ring-1 ring-white/10">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-leaf font-display text-[12px] font-bold text-white">
          {initials(user.firstName, user.lastName)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold text-white">
            {user.firstName} {user.lastName}
          </span>
          <span className="block truncate text-[12px] text-white/60">{user.roleLabel}</span>
        </span>
        <LogoutButton onDark />
      </div>
    </div>
  );
}

/**
 * Coquille des espaces de travail.
 * Écran large : barre latérale vert forêt fixe. Petit écran : barre du haut + tiroir.
 * `backdrop` : visuel facultatif affiché en haut de page, derrière l'en-tête (vue d'ensemble).
 */
export function AppShell({
  nav,
  activeHref,
  workspace,
  user,
  breadcrumbs,
  backdrop,
  children,
}: {
  nav: NavSection[];
  activeHref: string;
  workspace: ShellWorkspace;
  user: ShellUser;
  breadcrumbs: string[];
  backdrop?: React.ReactNode;
  children: React.ReactNode;
}) {
  const sidebar = <SidebarContent nav={nav} activeHref={activeHref} user={user} />;
  const home = nav[0]?.items[0]?.href ?? "/espaces";
  return (
    <div className="min-h-dvh lg:pl-[272px]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[272px] bg-forest lg:block">{sidebar}</aside>

      <div className="relative isolate">
        {backdrop ? <div className="absolute inset-x-0 top-0 -z-10 h-[300px] overflow-hidden sm:h-[340px]">{backdrop}</div> : null}

        <header
          className={cn(
            "sticky top-0 z-20 flex h-16 items-center gap-3 px-4 sm:px-6 lg:h-[72px] lg:px-10",
            backdrop ? "bg-transparent" : "border-b border-line bg-canvas/85 backdrop-blur-md",
          )}
        >
          <MobileNav>{sidebar}</MobileNav>
          <Link href={home} aria-label="Accueil de l'espace" className="hidden text-ink/80 hover:text-ink sm:block">
            <House className="size-5" />
          </Link>
          <nav aria-label="Fil d'Ariane" className="flex min-w-0 flex-1 items-center gap-1.5 text-[14px] text-muted">
            {breadcrumbs.map((crumb, i) => {
              const last = i === breadcrumbs.length - 1;
              return (
                <span key={crumb} className={cn("flex min-w-0 items-center gap-1.5", !last && "max-sm:hidden")}>
                  {i > 0 ? <ChevronRight className="size-4 shrink-0 max-sm:hidden" aria-hidden /> : null}
                  <span className={cn("truncate", last && "font-semibold text-ink")} aria-current={last ? "page" : undefined}>
                    {crumb}
                  </span>
                </span>
              );
            })}
          </nav>
          <button
            type="button"
            disabled
            title="Notifications : bientôt disponible"
            aria-label="Notifications (bientôt disponible)"
            className="grid size-10 place-items-center rounded-full bg-canvas/90 text-ink/80 shadow-card ring-1 ring-line backdrop-blur disabled:cursor-default"
          >
            <Bell className="size-5" aria-hidden />
          </button>
          <UserMenu
            initials={initials(user.firstName, user.lastName)}
            name={`${user.firstName} ${user.lastName}`}
            roleLabel={user.roleLabel}
            workspaceName={workspace.name}
          />
        </header>

        <main className="mx-auto w-full max-w-[1240px] px-4 pt-4 pb-10 sm:px-6 lg:px-10 lg:pt-6">{children}</main>
      </div>
    </div>
  );
}

/** En-tête de page : titre court, une ligne de contexte au plus, actions à droite. */
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
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="min-w-0">
        {overline ? (
          <p className="inline-flex rounded-md bg-brand-50 px-2.5 py-1 text-[12px] font-bold tracking-[0.06em] text-brand-700 uppercase ring-1 ring-brand-100">
            {overline}
          </p>
        ) : null}
        <h1 className="mt-2 text-[26px] leading-9 font-bold tracking-[-0.02em] sm:text-[34px] sm:leading-[42px]">{title}</h1>
        {description ? <p className="mt-1.5 max-w-xl text-[15px] text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** Grille d'indicateurs : cartes compactes, un chiffre et une étiquette. */
export function StatRow({ children }: { children: React.ReactNode }) {
  return <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">{children}</div>;
}

const STAT_ICON_TONES = {
  brand: "bg-brand-50 text-brand-700",
  gold: "bg-warning-bg text-[#b07d00]",
  night: "bg-subtle text-night",
} as const;

export function Stat({
  label,
  value,
  unit,
  hint,
  hintTone = "muted",
  icon: Icon,
  iconTone = "brand",
}: {
  label: string;
  value: string;
  unit?: string;
  hint?: string;
  hintTone?: "muted" | "success" | "warning";
  icon?: React.ComponentType<{ className?: string }>;
  iconTone?: keyof typeof STAT_ICON_TONES;
}) {
  return (
    <div className="rounded-2xl border border-line bg-canvas p-4 shadow-card sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13px] font-medium text-muted">{label}</p>
        {Icon ? (
          <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg max-sm:hidden", STAT_ICON_TONES[iconTone])}>
            <Icon className="size-4" aria-hidden />
          </span>
        ) : null}
      </div>
      <p className="tabular mt-2 font-display text-[26px] leading-8 font-bold tracking-[-0.02em] sm:text-[30px] sm:leading-9">
        {value}
        {unit && value !== "—" ? <span className="ml-1 font-sans text-[14px] font-medium text-muted">{unit}</span> : null}
      </p>
      {hint ? (
        <p
          className={cn(
            "mt-1 truncate text-[12px]",
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
