import { ChevronLeft, ChevronRight, Download, Eye, MapPin, Phone, Sprout, UsersRound, Venus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell, PageHeader, Stat, StatRow } from "@/components/app-shell";
import { AutoSubmitSelect } from "@/components/auto-submit-select";
import { ListToolbar, StatusPill } from "@/components/list-toolbar";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { currentWorkspace, getApi } from "@/lib/api/client";
import { COOPERATIVE_NAV } from "@/lib/navigation";
import { formatPhone } from "@/lib/phone";
import { RELATIONSHIP_LABELS, producerInitials } from "@/lib/producers";
import { ORGANIZATION_TYPE_LABELS, formatDate, organizationInitials, primaryRoleLabel } from "@/lib/spaces";

import { CreateProducerDialog, EmptyRegistry } from "./producer-dialogs";

export const metadata: Metadata = { title: "Producteurs" };

const GRID =
  "lg:grid-cols-[110px_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_100px_96px_88px]";

const FILTERS = {
  statut: [
    ["", "Statut : tous"],
    ["active", "Actifs"],
    ["inactive", "Inactifs"],
  ],
  relation: [
    ["", "Relation : toutes"],
    ["member", "Membres"],
    ["beneficiary", "Bénéficiaires"],
    ["client", "Clients"],
  ],
  sexe: [
    ["", "Sexe : tous"],
    ["female", "Femmes"],
    ["male", "Hommes"],
  ],
} satisfies Record<string, [string, string][]>;

function pick<T extends string>(value: string | undefined, allowed: readonly T[]): T | undefined {
  return allowed.includes(value as T) ? (value as T) : undefined;
}

function pageNumber(value: string | undefined) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

