import { ChevronLeft, ChevronRight, Fingerprint, Map as MapIcon, Ruler, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AgroIdBadge } from "@/components/agroid-badge";
import { AppShell, PageHeader, Stat, StatRow } from "@/components/app-shell";
import { AutoSubmitSelect } from "@/components/auto-submit-select";
import { ListToolbar, StatusPill } from "@/components/list-toolbar";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { currentWorkspace, getApi } from "@/lib/api/client";
import { COOPERATIVE_NAV } from "@/lib/navigation";
import { PARCEL_STATUS_FILTER, formatArea, hectares, parcelStatus } from "@/lib/parcels";
import { ORGANIZATION_TYPE_LABELS, formatDate, organizationInitials, primaryRoleLabel } from "@/lib/spaces";

export const metadata: Metadata = { title: "Parcelles & AgroID" };

const GRID = "lg:grid-cols-[170px_minmax(0,1.4fr)_minmax(0,1.2fr)_110px_120px_100px]";
const STATUSES = ["draft", "pending_validation", "active", "retired"] as const;
type Status = (typeof STATUSES)[number];

function pageNumber(value: string | undefined) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

export default async function ParcelsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const page = pageNumber(params.page);
  const status = STATUSES.includes(params.statut as Status) ? (params.statut as Status) : undefined;
  const filtered = Boolean(q || status);

  const workspace = await currentWorkspace();
  if (!workspace) redirect("/espaces");
  const api = await getApi();
  const header = { "X-Workspace": workspace };
  const [{ data: me }, orgResult, listResult, summaryResult] = await Promise.all([
    api.GET("/api/v1/me/"),
    api.GET("/api/v1/organization/", { params: { header } }),
    api.GET("/api/v1/parcels/", { params: { header, query: { q: q || undefined, status, page } } }),
    api.GET("/api/v1/parcels/summary/", { params: { header } }),
  ]);
  if (!me) redirect("/connexion?erreur=session");
  if (!orgResult.data) redirect("/espaces?erreur=acces");
  if (listResult.response.status === 404 && page > 1) redirect("/parcelles");
  const org = orgResult.data;
  const roles = me.memberships.find((m) => m.workspace === workspace)?.roles ?? [];
  const typeLabel = ORGANIZATION_TYPE_LABELS[org.organization_type] ?? org.organization_type;
  const canView = Boolean(listResult.data);
  const parcels = listResult.data?.results ?? [];
  const count = listResult.data?.count ?? 0;
  const summary = summaryResult.data;
  const total = summary?.count ?? 0;

  const query = (extra: Record<string, string | number | undefined>) => {
    const merged: Record<string, string | number | undefined> = { q: q || undefined, statut: status, ...extra };
    const search = new URLSearchParams(
      Object.entries(merged)
        .filter((e): e is [string, string | number] => e[1] !== undefined && e[1] !== "")
        .map(([k, v]) => [k, String(v)]),
    ).toString();
    return search ? `?${search}` : "";
  };
  const from = count === 0 ? 0 : (page - 1) * 50 + 1;
  const to = (page - 1) * 50 + parcels.length;

  return (
    <AppShell
      nav={COOPERATIVE_NAV}
      activeHref="/parcelles"
      workspace={{ name: org.short_name || org.name, roleLabel: typeLabel, initials: organizationInitials(org.name) }}
      user={{ firstName: me.first_name, lastName: me.last_name, roleLabel: primaryRoleLabel(roles) }}
      breadcrumbs={[org.short_name || org.name, "Parcelles & AgroID"]}
      search={{ action: "/parcelles", placeholder: "Rechercher un AgroID ou une parcelle…" }}
    >
      <PageHeader
        context={`${org.name} · ${typeLabel}`}
        title="Parcelles & AgroID"
        description="Chaque parcelle suivie, son identité AgroID, son contour et son exploitant."
        actions={
          total > 0 ? (
            <Button asChild variant="secondary" className="h-10 rounded-xl">
              <Link href="/tableau-de-bord">
                <MapIcon aria-hidden />
                Voir sur la carte
              </Link>
            </Button>
          ) : undefined
        }
      />

      {!canView ? (
        <Alert tone="info" className="mt-6">
          Les parcelles ne sont pas accessibles avec votre rôle.
        </Alert>
      ) : (
        <>
          <StatRow>
            <Stat label="Parcelles AgroID" icon={Fingerprint} iconTone="gold" value={String(total)} hint="hors parcelles retirées" />
            <Stat label="Surface suivie" icon={Ruler} value={hectares(summary?.total_area_m2)} unit="ha" hint="contours courants" />
            <Stat
              label="Actives"
              value={String(summary?.by_status.active ?? 0)}
              valueTone="success"
              hint="contour valide"
              hintTone="success"
            />
            <Stat
              label="À vérifier"
              icon={TriangleAlert}
              iconTone="gold"
              value={String(summary?.to_review ?? 0)}
              valueTone="warning"
              hint="contours signalés"
              hintTone={summary?.to_review ? "warning" : "muted"}
              href={summary?.to_review ? "/parcelles?statut=pending_validation" : undefined}
            />
          </StatRow>

          {total > 0 || filtered ? (
            <ListToolbar
              action="/parcelles"
              q={q}
              placeholder="AgroID (ex. PAI-SN-7K4M9X2Q) ou nom de la parcelle…"
              count={count}
              total={total}
              noun={total > 1 ? "parcelles" : "parcelle"}
              filters={
                <>
                  <AutoSubmitSelect
                    name="statut"
                    label="Statut"
                    value={status ?? ""}
                    options={PARCEL_STATUS_FILTER.map(([v, t]) => [v, v ? t : "Statut : tous"])}
                  />
                  {filtered ? (
                    <Link href="/parcelles" className="ml-1 text-[13px] font-semibold text-brand-700 hover:underline">
                      Réinitialiser
                    </Link>
                  ) : null}
                </>
              }
            />
          ) : null}

          {parcels.length === 0 ? (
            <Card className="mt-4 rounded-2xl px-6 py-14 text-center">
              <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-brand-50 text-forest">
                <Fingerprint className="size-6" aria-hidden />
              </span>
              <p className="mt-3 font-display text-[16px] font-semibold">
                {filtered ? "Aucune parcelle ne correspond" : "Aucune parcelle pour le moment"}
              </p>
              <p className="mx-auto mt-1 max-w-md text-[14px] text-muted">
                {filtered
                  ? "Vérifiez l'AgroID saisi ou effacez les filtres."
                  : "Les agents de terrain relèvent les contours avec l'app terrain ; chaque parcelle reçoit aussitôt son AgroID."}
              </p>
              {filtered ? (
                <Link href="/parcelles" className="mt-3 inline-block text-[14px] font-medium text-brand-700 hover:underline">
                  Effacer les filtres
                </Link>
              ) : null}
            </Card>
          ) : (
            <Card className="mt-4 overflow-hidden rounded-2xl">
              <div
                aria-hidden
                className={`hidden border-b border-line bg-surface px-5 py-3 text-[12px] font-semibold text-muted lg:grid ${GRID} lg:gap-4`}
              >
                <span>AgroID</span>
                <span>Parcelle</span>
                <span>Exploitant principal</span>
                <span className="text-right">Surface</span>
                <span>Statut</span>
                <span className="text-right">Depuis</span>
              </div>
              <ul aria-label="Parcelles">
                {parcels.map((p) => {
                  const st = parcelStatus(p.status);
                  const operator = p.primary_operator as { name?: string } | null;
                  return (
                    <li key={p.id} className="border-b border-line last:border-0">
                      <Link
                        href={`/parcelles/${p.id}`}
                        className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-3.5 hover:bg-surface sm:px-5 ${GRID} lg:gap-4`}
                      >
                        <span>
                          <AgroIdBadge code={p.agroid} />
                        </span>
                        <span className="min-w-0 truncate text-[14px] font-semibold max-lg:col-span-2">
                          {p.local_name || <span className="font-normal text-muted">Sans nom</span>}
                        </span>
                        <span className="min-w-0 truncate text-[13px] text-muted max-lg:hidden">
                          {operator?.name || "Non renseigné"}
                        </span>
                        <span className="tabular text-right font-mono text-[13px] max-lg:text-left">
                          {formatArea(p.current_area_m2)}
                        </span>
                        <span>
                          <StatusPill tone={st.tone}>{st.label}</StatusPill>
                        </span>
                        <span className="tabular text-right font-mono text-[12px] text-muted max-lg:hidden">
                          {formatDate(p.created_at)}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
              {listResult.data?.next || listResult.data?.previous ? (
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface/60 px-5 py-3 text-[13px] text-muted">
                  <span className="tabular font-mono">
                    {from}–{to} sur {count}
                  </span>
                  <div className="flex gap-2">
                    {listResult.data?.previous ? (
                      <Button asChild variant="secondary" size="sm">
                        <Link href={`/parcelles${query({ page: page - 1 })}`}>
                          <ChevronLeft aria-hidden />
                          Précédent
                        </Link>
                      </Button>
                    ) : null}
                    {listResult.data?.next ? (
                      <Button asChild variant="secondary" size="sm">
                        <Link href={`/parcelles${query({ page: page + 1 })}`}>
                          Suivant
                          <ChevronRight aria-hidden />
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </Card>
          )}
        </>
      )}
    </AppShell>
  );
}
