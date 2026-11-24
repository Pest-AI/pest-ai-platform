import { ArrowLeft, Download, FileSpreadsheet, FolderArchive, Globe2, History, Route } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell, PageHeader } from "@/components/app-shell";
import { StatusPill } from "@/components/list-toolbar";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { currentWorkspace, getApi } from "@/lib/api/client";
import { COOPERATIVE_NAV } from "@/lib/navigation";
import { IMPORT_FORMATS, importStatus } from "@/lib/parcel-imports";
import { ORGANIZATION_TYPE_LABELS, formatDate, organizationInitials, primaryRoleLabel } from "@/lib/spaces";

import { UploadForm } from "./upload-form";

export const metadata: Metadata = { title: "Importer des parcelles" };

const FORMATS = [
  {
    icon: FileSpreadsheet,
    title: "Excel ou Google Sheets",
    text: "Le modèle « Coopérative » enregistre producteurs et parcelles en une fois. Un simple tableau de parcelles marche aussi.",
  },
  {
    icon: Globe2,
    title: "KML ou KMZ",
    text: "Export de Google Earth ou d'une application GPS. Le nom de chaque polygone devient le nom de la parcelle.",
  },
  {
    icon: FolderArchive,
    title: "Shapefile (.zip)",
    text: "Archive .zip avec les fichiers .shp, .shx, .dbf et .prj (projection). Toute projection est convertie.",
  },
  {
    icon: Route,
    title: "GPX, CSV, JSON, KoboToolbox",
    text: "Tour du champ au GPS (GPX), exports KoboToolbox / ODK, ou tableau avec latitude et longitude.",
  },
];

export default async function ParcelImportPage() {
  const workspace = await currentWorkspace();
  if (!workspace) redirect("/espaces");
  const api = await getApi();
  const header = { "X-Workspace": workspace };
  const [{ data: me }, orgResult, historyResult, contextResult] = await Promise.all([
    api.GET("/api/v1/me/"),
    api.GET("/api/v1/organization/", { params: { header } }),
    api.GET("/api/v1/parcel-imports/", { params: { header } }),
    api.GET("/api/v1/workspace/", { headers: header }),
  ]);
  if (!me) redirect("/connexion?erreur=session");
  if (!orgResult.data) redirect("/espaces?erreur=acces");
  const org = orgResult.data;
  const roles = me.memberships.find((m) => m.workspace === workspace)?.roles ?? [];
  const typeLabel = ORGANIZATION_TYPE_LABELS[org.organization_type] ?? org.organization_type;
  const permissions = new Set(contextResult.data?.permissions ?? []);
  const allowed = permissions.has("parcels.manage") && historyResult.response.ok;
  const history = historyResult.data?.results ?? [];

  return (
    <AppShell
      nav={COOPERATIVE_NAV}
      activeHref="/parcelles"
      workspace={{ name: org.short_name || org.name, roleLabel: typeLabel, initials: organizationInitials(org.name) }}
      user={{ firstName: me.first_name, lastName: me.last_name, roleLabel: primaryRoleLabel(roles) }}
      breadcrumbs={[org.short_name || org.name, "Parcelles & AgroID", "Importer"]}
    >
      <Link href="/parcelles" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-700 hover:underline">
        <ArrowLeft className="size-4" aria-hidden />
        Parcelles
      </Link>
      <PageHeader
        context={`${org.name} · ${typeLabel}`}
        title="Importer des parcelles"
        description="Enregistrez plusieurs parcelles, et leurs producteurs, à la fois depuis un fichier. Vous vérifiez l'aperçu avant toute création ; chaque parcelle créée reçoit son AgroID."
        actions={
          allowed ? (
            <Button asChild variant="secondary" className="h-10 rounded-xl">
              <a href="/parcelles/import/modele" download>
                <Download aria-hidden />
                Modèle Excel « Coopérative »
              </a>
            </Button>
          ) : undefined
        }
      />

      {!allowed ? (
        <Alert tone="info" className="mt-6">
          L’import de parcelles est réservé à l’administrateur et au gérant de l’organisation.
        </Alert>
      ) : (
        <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <Card className="rounded-2xl p-5">
            <UploadForm />
          </Card>
          <Card className="rounded-2xl p-5">
            <h2 className="text-[15px] font-semibold">Formats acceptés</h2>
            <ul className="mt-3 space-y-3.5">
              {FORMATS.map(({ icon: Icon, title, text }) => (
                <li key={title} className="flex gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-forest">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span>
                    <span className="block text-[14px] font-semibold">{title}</span>
                    <span className="block text-[13px] leading-5 text-muted">{text}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-4 border-t border-line pt-3 text-[12px] leading-5 text-muted">
              Une colonne « n° d’adhérent » ou « téléphone » relie chaque parcelle à son exploitant. 1 000 lignes au
              plus par fichier ; contours importés à confirmer par un relevé terrain.
            </p>
          </Card>
        </div>
      )}

      {allowed && history.length > 0 ? (
        <section className="mt-8">
          <h2 className="flex items-center gap-2 text-[16px] font-semibold">
            <History className="size-4 text-leaf" aria-hidden />
            Imports précédents
          </h2>
          <Card className="mt-3 overflow-hidden rounded-2xl">
            <ul aria-label="Imports précédents">
              {history.map((item) => {
                const st = importStatus(item.status);
                return (
                  <li key={item.id} className="border-b border-line last:border-0">
                    <Link
                      href={`/parcelles/import/${item.id}`}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-5 py-3.5 hover:bg-surface sm:grid-cols-[minmax(0,1fr)_90px_150px_130px_90px]"
                    >
                      <span className="min-w-0 truncate text-[14px] font-semibold">{item.file_name}</span>
                      <span className="text-[13px] text-muted max-sm:hidden">{IMPORT_FORMATS[item.file_format] ?? item.file_format}</span>
                      <span className="tabular text-[13px] text-muted max-sm:hidden">
                        {item.status === "committed"
                          ? `${item.parcels_created} parcelle${item.parcels_created > 1 ? "s" : ""}${item.producers_created ? ` · ${item.producers_created} producteur${item.producers_created > 1 ? "s" : ""}` : ""}`
                          : `${item.summary.total} ligne${item.summary.total > 1 ? "s" : ""}`}
                      </span>
                      <span>
                        <StatusPill tone={st.tone}>{st.label}</StatusPill>
                      </span>
                      <span className="tabular text-right font-mono text-[12px] text-muted max-sm:hidden">{formatDate(item.created_at)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>
        </section>
      ) : null}
    </AppShell>
  );
}