export default async function ProducersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const page = pageNumber(params.page);
  const view = params.vue === "cartes" ? "cartes" : "tableau";
  const status = pick(params.statut, ["active", "inactive"] as const);
  const relationship = pick(params.relation, ["member", "beneficiary", "client"] as const);
  const sex = pick(params.sexe, ["female", "male"] as const);
  const filtered = Boolean(q || status || relationship || sex);

  const workspace = await currentWorkspace();
  if (!workspace) redirect("/espaces");
  const api = await getApi();
  const header = { "X-Workspace": workspace };
  const [{ data: me }, orgResult, contextResult] = await Promise.all([
    api.GET("/api/v1/me/"),
    api.GET("/api/v1/organization/", { params: { header } }),
    api.GET("/api/v1/workspace/", { headers: header }),
  ]);
  if (!me) redirect("/connexion?erreur=session");
  if (!orgResult.data) redirect("/espaces?erreur=acces");
  const org = orgResult.data;
  const roles = me.memberships.find((m) => m.workspace === workspace)?.roles ?? [];
  const permissions = new Set(contextResult.data?.permissions ?? []);
  const canView = permissions.has("producers.view");
  const canCreate = permissions.has("producers.create");

  const [listResult, allResult] = canView
    ? await Promise.all([
        api.GET("/api/v1/producers/", {
          params: { header, query: { q: q || undefined, page, status, relationship, sex } },
        }),
        // Indicateurs : sur tout le registre (première page), indépendamment des filtres.
        filtered ? api.GET("/api/v1/producers/", { params: { header } }) : Promise.resolve(null),
      ])
    : [null, null];
  if (listResult && listResult.response.status === 404 && page > 1) redirect("/producteurs");
  const producers = listResult?.data?.results ?? [];
  const count = listResult?.data?.count ?? 0;
  const all = (filtered ? allResult?.data : listResult?.data) ?? null;
  const registry = all?.results ?? [];
  const total = all?.count ?? 0;
  const complete = Boolean(all) && !all?.next;
  const women = registry.filter((p) => p.sex === "female").length;
  const reachable = registry.filter((p) => p.phone_number).length;
  const monthAgo = new Date();
  monthAgo.setDate(monthAgo.getDate() - 30);
  const recent = registry.filter((p) => p.assignment && new Date(p.assignment.start_date) >= monthAgo).length;

  const typeLabel = ORGANIZATION_TYPE_LABELS[org.organization_type] ?? org.organization_type;
  const query = (extra: Record<string, string | number | undefined>) => {
    const merged: Record<string, string | number | undefined> = {
      q: q || undefined,
      statut: status,
      relation: relationship,
      sexe: sex,
      vue: view === "cartes" ? "cartes" : undefined,
      ...extra,
    };
    const search = new URLSearchParams(
      Object.entries(merged).filter((e): e is [string, string | number] => e[1] !== undefined && e[1] !== "").map(([k, v]) => [k, String(v)]),
    ).toString();
    return search ? `?${search}` : "";
  };
  const pageSize = 50;
  const from = count === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = (page - 1) * pageSize + producers.length;

  const pager =
  listResult?.data?.next || listResult?.data?.previous ? (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface/60 px-5 py-3 text-[13px] text-muted">
      <span className="tabular font-mono">
        {from}–{to} sur {count}
      </span>
      <div className="flex gap-2">
        {listResult?.data?.previous ? (
          <Button asChild variant="secondary" size="sm">
            <Link href={`/producteurs${query({ page: page - 1 })}`}>
              <ChevronLeft aria-hidden />
              Précédent
            </Link>
          </Button>
        ) : null}
        {listResult?.data?.next ? (
          <Button asChild variant="secondary" size="sm">
            <Link href={`/producteurs${query({ page: page + 1 })}`}>
              Suivant
              <ChevronRight aria-hidden />
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  ) : null;

  return (
    <AppShell
      nav={COOPERATIVE_NAV}
      activeHref="/producteurs"
      workspace={{ name: org.short_name || org.name, roleLabel: typeLabel, initials: organizationInitials(org.name) }}
      user={{ firstName: me.first_name, lastName: me.last_name, roleLabel: primaryRoleLabel(roles) }}
      breadcrumbs={[org.short_name || org.name, "Producteurs"]}
    >
      <PageHeader
        context={`${org.name} · ${typeLabel}`}
        title="Producteurs"
        description="Les profils des producteurs et leurs rattachements à votre organisation."
        actions={
          canView ? (
            <>
              {total > 0 ? (
                <Button asChild variant="secondary" className="h-10 rounded-xl">
                  <a href={`/producteurs/export${query({ vue: undefined })}`}>
                    <Download aria-hidden />
                    Exporter
                  </a>
                </Button>
              ) : null}
              {canCreate ? <CreateProducerDialog /> : null}
            </>
          ) : undefined
        }
      />

      {params.retire ? (
        <Alert tone="info" className="mt-5">
          Le producteur a été retiré du registre. Son historique est conservé.
        </Alert>
      ) : null}

      {!canView ? (
        <Alert tone="info" className="mt-6">
          Le registre des producteurs n&apos;est pas accessible avec votre rôle.
        </Alert>
      ) : (
        <>
          <StatRow>
            <Stat label="Producteurs enregistrés" icon={UsersRound} value={String(total)} hint="rattachés à votre organisation" />
            <Stat
              label="Femmes"
              icon={Venus}
              iconTone="gold"
              value={complete ? String(women) : "—"}
              valueTone="warning"
              hint={complete && total ? `${Math.round((women / total) * 100)} % de l'effectif` : undefined}
              hintTone="warning"
            />
            <Stat
              label="Joignables"
              icon={Phone}
              value={complete ? String(reachable) : "—"}
              valueTone="success"
              hint={complete ? "avec un téléphone" : undefined}
              hintTone="success"
            />
            <Stat label="Nouveaux" icon={Sprout} value={complete ? String(recent) : "—"} hint="30 derniers jours" />
          </StatRow>

          {total > 0 ? (
            <ListToolbar
              action="/producteurs"
              q={q}
              placeholder="Rechercher par nom, village, téléphone ou n° d'adhérent…"
              count={count}
              total={total}
              noun={total > 1 ? "producteurs" : "producteur"}
              view={view}
              viewHref={(v) => `/producteurs${query({ vue: v === "cartes" ? "cartes" : undefined, page: undefined })}`}
              hidden={view === "cartes" ? { vue: "cartes" } : undefined}
              filters={
                <>
                  <AutoSubmitSelect name="statut" label="Statut" value={status ?? ""} options={FILTERS.statut} />
                  <AutoSubmitSelect name="relation" label="Relation" value={relationship ?? ""} options={FILTERS.relation} />
                  <AutoSubmitSelect name="sexe" label="Sexe" value={sex ?? ""} options={FILTERS.sexe} />
                  {filtered ? (
                    <Link href={`/producteurs${view === "cartes" ? "?vue=cartes" : ""}`} className="ml-1 text-[13px] font-semibold text-brand-700 hover:underline">
                      Réinitialiser
                    </Link>
                  ) : null}
                </>
              }
            />
          ) : null}

          {producers.length === 0 ? (
            <Card className="mt-4 rounded-2xl">
              {filtered ? (
                <div className="px-6 py-14 text-center">
                  <p className="font-display text-[16px] font-semibold">Aucun producteur ne correspond</p>
                  <Link href="/producteurs" className="mt-2 inline-block text-[14px] font-medium text-brand-700 hover:underline">
                    Effacer les filtres
                  </Link>
                </div>
              ) : (
                <EmptyRegistry canCreate={canCreate} />
              )}
            </Card>
          ) : view === "cartes" ? (
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {producers.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/producteurs/${p.id}`}
                    className="group flex h-full flex-col rounded-2xl border border-line bg-canvas p-4 shadow-[0_2px_10px_-4px_rgb(11_25_41/0.06)] transition-shadow hover:shadow-pop"
                  >
                    <span className="flex items-start gap-3">
                      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-50 font-display text-[13px] font-bold text-forest">
                        {producerInitials(p.first_name, p.last_name)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-semibold">
                          {p.first_name} {p.last_name}
                        </span>
                        <span className="block font-mono text-[12px] font-semibold text-forest">
                          {p.assignment?.membership_number || "Sans n° d'adhérent"}
                        </span>
                      </span>
                      <StatusPill tone={p.status === "active" ? "success" : "neutral"}>
                        {p.status === "active" ? "Actif" : "Inactif"}
                      </StatusPill>
                    </span>
                    <span className="mt-4 grid gap-1.5 text-[13px] text-muted">
                      <span className="flex items-center gap-2">
                        <MapPin className="size-4" aria-hidden />
                        {p.locality_text || "Village non renseigné"}
                      </span>
                      <span className="flex items-center gap-2">
                        <Phone className="size-4" aria-hidden />
                        <span className="tabular font-mono">{p.phone_number ? formatPhone(p.phone_number) : "Sans téléphone"}</span>
                      </span>
                    </span>
                    <span className="mt-4 flex items-center justify-between border-t border-line pt-3 text-[12px] text-muted">
                      <span>
                        {RELATIONSHIP_LABELS[p.assignment?.relationship_type ?? "member"]} depuis le{" "}
                        {p.assignment ? formatDate(p.assignment.start_date) : "—"}
                      </span>
                      <ChevronRight className="size-4 text-ink/50 transition-transform group-hover:translate-x-0.5" aria-hidden />
                    </span>
                  </Link>
                </li>
              ))}
              {pager ? <li className="sm:col-span-2 xl:col-span-3">{pager}</li> : null}
            </ul>
          ) : (
            <Card className="mt-4 overflow-hidden rounded-2xl">
              <div
                aria-hidden
                className={`hidden border-b border-line bg-surface px-5 py-3 text-[12px] font-semibold text-muted lg:grid ${GRID} lg:gap-4`}
              >
                <span>N° adhérent</span>
                <span>Producteur</span>
                <span>Téléphone</span>
                <span>Village ou commune</span>
                <span>Depuis</span>
                <span>Statut</span>
                <span className="text-right">Actions</span>
              </div>
              <ul aria-label="Producteurs">
                {producers.map((p) => (
                  <li
                    key={p.id}
                    className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 border-b border-line px-4 py-3.5 last:border-0 sm:px-5 ${GRID} lg:gap-4`}
                  >
                    <span className="hidden font-mono text-[13px] font-semibold text-forest lg:block">
                      {p.assignment?.membership_number || <span className="font-sans font-normal text-muted">—</span>}
                    </span>
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-full border border-line bg-brand-50 font-display text-[12px] font-bold text-forest">
                        {producerInitials(p.first_name, p.last_name)}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[14px] font-semibold">
                          {p.first_name} {p.last_name}
                        </span>
                        <span className="block truncate text-[12px] text-muted">
                          {RELATIONSHIP_LABELS[p.assignment?.relationship_type ?? "member"]}
                          <span className="lg:hidden">
                            {p.locality_text ? ` · ${p.locality_text}` : ""}
                            {p.assignment?.membership_number ? ` · ${p.assignment.membership_number}` : ""}
                          </span>
                        </span>
                      </span>
                    </span>
                    <span className="hidden items-center gap-2 lg:flex">
                      {p.phone_number ? (
                        <>
                          <Phone className="size-4 shrink-0 text-leaf" aria-hidden />
                          <span className="tabular truncate font-mono text-[13px]">{formatPhone(p.phone_number)}</span>
                        </>
                      ) : (
                        <span className="text-[13px] text-muted">—</span>
                      )}
                    </span>
                    <span className="hidden truncate text-[14px] lg:block">{p.locality_text || <span className="text-muted">—</span>}</span>
                    <span className="tabular hidden font-mono text-[13px] text-muted lg:block">
                      {p.assignment ? formatDate(p.assignment.start_date) : "—"}
                    </span>
                    <span className="hidden lg:block">
                      <StatusPill tone={p.status === "active" ? "success" : "neutral"}>
                        {p.status === "active" ? "Actif" : "Inactif"}
                      </StatusPill>
                    </span>
                    <span className="col-start-2 row-start-1 text-right lg:col-start-auto lg:row-start-auto">
                      <Button asChild variant="secondary" size="sm" className="rounded-lg">
                        <Link href={`/producteurs/${p.id}`}>
                          <Eye aria-hidden />
                          Profil
                        </Link>
                      </Button>
                    </span>
                  </li>
                ))}
              </ul>
              {pager}
            </Card>
          )}
        </>
      )}
    </AppShell>
  );
}
