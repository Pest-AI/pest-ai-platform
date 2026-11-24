import { ArrowLeft, CircleCheck, CircleX, Download, FileUp, Fingerprint, MapPinned, TriangleAlert, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AgroIdBadge } from "@/components/agroid-badge";
import { AppShell, PageHeader, Stat, StatRow } from "@/components/app-shell";
import { ImportMap, type ImportMapRow } from "@/components/import-map";
import { StatusPill } from "@/components/list-toolbar";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { currentWorkspace, getApi } from "@/lib/api/client";
import { COOPERATIVE_NAV } from "@/lib/navigation";
import {
  IMPORT_FORMATS,
  LINE_STATUS,
  type LineStatus,
  type ProducerLine,
  formatBytes,
  importStatus,
  producerOutcome,
} from "@/lib/parcel-imports";
import { formatArea } from "@/lib/parcels";
import { ORGANIZATION_TYPE_LABELS, formatDate, organizationInitials, primaryRoleLabel } from "@/lib/spaces";
import { cn } from "@/lib/utils";

import { CommitForm, DiscardButton, MappingForm } from "./forms";

export const metadata: Metadata = { title: "Aperçu de l'import" };

const FILTERS: [string, string][] = [
  ["", "Toutes"],
  ["flagged", "À vérifier"],
  ["refused", "Refusées"],
  ["ok", "Prêtes"],
];
const GRID = "lg:grid-cols-[56px_minmax(0,1.2fr)_110px_minmax(0,1fr)_minmax(0,1.6fr)]";

