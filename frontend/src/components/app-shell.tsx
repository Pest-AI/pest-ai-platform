import {
  Bell,
  Building2,
  ChevronDown,
  ChevronsUpDown,
  CircleHelp,
  Search,
  Settings,
  CalendarRange,
  ChartColumn,
  Eye,
  Fingerprint,
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
import Image from "next/image";
import Link from "next/link";
import type * as React from "react";

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
function SidebarContent({
  nav,
  activeHref,
  workspace,
  spaceLabel,
}: {
  nav: NavSection[];
  activeHref: string;
  workspace: ShellWorkspace;
  spaceLabel: string;
}) {
  const items = nav.flatMap((section) => section.items);
  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      <div className="flex h-16 items-center px-4">
        <Link href="/espaces" aria-label="Accueil PEST AI OS" className="flex min-w-0 items-center gap-2.5 rounded-xl">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white p-1 shadow-card">
            <Image src="/brand/pest-ai-mark.png" alt="" width={280} height={310} className="h-6 w-auto" priority />
          </span>
          <span className="min-w-0">
            <span className="block font-display text-[16px] leading-none font-bold tracking-tight text-white">
              PEST AI <span className="text-gold">OS</span>
            </span>
            <span className="mt-1 block truncate text-[12px] leading-none text-white/65">{spaceLabel}</span>
          </span>
        </Link>
      </div>

      <Link
        href="/espaces"
        className="group mx-3 mb-3 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2.5 transition-colors hover:bg-white/[0.1]"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] text-white/60">Périmètre actif</span>
          <span className="mt-0.5 block truncate text-[13px] font-semibold text-white">{workspace.name}</span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-white/50 group-hover:text-white/80" aria-label="Changer d'espace" />
      </Link>

      <nav aria-label="Navigation principale" className="flex-1 overflow-y-auto px-3 pb-4">
        <ul className="space-y-1">
          {items.map((item) => {
            const Icon = ICONS[item.icon];
            const active = item.href === activeHref;
            if (!item.href) {
              return (
                <li key={item.label}>
                  <span
                    aria-disabled="true"
                    title="Bientôt disponible"
                    className="flex h-11 cursor-default items-center gap-3 rounded-xl px-3 text-[14px] font-medium text-white/45"
                  >
                    <Icon className="size-[18px] shrink-0" />
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
                    "flex h-11 items-center gap-3 rounded-xl px-3 text-[14px] transition-colors",
                    active
                      ? "bg-white font-semibold text-forest shadow-card"
                      : "font-medium text-white/85 hover:bg-white/[0.08] hover:text-white",
                  )}
                >
                  <Icon className={cn("size-[18px] shrink-0", active ? "text-leaf" : "text-white/65")} />
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="space-y-0.5 border-t border-white/10 p-3">
        <a
          href="https://docs.pestai.africa"
          target="_blank"
          rel="noreferrer"
          className="flex h-10 items-center gap-3 rounded-xl px-3 text-[13px] text-white/75 transition-colors hover:bg-white/[0.08] hover:text-white"
        >
          <CircleHelp className="size-4 shrink-0 text-white/60" aria-hidden />
          Aide et support
        </a>
        <span
          aria-disabled="true"
          title="Bientôt disponible"
          className="flex h-10 cursor-default items-center gap-3 rounded-xl px-3 text-[13px] text-white/45"
        >
          <Settings className="size-4 shrink-0" aria-hidden />
          Paramètres
        </span>
      </div>
    </div>
  );
}

/**
 * Coquille des espaces de travail (structure de la maquette AI Studio).
 * Écran large : barre latérale vert forêt fixe. Petit écran : barre du haut + tiroir.
 * `backdrop` : visuel facultatif affiché en haut de page, sous la barre du haut (vue d'ensemble).
 * `search` : recherche globale de la barre du haut (formulaire GET vers une page de liste).
 */
export function AppShell({
  nav,
  activeHref,
  workspace,
  user,
  breadcrumbs,
  backdrop,
  spaceLabel,
  search = { action: "/producteurs", placeholder: "Rechercher un producteur, un village, un téléphone…" },
  children,
}: {
  nav: NavSection[];
  activeHref: string;
  workspace: ShellWorkspace;
  user: ShellUser;
  breadcrumbs: string[];
  backdrop?: React.ReactNode;
  spaceLabel?: string;
  search?: { action: string; placeholder: string } | null;
  children: React.ReactNode;
}) {
  const label = spaceLabel ?? `Espace ${workspace.roleLabel}`;
  const sidebar = <SidebarContent nav={nav} activeHref={activeHref} workspace={workspace} spaceLabel={label} />;
  return (
    <div className="min-h-dvh lg:pl-[256px]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[256px] bg-forest lg:block">{sidebar}</aside>

      <div className="relative isolate">
        {backdrop ? <div className="absolute inset-x-0 top-0 -z-10 h-[300px] overflow-hidden sm:h-[340px]">{backdrop}</div> : null}

        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-canvas/90 px-4 backdrop-blur-md sm:px-6 lg:px-8">
          <MobileNav>{sidebar}</MobileNav>
          <Link
            href="/espaces"
            className="flex min-w-0 shrink items-center gap-2 rounded-xl px-2 py-1.5 transition-colors hover:bg-surface"
            title="Changer d'espace"
          >
            <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-brand-50 text-forest">
              <Building2 className="size-4" aria-hidden />
            </span>
            <span className="truncate text-[14px] font-semibold">{workspace.name}</span>
            <span className="hidden truncate text-[13px] text-muted xl:inline">/ {breadcrumbs.at(-1)}</span>
            <ChevronDown className="size-4 shrink-0 text-muted" aria-hidden />
          </Link>

          <div className="flex min-w-0 flex-1 justify-center">
            {search ? (
              <form action={search.action} role="search" className="relative hidden w-full max-w-lg md:block">
                <label htmlFor="global-search" className="sr-only">
                  Recherche
                </label>
                <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" aria-hidden />
                <input
                  id="global-search"
                  name="q"
                  placeholder={search.placeholder}
                  className="h-10 w-full rounded-xl border border-transparent bg-subtle pr-3 pl-10 text-[14px] transition-colors placeholder:text-muted hover:bg-[#e8eeea] focus:border-leaf/50 focus:bg-canvas focus:ring-2 focus:ring-leaf/15 focus:outline-none"
                />
              </form>
            ) : null}
          </div>

          <button
            type="button"
            disabled
            title="Notifications : bientôt disponible"
            aria-label="Notifications (bientôt disponible)"
            className="grid size-10 shrink-0 place-items-center rounded-xl bg-subtle text-ink/80 disabled:cursor-default"
          >
            <Bell className="size-[18px]" aria-hidden />
          </button>
          <UserMenu
            initials={initials(user.firstName, user.lastName)}
            name={`${user.firstName} ${user.lastName}`}
            roleLabel={user.roleLabel}
            workspaceName={workspace.name}
          />
        </header>

        <main className="mx-auto w-full max-w-[1280px] px-4 pt-5 pb-10 sm:px-6 lg:px-8 lg:pt-6">{children}</main>
      </div>
    </div>
  );
}

/** En-tête de page (maquette AI Studio) : ligne de contexte, titre, sous-titre, actions à droite. */
export function PageHeader({
  overline,
  context,
  title,
  description,
  actions,
}: {
  overline?: string;
  context?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
      <div className="min-w-0">
        {overline ? (
          <p className="inline-flex rounded-md bg-brand-50 px-2.5 py-1 text-[12px] font-bold tracking-[0.06em] text-brand-700 uppercase ring-1 ring-brand-100">
            {overline}
          </p>
        ) : null}
        {context ? <p className="truncate text-[12px] font-medium text-muted">{context}</p> : null}
        <h1 className={cn("text-[26px] leading-8 font-bold sm:text-[28px] sm:leading-9", (overline || context) && "mt-1")}>
          {title}
        </h1>
        {description ? <p className="mt-1 max-w-2xl text-[14px] text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** Grille d'indicateurs (maquette AI Studio) : 2 colonnes sur mobile, 4 sur grand écran. */
export function StatRow({ children }: { children: React.ReactNode }) {
  return <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-3.5">{children}</div>;
}

const STAT_ICON_TONES = {
  brand: "bg-brand-50 text-forest",
  gold: "bg-warning-bg text-[#b07d00]",
  night: "bg-subtle text-night",
} as const;

const STAT_VALUE_TONES = {
  ink: "text-ink",
  success: "text-leaf",
  warning: "text-[#b07d00]",
  forest: "text-forest",
} as const;

/** Indicateur : étiquette, chiffre (police à chasse fixe), précision, icône à droite. */
export function Stat({
  label,
  value,
  unit,
  hint,
  hintTone = "muted",
  valueTone = "ink",
  icon: Icon,
  iconTone = "brand",
  href,
}: {
  label: string;
  value: string;
  unit?: string;
  hint?: string;
  hintTone?: "muted" | "success" | "warning";
  valueTone?: keyof typeof STAT_VALUE_TONES;
  icon?: React.ComponentType<{ className?: string }>;
  iconTone?: keyof typeof STAT_ICON_TONES;
  href?: string;
}) {
  const cls = cn(
    "flex items-start justify-between gap-3 rounded-2xl border border-line bg-canvas p-4 shadow-[0_2px_10px_-4px_rgb(11_25_41/0.06)] sm:p-5",
    href && "transition-colors hover:border-leaf/40 hover:shadow-pop",
  );
  const content = (
    <>
      <div className="min-w-0">
        <p className="text-[12px] leading-4 font-semibold text-muted sm:truncate sm:text-[13px]">{label}</p>
        <p
          className={cn(
            "tabular mt-2 font-mono text-[24px] leading-none font-semibold sm:text-[28px]",
            STAT_VALUE_TONES[valueTone],
          )}
        >
          {value}
          {unit && value !== "—" ? <span className="ml-1 text-[16px] font-medium text-muted">{unit}</span> : null}
        </p>
        {hint ? (
          <p
            className={cn(
              "mt-2 text-[12px] leading-4 sm:truncate",
              hintTone === "success" && "font-medium text-leaf",
              hintTone === "warning" && "font-medium text-[#b07d00]",
              hintTone === "muted" && "text-muted",
            )}
          >
            {hint}
          </p>
        ) : null}
      </div>
      {Icon ? (
        <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl max-sm:hidden", STAT_ICON_TONES[iconTone])}>
          <Icon className="size-[18px]" aria-hidden />
        </span>
      ) : null}
    </>
  );
  return href ? (
    <Link href={href} className={cls}>
      {content}
    </Link>
  ) : (
    <div className={cls}>{content}</div>
  );
}
