import {
  ArrowRight,
  ChartColumn,
  Check,
  Clock3,
  Map as MapIcon,
  SlidersHorizontal,
  Sprout,
  UserPlus,
  UsersRound,
} from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell, PageHeader, Stat, StatRow } from "@/components/app-shell";
import { StatusPill } from "@/components/list-toolbar";
import { ParcelMap } from "@/components/parcel-map";
import { Card } from "@/components/ui/card";
import { currentWorkspace, getApi } from "@/lib/api/client";
import { COOPERATIVE_NAV } from "@/lib/navigation";
import { formatPhone } from "@/lib/phone";
import { producerInitials } from "@/lib/producers";
import { ORGANIZATION_TYPE_LABELS, countSince, formatDate, organizationInitials, primaryRoleLabel } from "@/lib/spaces";
import { cn } from "@/lib/utils";

import paysage from "../../../public/brand/tableau-paysage.jpg";

export const metadata: Metadata = { title: "Vue d'ensemble" };

/** Cadrage par défaut : vallée du fleuve Sénégal (Podor). Le cadrage suivra les parcelles (J14). */
const DEFAULT_VIEW = { center: [-14.96, 16.65] as [number, number], zoom: 10 };

/** Filtres de la carte, branchés au fil des modules du MVP. */
const MAP_FILTERS = [
  ["Campagne", "toutes", "Campagnes (J16)"],
  ["Culture", "toutes", "Cultures (J16)"],
  ["Zone", "toutes", "Zones géographiques"],
  ["Statut", "tous", "Registre des parcelles (J11)"],
  ["Producteur", "tous", "Registre des parcelles (J11)"],
] as const;

type Step = { label: string; done: boolean; href?: string };

