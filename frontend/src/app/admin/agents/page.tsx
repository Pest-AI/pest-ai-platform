import { CircleCheck, CircleDashed, CirclePause, Route } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell, PageHeader, Stat, StatRow } from "@/components/app-shell";
import { StatusPill } from "@/components/list-toolbar";
import { Card } from "@/components/ui/card";
import { getApi, getMe } from "@/lib/api/client";
import { ADMIN_NAV } from "@/lib/navigation";
import { formatPhone } from "@/lib/phone";
import { formatDate } from "@/lib/spaces";
import { cn } from "@/lib/utils";

import { type AgentRow, ManageAgentDialog, NewAgentDialog, type OrganizationOption } from "./agent-dialogs";

export const metadata: Metadata = { title: "Agents terrain · Console d'administration" };

const STATUS = {
  active: { label: "Actif", tone: "success" },
  invited: { label: "Affecté, en attente", tone: "warning" },
  suspended: { label: "Suspendu", tone: "danger" },
  revoked: { label: "Retiré", tone: "neutral" },
} as const;

const GRID = "md:grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)_170px_minmax(0,1fr)_100px_84px]";
const MAX_ORG_PAGES = 20;

/** Agents terrain : recrutés, affectés et gérés par PEST AI uniquement (24/11/2026). */
export default async function AdminAgentsPage({ searchParams }: { searchParams: Promise<{ organisation?: string }> }) {
  const filter = (await searchParams).organisation ?? "";
  const me = await getMe();
  if (!me) redirect("/connexion?erreur=session");
  if (!me.is_platform_admin) redirect("/espaces?erreur=acces");
  const api = await getApi();

  // Organisations ouvertes à l'affectation (actives ou en attente, non archivées).
  const organizations: OrganizationOption[] = [];
  for (let page = 1; page <= MAX_ORG_PAGES; page++) {
    const { data } = await api.GET("/api/v1/platform/organizations/", { params: { query: { page } } });
    if (!data) break;
    for (const o of data.results) {
      if (!o.is_archived && o.status !== "closed" && o.organization_type !== "pest_ai") {
        organizations.push({ id: o.id, name: o.short_name ? `${o.name} (${o.short_name})` : o.name });
      }
    }
    if (!data.next) break;
  }

  const { data, response } = await api.GET("/api/v1/platform/agents/", {
    params: { query: filter ? { organization: filter } : {} },
  });
  if (response.status === 403) redirect("/espaces?erreur=acces");
  const agents = data?.results ?? [];
  const count = (s: string) => agents.filter((a) => a.status === s).length;

  return (
    <AppShell
      nav={ADMIN_NAV}
      activeHref="/admin/agents"
      workspace={{ name: "Console d'administration", roleLabel: "Plateforme PEST AI", initials: "PA", dark: true }}
      user={{ firstName: me.first_name, lastName: me.last_name, roleLabel: "Super-admin" }}
      breadcrumbs={["Console d'administration", "Agents terrain"]}
      spaceLabel="Console Admin"
      search={null}
    >
      <PageHeader
        context="Plateforme PEST AI · Console d'administration"
        title="Agents terrain"
        description="Recrutés et affectés par PEST AI. Les coopératives voient leurs agents sans pouvoir les modifier ; les agents travaillent dans l'application terrain."
        actions={<NewAgentDialog organizations={organizations} />}
      />

      <StatRow>
        <Stat label="Agents" icon={Route} value={String(data?.count ?? 0)} />
        <Stat label="Actifs" icon={CircleCheck} valueTone="success" value={String(count("active"))} />
        <Stat label="En attente d'activation" icon={CircleDashed} iconTone="gold" valueTone="warning" value={String(count("invited"))} />
        <Stat label="Suspendus" icon={CirclePause} iconTone="night" value={String(count("suspended"))} />
      </StatRow>

      <form className="mt-5 flex flex-wrap items-end gap-2" action="/admin/agents">
        <label className="space-y-1.5">
          <span className="block text-[13px] font-medium">Coopérative</span>
          <select
            name="organisation"
            defaultValue={filter}
            className="h-10 min-w-[260px] rounded-lg border border-field bg-canvas px-3 text-[14px]"
          >
            <option value="">Toutes</option>
            {organizations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="h-10 rounded-lg border border-line bg-canvas px-4 text-[14px] font-semibold">
          Filtrer
        </button>
        {filter ? (
          <Link href="/admin/agents" className="h-10 px-2 text-[14px] leading-10 text-muted underline">
            Effacer
          </Link>
        ) : null}
      </form>

      <Card className="mt-4 overflow-hidden rounded-2xl">
        {agents.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="font-display text-[16px] font-semibold">Aucun agent terrain</p>
            <p className="mt-1 text-[13px] text-muted">
              {filter ? "Aucun agent affecté à cette coopérative." : "Créez un agent et affectez-le à une coopérative."}
            </p>
          </div>
        ) : (
          <>
            <div
              aria-hidden
              className={cn("hidden gap-4 border-b border-line bg-surface px-5 py-3 text-[12px] font-semibold text-muted md:grid", GRID)}
            >
              <span>Agent</span>
              <span>Coopérative</span>
              <span>Téléphone</span>
              <span>Statut</span>
              <span>Depuis le</span>
              <span />
            </div>
            <ul aria-label="Agents terrain">
              {agents.map((a) => {
                const status = STATUS[a.status as keyof typeof STATUS] ?? STATUS.invited;
                const row: AgentRow = {
                  id: a.id,
                  firstName: a.user.first_name,
                  lastName: a.user.last_name,
                  phone: a.user.phone_number,
                  status: a.status,
                  organization: a.organization.short_name || a.organization.name,
                  accountActivated: a.user.account_activated,
                };
                return (
                  <li
                    key={a.id}
                    className={cn(
                      "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-b border-line px-4 py-3.5 last:border-0 sm:px-5 md:gap-4",
                      GRID,
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] font-semibold">
                        {a.user.first_name} {a.user.last_name}
                      </span>
                      {!a.user.account_activated ? (
                        <span className="block text-[12px] text-muted">Compte pas encore activé</span>
                      ) : null}
                    </span>
                    <span className="col-start-1 truncate text-[14px] md:col-start-auto">{row.organization}</span>
                    <span className="tabular col-start-1 font-mono text-[13px] md:col-start-auto">{formatPhone(a.user.phone_number)}</span>
                    <span className="col-start-1 md:col-start-auto">
                      <StatusPill tone={status.tone}>{status.label}</StatusPill>
                    </span>
                    <span className="tabular hidden font-mono text-[13px] text-muted md:block">
                      {formatDate(a.joined_at ?? a.created_at)}
                    </span>
                    <span className="col-start-2 row-span-4 row-start-1 text-right md:col-start-auto md:row-span-1 md:row-start-auto">
                      <ManageAgentDialog agent={row} />
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Card>
    </AppShell>
  );
}
