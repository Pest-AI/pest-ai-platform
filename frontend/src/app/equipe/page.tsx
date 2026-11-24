import { KeyRound, MailOpen, Phone, Search, ShieldOff, UsersRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell, PageHeader, Stat, StatRow } from "@/components/app-shell";
import { Alert } from "@/components/ui/alert";
import { StatusPill } from "@/components/list-toolbar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { currentWorkspace, getApi } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";
import { COOPERATIVE_NAV } from "@/lib/navigation";
import { formatPhone } from "@/lib/phone";
import { managedByPestAi, teamRights } from "@/lib/roles";
import { ORGANIZATION_TYPE_LABELS, ROLE_LABELS, formatDate, organizationInitials, primaryRoleLabel } from "@/lib/spaces";
import { cn } from "@/lib/utils";

import { InviteDialog } from "./invite-dialog";
import { MemberDialog } from "./member-dialog";

export const metadata: Metadata = { title: "Équipe" };

type Membership = components["schemas"]["Membership"];

const STATUS = {
  active: { label: "Actif", tone: "success" },
  invited: { label: "Invité", tone: "warning" },
  suspended: { label: "Suspendu", tone: "danger" },
  revoked: { label: "Retiré", tone: "neutral" },
} as const;

const TABS = [
  ["", "Tous"],
  ["active", "Actifs"],
  ["invited", "Invités"],
  ["suspended", "Suspendus"],
  ["revoked", "Retirés"],
] as const;

const GRID = "lg:grid-cols-[minmax(0,1.4fr)_180px_minmax(0,1.2fr)_minmax(0,0.8fr)_100px_84px]";