export default async function ParcelImportPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const filter = (await searchParams).lignes ?? "";
  const workspace = await currentWorkspace();
  if (!workspace) redirect("/espaces");
  const api = await getApi();
  const header = { "X-Workspace": workspace };
  const [{ data: me }, orgResult, importResult] = await Promise.all([
    api.GET("/api/v1/me/"),
    api.GET("/api/v1/organization/", { params: { header } }),
    api.GET("/api/v1/parcel-imports/{id}/", { params: { header, path: { id } } }),
  ]);
  if (!me) redirect("/connexion?erreur=session");
  if (!orgResult.data) redirect("/espaces?erreur=acces");
  if (importResult.response.status === 403) redirect("/parcelles/import");
  const record = importResult.data;
  if (!record) notFound();
  const org = orgResult.data;
  const roles = me.memberships.find((m) => m.workspace === workspace)?.roles ?? [];
  const typeLabel = ORGANIZATION_TYPE_LABELS[org.organization_type] ?? org.organization_type;
  const status = importStatus(record.status);
  const summary = record.summary;
  const previewed = record.status === "previewed";
  const rows = record.rows ?? [];
  const report = record.report ?? [];
  const lines = previewed ? rows : report;
  const producers = (record.producers ?? []) as ProducerLine[];
  const producerSummary = summary.producers;
  const producersCreated = record.producers_created ?? 0;
  const shown = FILTERS.some(([v]) => v === filter) && filter ? lines.filter((l) => l.status === filter) : lines;

  return (
    <AppShell
      nav={COOPERATIVE_NAV}
      activeHref="/parcelles"
      workspace={{ name: org.short_name || org.name, roleLabel: typeLabel, initials: organizationInitials(org.name) }}
      user={{ firstName: me.first_name, lastName: me.last_name, roleLabel: primaryRoleLabel(roles) }}
      breadcrumbs={[org.short_name || org.name, "Parcelles & AgroID", "Importer"]}
    >
      <Link href="/parcelles/import" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-700 hover:underline">
        <ArrowLeft className="size-4" aria-hidden />
        Importer des parcelles
      </Link>
      <PageHeader
        context={`${IMPORT_FORMATS[record.file_format] ?? record.file_format} · ${formatBytes(record.file_size)} · déposé le ${formatDate(record.created_at)}`}
        title={record.file_name}
        description={
          previewed
            ? "Vérifiez l'aperçu : rien n'est encore créé."
            : record.status === "committed"
              ? `Import confirmé le ${formatDate(record.committed_at ?? record.created_at)}.`
              : "Import abandonné : aucune parcelle créée."
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone={status.tone}>{status.label}</StatusPill>
            {lines.length > 0 ? (
              <Button asChild variant="secondary" className="h-10 rounded-xl">
                <a href={`/parcelles/import/${record.id}/rapport`} download>
                  <Download aria-hidden />
                  Rapport CSV
                </a>
              </Button>
            ) : null}
          </div>
        }
      />

      {record.status === "committed" ? (
        <Card className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border-brand-100 bg-brand-50/60 p-5">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-white text-forest">
              <Fingerprint className="size-5" aria-hidden />
            </span>
            <div>
              <p className="font-display text-[18px] font-semibold">
                {record.parcels_created} parcelle{record.parcels_created > 1 ? "s" : ""} créée{record.parcels_created > 1 ? "s" : ""}
                {producersCreated > 0
                  ? ` · ${producersCreated} producteur${producersCreated > 1 ? "s" : ""} enregistré${producersCreated > 1 ? "s" : ""}`
                  : ""}
              </p>
              <p className="text-[13px] text-muted">Chacune a reçu son AgroID. Les lignes non créées restent dans le rapport.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="secondary" className="h-10 rounded-xl">
              <Link href="/parcelles">Voir les parcelles</Link>
            </Button>
            <Button asChild className="h-10 rounded-xl">
              <Link href="/parcelles/import">
                <FileUp aria-hidden />
                Nouvel import
              </Link>
            </Button>
          </div>
        </Card>
      ) : null}

      <StatRow>
        <Stat label="Parcelles lues" icon={MapPinned} value={String(summary.total)} hint={`${summary.without_contour} sans contour`} />
        <Stat
          label="Prêtes"
          icon={CircleCheck}
          value={String(summary.ok)}
          valueTone="success"
          hint={`${summary.with_operator} avec exploitant`}
          href={summary.ok ? `?lignes=ok` : undefined}
        />
        <Stat
          label="À vérifier"
          icon={TriangleAlert}
          iconTone="gold"
          value={String(summary.flagged)}
          valueTone="warning"
          hint="motifs dans le détail"
          hintTone={summary.flagged ? "warning" : "muted"}
          href={summary.flagged ? `?lignes=flagged` : undefined}
        />
        <Stat
          label="Refusées"
          icon={CircleX}
          iconTone="night"
          value={String(summary.refused)}
          hint="jamais créées"
          href={summary.refused ? `?lignes=refused` : undefined}
        />
      </StatRow>

      {previewed ? (
        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]">
          <div className="space-y-5">
            <Card className="rounded-2xl p-5">
              <h2 className="flex items-center gap-2 text-[15px] font-semibold">
                <Users className="size-4 text-leaf" aria-hidden />
                Colonnes du fichier
              </h2>
              <p className="mt-1 mb-3 text-[13px] text-muted">
                Choisissez la colonne qui donne le nom de chaque parcelle et celle qui identifie son exploitant.
              </p>
              {record.columns.length > 0 ? (
                <MappingForm importId={record.id} columns={record.columns} mapping={record.mapping} />
              ) : (
                <p className="rounded-xl bg-surface px-4 py-3 text-[13px] text-muted">Le fichier n’a pas de colonnes d’attributs.</p>
              )}
            </Card>
            {rows.length > 0 ? <ImportMap rows={rows as ImportMapRow[]} /> : null}
          </div>
          <Card className="h-fit rounded-2xl p-5 lg:sticky lg:top-5">
            <h2 className="text-[15px] font-semibold">Confirmer l’import</h2>
            <p className="mt-1 mb-4 text-[13px] text-muted">
              Les lignes refusées ne sont jamais créées. Corrigez le fichier et réimportez-les si besoin.
            </p>
            <CommitForm
              importId={record.id}
              ok={summary.ok}
              flagged={summary.flagged}
              producersNew={producerSummary?.create ?? 0}
              producersFlagged={producerSummary?.flagged ?? 0}
            />
            <div className="mt-3 border-t border-line pt-3">
              <DiscardButton importId={record.id} />
            </div>
          </Card>
        </div>
      ) : null}

      {producers.length > 0 ? (
        <section className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-[16px] font-semibold">
              <Users className="size-4 text-leaf" aria-hidden />
              Onglet Producteurs
            </h2>
            {producerSummary ? (
              <p className="text-[13px] text-muted">
                {producerSummary.create} nouvelle{producerSummary.create > 1 ? "s" : ""} fiche{producerSummary.create > 1 ? "s" : ""} ·{" "}
                {producerSummary.existing} déjà dans le registre · {producerSummary.flagged} doublon
                {producerSummary.flagged > 1 ? "s" : ""} probable{producerSummary.flagged > 1 ? "s" : ""} · {producerSummary.refused} refusé
                {producerSummary.refused > 1 ? "s" : ""}
              </p>
            ) : null}
          </div>
          <Card className="mt-3 overflow-hidden rounded-2xl">
            <ul aria-label="Lignes de l'onglet Producteurs">
              {producers.map((p) => {
                const outcome = producerOutcome(p, !previewed);
                const tone =
                  p.status === "refused"
                    ? "danger"
                    : p.status === "flagged"
                      ? "warning"
                      : p.action === "existing" || (!previewed && !p.created)
                        ? "neutral"
                        : "success";
                return (
                  <li
                    key={p.index}
                    className="grid grid-cols-[48px_minmax(0,1fr)] items-start gap-x-3 gap-y-1 border-b border-line px-4 py-3 last:border-0 sm:px-5 lg:grid-cols-[56px_minmax(0,1.2fr)_minmax(0,1fr)_170px_minmax(0,1.6fr)] lg:gap-4"
                  >
                    <span className="tabular font-mono text-[13px] text-muted">#{p.index}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] font-semibold">
                        {p.name || <span className="font-normal text-muted">Sans nom</span>}
                      </span>
                      {p.locality ? <span className="text-[12px] text-muted">{p.locality}</span> : null}
                    </span>
                    <span className="tabular truncate font-mono text-[12px] text-muted max-lg:col-start-2">
                      {[p.membership_number && `N° ${p.membership_number}`, p.phone].filter(Boolean).join(" · ") || "—"}
                    </span>
                    <span className="max-lg:col-start-2">
                      <StatusPill tone={tone}>{outcome}</StatusPill>
                    </span>
                    <span className="text-[13px] leading-5 text-muted max-lg:col-start-2">
                      {p.messages.length ? p.messages.join(" ") : "—"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Card>
        </section>
      ) : null}

      {lines.length > 0 ? (
        <section className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[16px] font-semibold">Détail ligne par ligne</h2>
            <nav aria-label="Filtrer les lignes" className="flex flex-wrap gap-1.5">
              {FILTERS.map(([value, text]) => (
                <Link
                  key={value}
                  href={value ? `?lignes=${value}` : "?"}
                  aria-current={filter === value ? "page" : undefined}
                  className={cn(
                    "rounded-full border px-3 py-1 text-[13px] font-medium",
                    filter === value ? "border-forest bg-forest text-white" : "border-line bg-canvas text-muted hover:text-ink",
                  )}
                >
                  {text}
                </Link>
              ))}
            </nav>
          </div>
          <Card className="mt-3 overflow-hidden rounded-2xl">
            <div aria-hidden className={`hidden border-b border-line bg-surface px-5 py-3 text-[12px] font-semibold text-muted lg:grid ${GRID} lg:gap-4`}>
              <span>Ligne</span>
              <span>Parcelle</span>
              <span>Statut</span>
              <span>{previewed ? "Exploitant" : "AgroID"}</span>
              <span>Motifs</span>
            </div>
            {shown.length === 0 ? (
              <p className="px-5 py-8 text-center text-[13px] text-muted">Aucune ligne dans cette catégorie.</p>
            ) : (
              <ul aria-label="Lignes du fichier">
                {shown.map((line) => {
                  const st = LINE_STATUS[line.status as LineStatus];
                  const area = "area_m2" in line ? line.area_m2 : null;
                  const operator = "operator" in line ? line.operator : null;
                  const operatorName = typeof operator === "string" ? operator : (operator as { name?: string } | null)?.name;
                  const agroid = "agroid" in line ? line.agroid : null;
                  return (
                    <li
                      key={line.index}
                      className={`grid grid-cols-[48px_minmax(0,1fr)] items-start gap-x-3 gap-y-1 border-b border-line px-4 py-3 last:border-0 sm:px-5 ${GRID} lg:gap-4`}
                    >
                      <span className="tabular font-mono text-[13px] text-muted">#{line.index}</span>
                      <span className="min-w-0">
                        <span className="block truncate text-[14px] font-semibold">
                          {line.label || <span className="font-normal text-muted">Sans nom</span>}
                        </span>
                        {area ? <span className="tabular font-mono text-[12px] text-muted">{formatArea(area)}</span> : null}
                      </span>
                      <span className="max-lg:col-start-2">
                        <StatusPill tone={st?.tone ?? "neutral"}>{st?.label ?? line.status}</StatusPill>
                      </span>
                      <span className="min-w-0 truncate text-[13px] max-lg:col-start-2">
                        {previewed ? (
                          operatorName || <span className="text-muted">—</span>
                        ) : agroid ? (
                          <Link href={`/parcelles?q=${agroid}`} className="hover:opacity-80">
                            <AgroIdBadge code={agroid} />
                          </Link>
                        ) : (
                          <span className="text-muted">Non créée</span>
                        )}
                      </span>
                      <span className="text-[13px] leading-5 text-muted max-lg:col-start-2">
                        {line.messages.length ? line.messages.join(" ") : "—"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </section>
      ) : record.status === "discarded" ? (
        <Alert tone="info" className="mt-6">
          Les lignes d’un import abandonné ne sont pas conservées.
        </Alert>
      ) : null}
    </AppShell>
  );
}