/** Mise en route : bandeau compact, affiché tant que toutes les étapes ne sont pas faites. */
function Onboarding({ steps }: { steps: Step[] }) {
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;
  return (
    <section
      aria-label="Mise en route"
      className="mt-4 flex flex-col gap-3 rounded-2xl border border-line bg-canvas p-3.5 shadow-[0_2px_10px_-4px_rgb(11_25_41/0.06)] lg:flex-row lg:items-center"
    >
      <div className="flex shrink-0 items-center gap-3 lg:w-48">
        <span className="relative grid size-10 place-items-center">
          <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90" aria-hidden>
            <circle cx="18" cy="18" r="15" fill="none" stroke="var(--color-subtle)" strokeWidth="4" />
            <circle
              cx="18"
              cy="18"
              r="15"
              fill="none"
              stroke="var(--color-leaf)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={`${(done / steps.length) * 94.2} 94.2`}
            />
          </svg>
          <span className="tabular font-mono text-[11px] font-semibold">
            {done}/{steps.length}
          </span>
        </span>
        <span>
          <span className="block text-[14px] font-semibold">Mise en route</span>
          <span className="block text-[12px] text-muted">Vos prochaines étapes</span>
        </span>
      </div>
      <ol className="grid flex-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {steps.map((step, i) => {
          const body = (
            <>
              <span
                className={cn(
                  "grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold",
                  step.done ? "bg-leaf text-white" : "bg-subtle text-muted",
                )}
              >
                {step.done ? <Check className="size-3.5" aria-label="Fait" /> : i + 1}
              </span>
              <span className={cn("min-w-0 flex-1 truncate text-[13px]", step.done ? "text-muted line-through" : "font-semibold")}>
                {step.label}
              </span>
              {!step.done ? (
                step.href ? (
                  <ArrowRight className="size-4 shrink-0 text-leaf" aria-hidden />
                ) : (
                  <span className="shrink-0 text-[11px] text-muted">Bientôt</span>
                )
              ) : null}
            </>
          );
          const cls = cn(
            "flex h-11 items-center gap-2.5 rounded-xl border px-3",
            step.done ? "border-transparent bg-surface" : "border-line bg-canvas",
          );
          return (
            <li key={step.label}>
              {step.href && !step.done ? (
                <Link href={step.href} className={cn(cls, "transition-colors hover:border-leaf/40")}>
                  {body}
                </Link>
              ) : (
                <span className={cls}>{body}</span>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export default async function DashboardPage() {
  const workspace = await currentWorkspace();
  if (!workspace) redirect("/espaces");

  const api = await getApi();
  const header = { "X-Workspace": workspace };
  const [{ data: me }, orgResult, membersResult, producersResult] = await Promise.all([
    api.GET("/api/v1/me/"),
    api.GET("/api/v1/organization/", { params: { header } }),
    api.GET("/api/v1/memberships/", { params: { header } }),
    api.GET("/api/v1/producers/", { params: { header } }),
  ]);
  if (!me) redirect("/connexion?erreur=session");
  if (!orgResult.data) redirect("/espaces?erreur=acces");

  const org = orgResult.data;
  const roles = me.memberships.find((m) => m.workspace === workspace)?.roles ?? [];
  const list = membersResult.data?.results;
  const partial = Boolean(membersResult.data?.next);
  const active = list ? list.filter((m) => m.status === "active") : null;
  const newThisWeek = active ? countSince(active.map((m) => m.joined_at), 7) : 0;
  const invitedMembers = list ? list.filter((m) => m.status === "invited") : [];
  const typeLabel = ORGANIZATION_TYPE_LABELS[org.organization_type] ?? org.organization_type;
  // null : registre non accessible avec ce rôle.
  const producerCount = producersResult.data ? producersResult.data.count : null;
  const latestProducers = [...(producersResult.data?.results ?? [])]
    .sort((a, b) => (b.assignment?.start_date ?? "").localeCompare(a.assignment?.start_date ?? ""))
    .slice(0, 5);

  const steps: Step[] = [
    { label: "Créer l'organisation", done: true },
    { label: "Inviter l'équipe", done: (list?.length ?? 0) > 1, href: "/equipe" },
    { label: "Enregistrer les producteurs", done: (producerCount ?? 0) > 0, href: "/producteurs" },
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
              className="object-cover object-[center_52%]"
            />
          </div>
          <div aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,transparent_45%,var(--color-surface)_92%)]" />
        </>
      }
    >
      <PageHeader
        overline={typeLabel}
        title={`Bonjour ${me.first_name} 👋`}
        description={`Pilotez l'activité de ${org.short_name || org.name} depuis une seule plateforme.`}
      />

      <StatRow>
        <Stat
          label="Parcelles AgroID"
          icon={MapIcon}
          iconTone="gold"
          value="0"
          hint="registre cartographique bientôt"
        />
        <Stat label="Surface suivie" icon={ChartColumn} value="0" unit="ha" hint="calculée depuis les contours GPS" />
        <Stat
          label="Producteurs"
          icon={UsersRound}
          value={producerCount === null ? "—" : String(producerCount)}
          valueTone="success"
          hint={producerCount === null ? "non accessible avec votre rôle" : "rattachés à l'organisation"}
          hintTone="success"
          href={producerCount === null ? undefined : "/producteurs"}
        />
        <Stat
          label="Membres actifs"
          icon={Sprout}
          iconTone="night"
          value={active === null ? "—" : `${active.length}${partial ? "+" : ""}`}
          hint={
            active === null
              ? "réservé aux gérants"
              : newThisWeek
                ? `↗ +${newThisWeek} cette semaine`
                : invitedMembers.length
                  ? `${invitedMembers.length} invitation${invitedMembers.length > 1 ? "s" : ""} en attente`
                  : "équipe à jour"
          }
          hintTone={newThisWeek ? "success" : invitedMembers.length ? "warning" : "muted"}
          href="/equipe"
        />
      </StatRow>

      <Onboarding steps={steps} />

      {/* Filtres de la carte */}
      <div className="mt-4 flex flex-wrap items-center gap-2" aria-label="Filtres de la carte" role="group">
        <span className="mr-1 inline-flex items-center gap-1.5 text-[13px] font-semibold">
          <SlidersHorizontal className="size-4 text-leaf" aria-hidden />
          Filtres
        </span>
        {MAP_FILTERS.map(([label, value, source]) => (
          <span
            key={label}
            aria-disabled="true"
            title={`Disponible avec : ${source}`}
            className="inline-flex h-9 cursor-default items-center gap-2 rounded-xl border border-line bg-canvas px-3 text-[13px] text-muted"
          >
            {label} : <span className="font-semibold text-ink/70">{value}</span>
            <svg aria-hidden viewBox="0 0 16 16" className="size-3.5">
              <path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </span>
        ))}
        <span className="tabular ml-auto font-mono text-[12px] text-muted">0 / 0 parcelle affichée</span>
      </div>

      <div className="mt-3">
        <ParcelMap view={DEFAULT_VIEW} emptyLabel="Aucune parcelle cartographiée pour le moment" />
      </div>

      {/* Activité récente */}
      <div className="mt-5 grid gap-4 lg:grid-cols-2 lg:gap-5">
        <Card className="rounded-2xl p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[16px] font-semibold">Derniers producteurs enregistrés</h2>
            {producerCount ? (
              <Link href="/producteurs" className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand-700 hover:underline">
                Voir tout
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            ) : null}
          </div>
          {latestProducers.length === 0 ? (
            <p className="mt-4 rounded-xl bg-surface px-4 py-6 text-center text-[13px] text-muted">
              {producerCount === null ? "Registre non accessible avec votre rôle." : "Aucun producteur pour le moment."}
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {latestProducers.map((p) => (
                <li key={p.id}>
                  <Link href={`/producteurs/${p.id}`} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-surface">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-50 font-display text-[11px] font-bold text-forest">
                      {producerInitials(p.first_name, p.last_name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold">
                        {p.first_name} {p.last_name}
                      </span>
                      <span className="block truncate text-[12px] text-muted">
                        {p.locality_text || "Village non renseigné"}
                        {p.phone_number ? ` · ${formatPhone(p.phone_number)}` : ""}
                      </span>
                    </span>
                    <span className="tabular shrink-0 font-mono text-[12px] text-muted">
                      {p.assignment ? formatDate(p.assignment.start_date) : ""}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="rounded-2xl p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[16px] font-semibold">Invitations en attente</h2>
            {list ? (
              <Link href="/equipe?statut=invited" className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand-700 hover:underline">
                Équipe
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            ) : null}
          </div>
          {invitedMembers.length === 0 ? (
            <p className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-surface px-4 py-6 text-center text-[13px] text-muted">
              {list ? (
                <>
                  <UserPlus className="size-4" aria-hidden />
                  Aucune invitation en attente.
                </>
              ) : (
                "Réservé aux administrateurs et aux gérants."
              )}
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {invitedMembers.slice(0, 5).map((m) => (
                <li key={m.id} className="flex items-center gap-3 py-2.5">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-warning-bg font-display text-[11px] font-bold text-[#8a5a00]">
                    {`${m.user.first_name.charAt(0)}${m.user.last_name.charAt(0)}`.toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold">
                      {m.user.first_name} {m.user.last_name}
                    </span>
                    <span className="block truncate text-[12px] text-muted">
                      {primaryRoleLabel(m.roles)}
                      {!m.user.account_activated ? " · compte à activer" : ""}
                    </span>
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-1 text-[12px] text-muted">
                    <Clock3 className="size-3.5" aria-hidden />
                    <span className="tabular font-mono">{formatDate(m.created_at)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {invitedMembers.length > 0 ? (
            <div className="mt-3">
              <StatusPill tone="warning">
                {invitedMembers.length} en attente d&apos;acceptation
              </StatusPill>
            </div>
          ) : null}
        </Card>
      </div>
    </AppShell>
  );
}