function normalize(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ statut?: string; q?: string }>;
}) {
  const params = await searchParams;
  const tab = TABS.some(([key]) => key === params.statut) ? (params.statut ?? "") : "";
  const q = (params.q ?? "").trim();
  const workspace = await currentWorkspace();
  if (!workspace) redirect("/espaces");

  const api = await getApi();
  const header = { "X-Workspace": workspace };
  const [{ data: me }, orgResult] = await Promise.all([
    api.GET("/api/v1/me/"),
    api.GET("/api/v1/organization/", { params: { header } }),
  ]);
  if (!me) redirect("/connexion?erreur=session");
  if (!orgResult.data) redirect("/espaces?erreur=acces");
  const org = orgResult.data;
  const roles = me.memberships.find((m) => m.workspace === workspace)?.roles ?? [];
  const { isAdmin, canManage } = teamRights(roles);

  // Toutes les pages de la liste (50 par page).
  let members: Membership[] = [];
  let forbidden = false;
  for (let page = 1; page <= 20; page++) {
    const { data, response } = await api.GET("/api/v1/memberships/", { params: { header, query: { page } } });
    if (response.status === 403) {
      forbidden = true;
      break;
    }
    if (!data) break;
    members = members.concat(data.results);
    if (!data.next) break;
  }

  const count = (s: Membership["status"]) => members.filter((m) => m.status === s).length;
  const toActivate = members.filter((m) => m.status !== "revoked" && !m.user.account_activated).length;
  const needle = normalize(q.replace(/\s+/g, ""));
  const visible = members
    .filter((m) => (tab ? m.status === tab : m.status !== "revoked"))
    .filter((m) => {
      if (!needle) return true;
      const hay = normalize(`${m.user.first_name}${m.user.last_name}${m.user.phone_number}`.replace(/\s+/g, ""));
      return hay.includes(needle);
    });
  const tabCount = (key: string) => (key ? count(key as Membership["status"]) : members.length - count("revoked"));
  const typeLabel = ORGANIZATION_TYPE_LABELS[org.organization_type] ?? org.organization_type;

  return (
    <AppShell
      nav={COOPERATIVE_NAV}
      activeHref="/equipe"
      workspace={{ name: org.short_name || org.name, roleLabel: typeLabel, initials: organizationInitials(org.name) }}
      user={{ firstName: me.first_name, lastName: me.last_name, roleLabel: primaryRoleLabel(roles) }}
      breadcrumbs={[org.short_name || org.name, "Équipe"]}
    >
      <PageHeader
        context={`${org.name} · ${typeLabel}`}
        title="Équipe"
        description="Les membres de l'organisation, leurs rôles et leurs accès."
        actions={canManage ? <InviteDialog isAdmin={isAdmin} organization={org.name} /> : undefined}
      />

      {forbidden ? (
        <Alert tone="info" className="mt-6">
          La liste de l&apos;équipe est réservée aux administrateurs et aux gérants de l&apos;organisation.
        </Alert>
      ) : (
        <>
          <StatRow>
            <Stat label="Membres actifs" icon={UsersRound} value={String(count("active"))} valueTone="success" hint="accès ouvert" hintTone="success" />
            <Stat label="Invitations" icon={MailOpen} iconTone="gold" value={String(count("invited"))} hint="en attente d'acceptation" />
            <Stat
              label="Comptes à activer"
              icon={KeyRound}
              iconTone="gold"
              value={String(toActivate)}
              valueTone={toActivate ? "warning" : "ink"}
              hint={toActivate ? "code à transmettre" : "tous activés"}
              hintTone={toActivate ? "warning" : "muted"}
            />
            <Stat label="Suspendus" icon={ShieldOff} iconTone="night" value={String(count("suspended"))} hint="sans suppression" />
          </StatRow>

          <form
            action="/equipe"
            role="search"
            className="mt-5 flex flex-col gap-3 rounded-2xl border border-line bg-canvas p-3.5 shadow-[0_2px_10px_-4px_rgb(11_25_41/0.06)] md:flex-row md:items-center md:justify-between"
          >
            {tab ? <input type="hidden" name="statut" value={tab} /> : null}
            <nav aria-label="Filtrer par statut" className="-mx-1 flex gap-1 overflow-x-auto rounded-xl bg-subtle p-1">
              {TABS.map(([key, label]) => {
                const active = key === tab;
                const href = `/equipe${key || q ? `?${new URLSearchParams({ ...(key ? { statut: key } : {}), ...(q ? { q } : {}) })}` : ""}`;
                return (
                  <Link
                    key={key || "tous"}
                    href={href}
                    aria-current={active ? "true" : undefined}
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors",
                      active ? "bg-canvas text-forest shadow-card" : "text-muted hover:text-ink",
                    )}
                  >
                    {label}
                    <span className={cn("tabular font-mono text-[11px]", active ? "text-leaf" : "text-muted")}>{tabCount(key)}</span>
                  </Link>
                );
              })}
            </nav>
            <div className="relative w-full md:max-w-xs">
              <label htmlFor="team-q" className="sr-only">
                Rechercher un membre
              </label>
              <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" aria-hidden />
              <input
                id="team-q"
                name="q"
                defaultValue={q}
                placeholder="Rechercher par nom ou téléphone…"
                className="h-10 w-full rounded-xl border border-line bg-surface pr-3 pl-10 text-[14px] placeholder:text-muted focus:border-leaf focus:bg-canvas focus:ring-2 focus:ring-leaf/15 focus:outline-none"
              />
            </div>
          </form>

          <Card className="mt-4 overflow-hidden rounded-2xl">
            <div
              aria-hidden
              className={`hidden border-b border-line bg-surface px-5 py-3 text-[12px] font-semibold text-muted lg:grid ${GRID} lg:gap-4`}
            >
              <span>Membre</span>
              <span>Téléphone</span>
              <span>Rôle</span>
              <span>Statut</span>
              <span>Depuis</span>
              <span className="text-right">Actions</span>
            </div>
            {visible.length === 0 ? (
              <p className="px-6 py-12 text-center text-[14px] text-muted">Aucun membre dans cette vue.</p>
            ) : (
              <ul aria-label="Membres de l'organisation">
                {visible.map((m) => {
                  const status = STATUS[m.status];
                  const isSelf = m.user.id === me.id;
                  return (
                    <li
                      key={m.id}
                      className={cn(
                        `grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 border-b border-line px-4 py-3.5 last:border-0 sm:px-5 ${GRID} lg:gap-4`,
                        m.status === "revoked" && "text-muted",
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span
                          className={cn(
                            "grid size-10 shrink-0 place-items-center rounded-full font-display text-[12px] font-bold",
                            m.roles.includes("organization_admin") ? "bg-night text-white" : "bg-brand-50 text-forest",
                          )}
                        >
                          {`${m.user.first_name.charAt(0)}${m.user.last_name.charAt(0)}`.toUpperCase()}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[14px] font-semibold">
                            {m.user.first_name} {m.user.last_name}
                            {isSelf ? <span className="ml-1.5 text-[12px] font-normal text-muted">(vous)</span> : null}
                          </span>
                          <span className="block truncate text-[12px] text-muted">
                            {m.roles.length ? primaryRoleLabel(m.roles) : "Aucun rôle"}
                            {!m.user.account_activated && m.status !== "revoked" ? (
                              <span className="text-[#b07d00]"> · compte à activer</span>
                            ) : null}
                          </span>
                        </span>
                      </span>
                      <span className="hidden items-center gap-2 lg:flex">
                        <Phone className="size-4 shrink-0 text-leaf" aria-hidden />
                        <span className="tabular truncate font-mono text-[13px]">{formatPhone(m.user.phone_number)}</span>
                      </span>
                      <span className="col-start-1 row-start-2 flex flex-wrap items-center gap-1.5 pl-[52px] lg:col-start-auto lg:row-start-auto lg:pl-0">
                        {m.roles.map((r) => (
                          <Badge key={r} tone={r === "organization_admin" ? "dark" : "brand"} className="max-lg:hidden">
                            {ROLE_LABELS[r] ?? r}
                          </Badge>
                        ))}
                        <span className="lg:hidden">
                          <StatusPill tone={status.tone}>{status.label}</StatusPill>
                        </span>
                      </span>
                      <span className="hidden lg:block">
                        <StatusPill tone={status.tone}>{status.label}</StatusPill>
                      </span>
                      <span className="tabular hidden font-mono text-[13px] text-muted lg:block">
                        {formatDate(m.joined_at ?? m.created_at)}
                      </span>
                      <span className="col-start-2 row-span-2 row-start-1 text-right lg:col-start-auto lg:row-span-1 lg:row-start-auto">
                        {canManage && managedByPestAi(m.roles) ? (
                          <span
                            className="text-[13px] font-semibold text-muted"
                            title="Les agents terrain sont recrutés et affectés par PEST AI."
                          >
                            Géré par PEST AI
                          </span>
                        ) : canManage ? (
                          <MemberDialog
                            isAdmin={isAdmin}
                            isSelf={isSelf}
                            organization={org.name}
                            member={{
                              id: m.id,
                              firstName: m.user.first_name,
                              lastName: m.user.last_name,
                              phone: m.user.phone_number,
                              roles: [...m.roles],
                              status: m.status,
                              accountActivated: m.user.account_activated,
                            }}
                          />
                        ) : null}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </>
      )}
    </AppShell>
  );
}
