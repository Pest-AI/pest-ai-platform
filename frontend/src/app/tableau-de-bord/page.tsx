import {
  ArrowRight,
  ArrowUpRight,
  ChartColumn,
  Check,
  ChevronRight,
  Map as MapIcon,
  MapPin,
  Sprout,
  UsersRound,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell, PageHeader } from "@/components/app-shell";
import { FieldVisual } from "@/components/field-visual";
import { StatusDot } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { currentWorkspace, getApi } from "@/lib/api/client";
import { COOPERATIVE_NAV } from "@/lib/navigation";
import {
  ORGANIZATION_STATUS,
  ORGANIZATION_TYPE_LABELS,
  countSince,
  organizationInitials,
  primaryRoleLabel,
} from "@/lib/spaces";
import { cn } from "@/lib/utils";

import paysage from "../../../public/brand/tableau-paysage.jpg";

export const metadata: Metadata = { title: "Vue d'ensemble" };

const TONES = {
  green: "bg-brand-50 text-brand-700",
  gold: "bg-warning-bg text-[#b07d00]",
  blue: "bg-info-bg text-info",
} as const;

/** Indicateur clé : icône, chiffre, tendance et accès au module. */
function KpiCard({
  icon: Icon,
  tone,
  label,
  value,
  unit,
  trend,
  hint,
  href,
}: {
  icon: LucideIcon;
  tone: keyof typeof TONES;
  label: string;
  value: string;
  unit?: string;
  trend?: string;
  hint?: string;
  href?: string;
}) {
  const body = (
    <>
      <span className={cn("grid size-11 shrink-0 place-items-center rounded-2xl sm:size-12", TONES[tone])}>
        <Icon className="size-6" aria-hidden />
      </span>
      <span className="min-w-0 flex-1 max-sm:w-full">
        <span className={cn("block truncate text-[13px] font-medium text-muted sm:text-[14px]", href && "sm:pr-8")}>{label}</span>
        <span className="tabular mt-0.5 block font-display text-[24px] leading-8 font-bold tracking-[-0.02em] sm:text-[28px] sm:leading-9">
          {value}
          {unit && value !== "—" ? <span className="ml-1 text-[18px] sm:text-[22px]">{unit}</span> : null}
        </span>
        {trend ? (
          <span className="mt-0.5 flex items-center gap-1 text-[12px] font-medium whitespace-nowrap text-success">
            <ArrowUpRight className="size-3.5" aria-hidden />
            {trend}
          </span>
        ) : hint ? (
          <span className="mt-0.5 block truncate text-[12px] text-muted">{hint}</span>
        ) : null}
      </span>
      {href ? (
        <span className="absolute top-3 right-3 grid size-8 place-items-center rounded-full bg-surface text-ink transition-colors group-hover:bg-brand-50 group-hover:text-brand-700 max-sm:hidden">
          <ArrowRight className="size-4" aria-hidden />
        </span>
      ) : null}
    </>
  );
  const cls =
    "group relative flex flex-col items-start gap-3 rounded-2xl border border-line bg-canvas p-4 shadow-[0_8px_24px_-12px_rgb(11_25_41/0.15)] sm:flex-row sm:items-center sm:gap-4 sm:p-5";
  return href ? (
    <Link href={href} className={cn(cls, "transition-shadow hover:shadow-pop")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

type Step = { label: string; done: boolean; href?: string };

export default async function DashboardPage() {
  const workspace = await currentWorkspace();
  if (!workspace) redirect("/espaces");

  const api = await getApi();
  const header = { "X-Workspace": workspace };
  const [{ data: me }, orgResult, membersResult] = await Promise.all([
    api.GET("/api/v1/me/"),
    api.GET("/api/v1/organization/", { params: { header } }),
    api.GET("/api/v1/memberships/", { params: { header } }),
  ]);
  if (!me) redirect("/connexion?erreur=session");
  if (!orgResult.data) redirect("/espaces?erreur=acces");

  const org = orgResult.data;
  const roles = me.memberships.find((m) => m.workspace === workspace)?.roles ?? [];
  const status = ORGANIZATION_STATUS[org.status] ?? { label: org.status, tone: "neutral" as const };
  const list = membersResult.data?.results;
  const partial = Boolean(membersResult.data?.next);
  const active = list ? list.filter((m) => m.status === "active") : null;
  const newThisWeek = active ? countSince(active.map((m) => m.joined_at), 7) : 0;
  const invited = list ? list.filter((m) => m.status === "invited").length : 0;
  const typeLabel = ORGANIZATION_TYPE_LABELS[org.organization_type] ?? org.organization_type;

  const steps: Step[] = [
    { label: "Créer l'organisation", done: true },
    { label: "Inviter l'équipe", done: (list?.length ?? 0) > 1, href: "/equipe" },
    { label: "Enregistrer les producteurs", done: false },
    { label: "Cartographier les parcelles", done: false },
  ];

  return (
    <AppShell
      nav={COOPERATIVE_NAV}
      activeHref="/tableau-de-bord"
      workspace={{ name: org.short_name || org.name, roleLabel: typeLabel, initials: organizationInitials(org.name) }}
      user={{ firstName: me.first_name, lastName: me.last_name, roleLabel: primaryRoleLabel(roles) }}
      breadcrumbs={[org.short_name || org.name, "Vue d'ensemble"]}
      backdrop={
        <>
          <div className="absolute inset-y-0 right-0 w-full [mask-image:linear-gradient(90deg,transparent_15%,#000_65%)] max-md:opacity-50 md:w-[72%]">
            <Image
              src={paysage}
              alt=""
              fill
              priority
              placeholder="blur"
              sizes="(min-width: 768px) 60vw, 100vw"
              className="object-cover object-[center_62%]"
            />
          </div>
          <div aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,transparent_45%,var(--color-surface)_92%)]" />
        </>
      }
    >
      <PageHeader
        overline={typeLabel}
        title={`Bonjour ${me.first_name} 👋`}
        description="Voici un aperçu de votre espace PEST AI OS."
      />

      <div className="mt-7 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <KpiCard
          icon={Sprout}
          tone="green"
          label="Membres actifs"
          value={active === null ? "—" : `${active.length}${partial ? "+" : ""}`}
          trend={newThisWeek ? `+${newThisWeek} cette semaine` : undefined}
          hint={active === null ? "Réservé aux gérants" : invited ? `${invited} invitation${invited > 1 ? "s" : ""} en attente` : undefined}
          href="/equipe"
        />
        <KpiCard icon={MapIcon} tone="gold" label="Parcelles AgroID" value="—" hint="Bientôt disponible" />
        <KpiCard icon={ChartColumn} tone="green" label="Surface suivie" value="—" unit="ha" hint="Bientôt disponible" />
        <KpiCard icon={UsersRound} tone="blue" label="Producteurs" value="—" hint="Bientôt disponible" />
      </div>

      <div className="mt-5 grid gap-4 lg:mt-6 lg:grid-cols-[1fr_360px] lg:gap-5">
        <Card className="flex flex-col overflow-hidden rounded-2xl p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-[18px] font-bold">
              <MapPin className="size-5 text-brand-700" aria-hidden />
              Carte des parcelles
            </h2>
            <span
              title="Bientôt disponible"
              className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3.5 py-1.5 text-[13px] font-semibold text-brand-700/70"
            >
              Voir toutes les parcelles
              <ArrowRight className="size-4" aria-hidden />
            </span>
          </div>
          <div className="relative mt-4 min-h-[260px] flex-1 overflow-hidden rounded-xl sm:min-h-[340px] lg:min-h-[380px]">
            <FieldVisual highlight={false} className="absolute inset-0 size-full" />
            <div aria-hidden className="absolute inset-0 bg-night/20" />
            <div className="absolute inset-0 grid place-items-center">
              <span
                title="Disponible avec le registre des parcelles"
                className="inline-flex items-center gap-2.5 rounded-xl bg-forest/95 px-5 py-3 text-[15px] font-semibold text-white shadow-pop"
              >
                <MapIcon className="size-5" aria-hidden />
                Explorer la carte
              </span>
            </div>
            <span className="absolute bottom-3 left-3 inline-flex items-center gap-2 rounded-lg bg-canvas/95 px-3 py-1.5 text-[13px] font-medium shadow-card">
              <span className="size-2 rounded-full bg-gold" aria-hidden />
              Aperçu · aucune parcelle enregistrée
            </span>
          </div>
        </Card>

        <div className="flex flex-col gap-4 lg:gap-5">
          <Card className="rounded-2xl p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-[18px] font-bold">
                <Zap className="size-5 fill-gold text-gold" aria-hidden />
                Vos actions
              </h2>
              <span className="tabular text-[13px] font-semibold text-muted">
                {steps.filter((s) => s.done).length}/{steps.length}
              </span>
            </div>
            <ol className="mt-3 divide-y divide-line">
              {steps.map((step, i) => {
                const content = (
                  <>
                    <span
                      className={cn(
                        "grid size-7 shrink-0 place-items-center rounded-full text-[12px] font-bold",
                        step.done ? "bg-leaf text-white" : "bg-subtle text-muted",
                      )}
                    >
                      {step.done ? <Check className="size-4" aria-label="Fait" /> : i + 1}
                    </span>
                    <span
                      className={cn(
                        "flex-1 text-[14px]",
                        step.done ? "text-muted line-through decoration-line-strong" : "font-medium",
                      )}
                    >
                      {step.label}
                    </span>
                    {step.href ? (
                      <ChevronRight className="size-5 text-ink/60" aria-hidden />
                    ) : !step.done ? (
                      <span className="text-[11px] font-medium text-muted">Bientôt</span>
                    ) : null}
                  </>
                );
                return (
                  <li key={step.label}>
                    {step.href ? (
                      <Link href={step.href} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-3 hover:bg-surface">
                        {content}
                      </Link>
                    ) : (
                      <span className="flex items-center gap-3 py-3">{content}</span>
                    )}
                  </li>
                );
              })}
            </ol>
          </Card>

          <Card className="rounded-2xl p-5">
            <h2 className="text-[18px] font-bold">Votre organisation</h2>
            <div className="mt-4 flex items-center gap-3 border-t border-line pt-4">
              <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-gold font-display text-[14px] font-bold text-night">
                {organizationInitials(org.name)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-[14px] leading-5 font-bold">{org.name}</span>
                <span className="block text-[12px] text-muted">
                  {typeLabel} · {org.country_code === "SN" ? "Sénégal" : org.country_code}
                </span>
              </span>
              <span className="rounded-full bg-success-bg px-2.5 py-1">
                <StatusDot tone={status.tone}>{status.label}</StatusDot>
              </span>
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
