import { ChevronLeft, ChevronRight, Phone, Search, Sprout, UserRound, UsersRound, Venus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell, PageHeader, Stat, StatRow } from "@/components/app-shell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { currentWorkspace, getApi } from "@/lib/api/client";
import { COOPERATIVE_NAV } from "@/lib/navigation";
import { formatPhone } from "@/lib/phone";
import { RELATIONSHIP_LABELS, producerInitials } from "@/lib/producers";
import { ORGANIZATION_TYPE_LABELS, formatDate, organizationInitials, primaryRoleLabel } from "@/lib/spaces";

import { CreateProducerDialog, EmptyRegistry } from "./producer-dialogs";

export const metadata: Metadata = { title: "Producteurs" };

const GRID = "md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_100px_24px]";

function pageNumber(value: string | undefined) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

export default async function ProducersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; retire?: string }>;
}) {
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const page = pageNumber(params.page);
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

  const listResult = canView
    ? await api.GET("/api/v1/producers/", { params: { header, query: { q: q || undefined, page } } })
    : null;
  if (listResult && listResult.response.status === 404 && page > 1) redirect("/producteurs");
  const producers = listResult?.data?.results ?? [];
  const total = listResult?.data?.count ?? 0;
  const complete = !listResult?.data?.next && !listResult?.data?.previous && !q;
  const women = producers.filter((p) => p.sex === "female").length;
  const reachable = producers.filter((p) => p.phone_number).length;
  const monthAgo = new Date();
  monthAgo.setDate(monthAgo.getDate() - 30);
  const recent = producers.filter((p) => p.assignment && new Date(p.assignment.start_date) >= monthAgo).length;
  const pageSize = 50;
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = (page - 1) * pageSize + producers.length;
  const typeLabel = ORGANIZATION_TYPE_LABELS[org.organization_type] ?? org.organization_type;

  return (
    <AppShell
      nav={COOPERATIVE_NAV}
      activeHref="/producteurs"
      workspace={{ name: org.short_name || org.name, roleLabel: typeLabel, initials: organizationInitials(org.name) }}
      user={{ firstName: me.first_name, lastName: me.last_name, roleLabel: primaryRoleLabel(roles) }}
      breadcrumbs={[org.short_name || org.name, "Producteurs"]}
    >
      <PageHeader title="Producteurs" actions={canCreate ? <CreateProducerDialog /> : undefined} />

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
            <Stat label="Producteurs" icon={UsersRound} value={String(total)} />
            <Stat label="Femmes" icon={Venus} iconTone="gold" value={complete ? String(women) : "—"} hint={complete && total ? `${Math.round((women / total) * 100)} %` : undefined} />
            <Stat label="Joignables" icon={Phone} value={complete ? String(reachable) : "—"} hint={complete ? "avec téléphone" : undefined} />
            <Stat label="Nouveaux" icon={Sprout} iconTone="night" value={complete ? String(recent) : "—"} hint={complete ? "30 derniers jours" : undefined} />
          </StatRow>

          <form className="mt-6 flex gap-2" role="search">
            <label htmlFor="q" className="sr-only">
              Rechercher un producteur
            </label>
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-muted" aria-hidden />
              <input
                id="q"
                name="q"
                defaultValue={q}
                placeholder="Nom, village, téléphone ou n° d'adhérent"
                className="h-11 w-full rounded-xl border border-line-strong bg-canvas pr-3 pl-10 text-[15px] focus:border-brand-800 focus:ring-3 focus:ring-gold/35 focus:outline-none"
              />
            </div>
            <Button type="submit" variant="secondary" className="h-11">
              Rechercher
            </Button>
          </form>

          <Card className="mt-4 overflow-hidden">
            {producers.length === 0 ? (
              q ? (
                <div className="px-6 py-14 text-center">
                  <p className="font-display text-[16px] font-bold">Aucun résultat pour « {q} »</p>
                  <Link href="/producteurs" className="mt-2 inline-block text-[14px] font-medium text-brand-700 hover:underline">
                    Effacer la recherche
                  </Link>
                </div>
              ) : (
                <EmptyRegistry canCreate={canCreate} />
              )
            ) : (
              <>
                <div
                  aria-hidden
                  className={`hidden border-b border-line bg-surface px-5 py-2.5 text-[12px] font-medium text-muted md:grid ${GRID} md:gap-4`}
                >
                  <span>Producteur</span>
                  <span>Village ou commune</span>
                  <span>N° d&apos;adhérent</span>
                  <span>Relation</span>
                  <span>Depuis</span>
                  <span />
                </div>
                <ul aria-label="Producteurs">
                  {producers.map((p) => (
                    <li key={p.id} className="border-b border-line last:border-0">
                      <Link
                        href={`/producteurs/${p.id}`}
                        className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 px-4 py-3.5 transition-colors hover:bg-surface sm:px-5 ${GRID} md:gap-4`}
                      >
                        <span className="flex min-w-0 items-center gap-3">
                          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-50 font-display text-[12px] font-bold text-brand-800">
                            {producerInitials(p.first_name, p.last_name)}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-[14px] font-semibold">
                              {p.first_name} {p.last_name}
                            </span>
                            <span className="tabular block truncate text-[12px] text-muted">
                              {p.phone_number ? formatPhone(p.phone_number) : "Sans téléphone"}
                            </span>
                          </span>
                        </span>
                        <span className="col-start-1 row-start-2 truncate pl-[52px] text-[13px] text-muted md:col-start-auto md:row-start-auto md:pl-0 md:text-[14px] md:text-ink">
                          {p.locality_text || <span className="text-muted">—</span>}
                          <span className="md:hidden">
                            {p.assignment?.membership_number ? ` · ${p.assignment.membership_number}` : ""}
                          </span>
                        </span>
                        <span className="hidden truncate font-mono text-[13px] md:block">
                          {p.assignment?.membership_number || <span className="font-sans text-muted">—</span>}
                        </span>
                        <span className="hidden md:block">
                          <Badge tone="brand">{RELATIONSHIP_LABELS[p.assignment?.relationship_type ?? "member"]}</Badge>
                        </span>
                        <span className="tabular hidden text-[13px] text-muted md:block">
                          {p.assignment ? formatDate(p.assignment.start_date) : "—"}
                        </span>
                        <ChevronRight className="col-start-2 row-span-2 row-start-1 size-5 text-ink/50 md:col-start-auto md:row-span-1 md:row-start-auto" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface/60 px-5 py-3 text-[13px] text-muted">
                  <span className="flex items-center gap-1.5">
                    <UserRound className="size-4" aria-hidden />
                    {from}–{to} sur {total}
                  </span>
                  <div className="flex gap-2">
                    {listResult?.data?.previous ? (
                      <Button asChild variant="secondary" size="sm">
                        <Link href={`/producteurs?page=${page - 1}${q ? `&q=${encodeURIComponent(q)}` : ""}`}>
                          <ChevronLeft aria-hidden />
                          Précédent
                        </Link>
                      </Button>
                    ) : null}
                    {listResult?.data?.next ? (
                      <Button asChild variant="secondary" size="sm">
                        <Link href={`/producteurs?page=${page + 1}${q ? `&q=${encodeURIComponent(q)}` : ""}`}>
                          Suivant
                          <ChevronRight aria-hidden />
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                </div>
              </>
            )}
          </Card>
        </>
      )}
    </AppShell>
  );
}
