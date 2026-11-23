import { Building2, CircleCheck, CircleDashed, CirclePause, ChevronLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell, PageHeader, Stat, StatRow } from "@/components/app-shell";
import { StatusPill } from "@/components/list-toolbar";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getApi } from "@/lib/api/client";
import { ADMIN_NAV } from "@/lib/navigation";
import { ORGANIZATION_STATUS, ORGANIZATION_TYPE_LABELS, formatDate, organizationInitials } from "@/lib/spaces";
import { cn } from "@/lib/utils";

import { CreateOrganizationDialog, DesignateAdminDialog } from "./organization-dialogs";

export const metadata: Metadata = { title: "Organisations · Console d'administration" };

const TYPE_TONE: Record<string, BadgeTone> = {
  cooperative: "brand",
  union: "brand",
  ngo: "warning",
  pest_ai: "dark",
};

function pageNumber(value: string | undefined) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

export default async function AdminOrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const page = pageNumber((await searchParams).page);
  const api = await getApi();
  const { data: me } = await api.GET("/api/v1/me/");
  if (!me) redirect("/connexion?erreur=session");
  if (!me.is_platform_admin) redirect("/espaces?erreur=acces");

  const { data, response } = await api.GET("/api/v1/platform/organizations/", { params: { query: { page } } });
  if (response.status === 403) redirect("/espaces?erreur=acces");
  if (response.status === 404 && page > 1) redirect("/admin/organisations");

  const organizations = data?.results ?? [];
  const total = data?.count ?? 0;
  const complete = !data?.next && !data?.previous;
  const count = (status: string) => organizations.filter((o) => o.status === status && !o.is_archived).length;
  const pageSize = 50;
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = (page - 1) * pageSize + organizations.length;

  return (
    <AppShell
      nav={ADMIN_NAV}
      activeHref="/admin/organisations"
      workspace={{ name: "Console d'administration", roleLabel: "Plateforme PEST AI", initials: "PA", dark: true }}
      user={{ firstName: me.first_name, lastName: me.last_name, roleLabel: "Super-admin" }}
      breadcrumbs={["Console d'administration", "Organisations"]}
      spaceLabel="Console Admin"
      search={null}
    >
      <PageHeader
        context="Plateforme PEST AI · Console d'administration"
        title="Organisations"
        description="Coopératives, ONG et programmes inscrits sur PEST AI OS."
        actions={
          <CreateOrganizationDialog />
        }
      />

      <StatRow>
        <Stat label="Organisations" icon={Building2} value={String(total)} />
        <Stat label="Actives" icon={CircleCheck} valueTone="success" value={complete ? String(count("active")) : "—"} hint="accès ouvert" hintTone="success" />
        <Stat label="En attente" icon={CircleDashed} iconTone="gold" valueTone="warning" value={complete ? String(count("pending")) : "—"} hint="à activer" hintTone="warning" />
        <Stat
          label="Suspendues ou fermées"
          icon={CirclePause}
          iconTone="night"
          value={complete ? String(count("suspended") + count("closed")) : "—"}
        />
      </StatRow>

      <Card className="mt-5 overflow-hidden rounded-2xl">
        {organizations.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="font-display text-[16px] font-semibold">Aucune organisation</p>
            <p className="mt-1 text-[13px] text-muted">Les organisations créées apparaîtront ici.</p>
          </div>
        ) : (
          <>
            <div
              aria-hidden
              className="hidden border-b border-line bg-surface px-5 py-3 text-[12px] font-semibold text-muted md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_110px_auto] md:gap-4"
            >
              <span>Organisation</span>
              <span>Type</span>
              <span>Statut</span>
              <span>Créée le</span>
              <span className="w-[150px]" />
            </div>
            <ul aria-label="Organisations">
              {organizations.map((o) => {
                const status = o.is_archived
                  ? { label: "Archivée", tone: "neutral" as const }
                  : (ORGANIZATION_STATUS[o.status ?? "pending"] ?? { label: String(o.status), tone: "neutral" as const });
                return (
                  <li
                    key={o.id}
                    className={cn(
                      "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 border-b border-line px-4 py-3.5 last:border-0 sm:px-5 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_110px_auto] md:gap-4",
                      o.is_archived && "text-muted",
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-subtle font-display text-[11px] font-bold text-ink">
                        {organizationInitials(o.name)}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[14px] font-semibold">{o.name}</span>
                        {o.short_name ? <span className="block truncate text-[12px] text-muted">{o.short_name}</span> : null}
                      </span>
                    </span>
                    <span className="col-start-1 row-start-2 flex flex-wrap items-center gap-2 pl-12 md:col-start-auto md:row-start-auto md:pl-0">
                      <Badge tone={TYPE_TONE[o.organization_type] ?? "neutral"}>
                        {ORGANIZATION_TYPE_LABELS[o.organization_type] ?? o.organization_type}
                      </Badge>
                      <span className="md:hidden">
                        <StatusPill tone={status.tone}>{status.label}</StatusPill>
                      </span>
                    </span>
                    <span className="hidden md:block">
                      <StatusPill tone={status.tone}>{status.label}</StatusPill>
                    </span>
                    <span className="tabular hidden font-mono text-[13px] text-muted md:block">{formatDate(o.created_at)}</span>
                    <span className="col-start-2 row-span-2 row-start-1 text-right md:col-start-auto md:row-span-1 md:row-start-auto md:w-[150px]">
                      {!o.is_archived && o.status !== "closed" ? (
                        <DesignateAdminDialog organizationId={o.id} organization={o.name} />
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface/60 px-5 py-3 text-[13px] text-muted">
          <span>
            {from}–{to} sur {total} organisation{total > 1 ? "s" : ""}
          </span>
          <div className="flex gap-2">
            {data?.previous ? (
              <Button asChild variant="secondary" size="sm">
                <Link href={`/admin/organisations?page=${page - 1}`}>
                  <ChevronLeft aria-hidden />
                  Précédent
                </Link>
              </Button>
            ) : null}
            {data?.next ? (
              <Button asChild variant="secondary" size="sm">
                <Link href={`/admin/organisations?page=${page + 1}`}>
                  Suivant
                  <ChevronRight aria-hidden />
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      </Card>
    </AppShell>
  );
}
