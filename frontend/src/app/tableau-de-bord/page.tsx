import { CalendarRange, Fingerprint, Map, Users } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AppShell, PageHeader, Stat, StatRow } from "@/components/app-shell";
import { Badge, StatusDot } from "@/components/ui/badge";
import { Card, SectionLabel } from "@/components/ui/card";
import { currentWorkspace, getApi } from "@/lib/api/client";
import { COOPERATIVE_NAV } from "@/lib/navigation";
import {
  ORGANIZATION_STATUS,
  ORGANIZATION_TYPE_LABELS,
  ROLE_LABELS,
  formatDate,
  organizationInitials,
  primaryRoleLabel,
} from "@/lib/spaces";

export const metadata: Metadata = { title: "Vue d'ensemble" };

const UPCOMING = [
  { icon: Map, title: "Carte des parcelles", text: "Registre cartographique et explorateur, contours GPS." },
  { icon: Fingerprint, title: "AgroID", text: "Une identité numérique unique pour chaque parcelle." },
  { icon: Users, title: "Producteurs", text: "Exploitants et propriétaires, avec leur consentement." },
  { icon: CalendarRange, title: "Campagnes", text: "Cycles de culture, opérations et récoltes tracées." },
];

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
  const membership = me.memberships.find((m) => m.workspace === workspace);
  const roles = membership?.roles ?? [];
  const status = ORGANIZATION_STATUS[org.status] ?? { label: org.status, tone: "neutral" as const };
  const members = membersResult.data
    ? membersResult.data.results.filter((m) => m.status === "active").length
    : null;
  const membersIsPartial = membersResult.data ? Boolean(membersResult.data.next) : false;

  return (
    <AppShell
      nav={COOPERATIVE_NAV}
      activeHref="/tableau-de-bord"
      workspace={{ name: org.name, roleLabel: primaryRoleLabel(roles), initials: organizationInitials(org.name) }}
      user={{ firstName: me.first_name, lastName: me.last_name, roleLabel: primaryRoleLabel(roles) }}
      breadcrumbs={[org.short_name || org.name, "Vue d'ensemble"]}
    >
      <PageHeader
        overline={ORGANIZATION_TYPE_LABELS[org.organization_type] ?? org.organization_type}
        title="Vue d'ensemble"
        description={`Le registre des parcelles, les campagnes et l'activité terrain de ${org.name}.`}
      />

      <StatRow>
        <Stat
          label="Membres actifs"
          value={members === null ? "—" : `${members}${membersIsPartial ? "+" : ""}`}
          hint={members === null ? "Visible par les gérants" : "dans l'organisation"}
        />
        <Stat label="Parcelles AgroID" value="—" hint="Registre bientôt disponible" />
        <Stat label="Surface cartographiée" value="—" unit="ha" hint="Registre bientôt disponible" />
        <Stat label="Producteurs" value="—" hint="Registre bientôt disponible" />
      </StatRow>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_340px]">
        <section aria-labelledby="registre">
          <SectionLabel id="registre">Registre AgroID</SectionLabel>
          <Card className="mt-3 overflow-hidden">
            <div className="relative h-44 bg-[#c3c9b6]">
              <svg viewBox="0 0 640 176" preserveAspectRatio="xMidYMid slice" className="h-full w-full" aria-hidden>
                <path d="M0 18c120-14 230 12 330-2s210-12 310-4V0H0Z" fill="#9fb1b3" />
                {[
                  "m20 40 120-4 4 56-120 4Z",
                  "m24 108 120-4 4 56-120 4Z",
                  "m160 34 110-4 4 60-110 4Z",
                  "m166 108 110-4 4 56-110 4Z",
                  "m292 30 120-4 4 62-120 4Z",
                  "m300 108 116-4 4 56-116 4Z",
                  "m434 28 90-3 4 64-90 3Z",
                  "m440 108 90-3 4 56-90 3Z",
                  "m548 26 84-3 4 66-84 3Z",
                ].map((d) => (
                  <path key={d} d={d} fill="#ffffff" fillOpacity="0.28" stroke="#ffffff" strokeOpacity="0.9" strokeDasharray="5 4" strokeWidth="1.5" />
                ))}
                <path d="m0 100 640-6" stroke="#dcd8c8" strokeWidth="4" />
              </svg>
              <div className="absolute inset-0 grid place-items-center">
                <span className="rounded-full bg-white/95 px-3 py-1 text-[12px] font-medium text-ink shadow-pop">
                  Aucune parcelle enregistrée pour le moment
                </span>
              </div>
            </div>
            <ul className="grid gap-px bg-line sm:grid-cols-2">
              {UPCOMING.map(({ icon: Icon, title, text }) => (
                <li key={title} className="flex gap-3 bg-canvas p-4">
                  <Icon className="mt-0.5 size-4 shrink-0 text-leaf" aria-hidden />
                  <span>
                    <span className="block text-[13px] font-semibold">{title}</span>
                    <span className="block text-[13px] text-muted">{text}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </section>

        <section aria-labelledby="organisation">
          <SectionLabel id="organisation">Votre organisation</SectionLabel>
          <Card className="mt-3 p-5">
            <dl className="text-[13px]">
              {[
                ["Nom", org.name],
                ["Type", ORGANIZATION_TYPE_LABELS[org.organization_type] ?? org.organization_type],
                ["Pays", org.country_code === "SN" ? "Sénégal" : org.country_code],
                ["Inscrite le", formatDate(org.created_at)],
                ...(org.legal_identifier ? [["NINEA", org.legal_identifier]] : []),
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 border-b border-line py-2.5 first:pt-0">
                  <dt className="text-muted">{k}</dt>
                  <dd className="text-right font-medium">{v}</dd>
                </div>
              ))}
              <div className="flex justify-between gap-4 border-b border-line py-2.5">
                <dt className="text-muted">Statut</dt>
                <dd>
                  <StatusDot tone={status.tone}>{status.label}</StatusDot>
                </dd>
              </div>
              <div className="flex justify-between gap-4 pt-2.5">
                <dt className="text-muted">Vos rôles</dt>
                <dd className="flex flex-wrap justify-end gap-1">
                  {roles.length ? (
                    roles.map((r) => (
                      <Badge key={r} tone="brand">
                        {ROLE_LABELS[r] ?? r}
                      </Badge>
                    ))
                  ) : (
                    <span className="font-medium">Membre</span>
                  )}
                </dd>
              </div>
            </dl>
          </Card>
        </section>
      </div>
    </AppShell>
  );
}
