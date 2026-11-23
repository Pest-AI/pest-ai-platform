import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell, PageHeader, Stat, StatRow } from "@/components/app-shell";
import { Badge, type BadgeTone, StatusDot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getApi } from "@/lib/api/client";
import { ADMIN_NAV } from "@/lib/navigation";
import { ORGANIZATION_STATUS, ORGANIZATION_TYPE_LABELS, formatDate, organizationInitials } from "@/lib/spaces";
import { cn } from "@/lib/utils";

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
      workspace={{ name: "Console d'administration", roleLabel: "Super-admin", initials: "PA", dark: true }}
      user={{ firstName: me.first_name, lastName: me.last_name, roleLabel: "Super-admin" }}
      breadcrumbs={["Console d'administration", "Organisations"]}
    >
      <PageHeader
        title="Organisations"
        description="Coopératives, ONG et programmes inscrits sur PEST AI OS."
        actions={
          <Button disabled title="Bientôt disponible">
            <Plus aria-hidden />
            Nouvelle organisation
          </Button>
        }
      />

      <StatRow>
        <Stat label="Organisations" value={String(total)} hint="inscrites sur la plateforme" />
        <Stat label="Actives" value={complete ? String(count("active")) : "—"} hintTone="success" hint="accès ouvert" />
        <Stat label="En attente" value={complete ? String(count("pending")) : "—"} hintTone="warning" hint="à activer" />
        <Stat
          label="Suspendues ou fermées"
          value={complete ? String(count("suspended") + count("closed")) : "—"}
          hint="accès fermé"
        />
      </StatRow>

      <Card className="mt-8 overflow-hidden">
        {organizations.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="font-display text-[16px] font-semibold">Aucune organisation</p>
            <p className="mt-1 text-[13px] text-muted">Les organisations créées apparaîtront ici.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-[14px]">
              <thead className="border-b border-line bg-surface text-[12px] text-muted">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium">Organisation</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Type</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Pays</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Contact</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Statut</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Créée le</th>
                </tr>
              </thead>
              <tbody>
                {organizations.map((o) => {
                  const status = o.is_archived
                    ? { label: "Archivée", tone: "neutral" as const }
                    : (ORGANIZATION_STATUS[o.status ?? "pending"] ?? { label: String(o.status), tone: "neutral" as const });
                  return (
                    <tr key={o.id} className={cn("border-b border-line last:border-0", o.is_archived && "text-muted")}>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-3">
                          <span className="grid size-8 shrink-0 place-items-center rounded-md bg-subtle text-[11px] font-semibold text-ink">
                            {organizationInitials(o.name)}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{o.name}</span>
                            {o.short_name ? <span className="block text-[12px] text-muted">{o.short_name}</span> : null}
                          </span>
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={TYPE_TONE[o.organization_type] ?? "neutral"}>
                          {ORGANIZATION_TYPE_LABELS[o.organization_type] ?? o.organization_type}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted">{o.country_code === "SN" ? "Sénégal" : o.country_code}</td>
                      <td className="px-4 py-3 text-muted">{o.phone_number || o.email || "—"}</td>
                      <td className="px-4 py-3">
                        <StatusDot tone={status.tone}>{status.label}</StatusDot>
                      </td>
                      <td className="tabular px-4 py-3 text-muted">{formatDate(o.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-[13px] text-muted">
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
