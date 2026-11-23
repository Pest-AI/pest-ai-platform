import { KeyRound, MailOpen, ShieldOff, UsersRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell, PageHeader, Stat, StatRow } from "@/components/app-shell";
import { Alert } from "@/components/ui/alert";
import { Badge, StatusDot } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { currentWorkspace, getApi } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";
import { COOPERATIVE_NAV } from "@/lib/navigation";
import { formatPhone } from "@/lib/phone";
import { teamRights } from "@/lib/roles";
import { ORGANIZATION_TYPE_LABELS, ROLE_LABELS, formatDate, organizationInitials, primaryRoleLabel } from "@/lib/spaces";
import { cn } from "@/lib/utils";

import { InviteDialog } from "./invite-dialog";
import { MemberDialog } from "./member-dialog";

export const metadata: Metadata = { title: "Équipe" };

type Membership = components["schemas"]["Membership"];

const STATUS = {
  active: { label: "Active", tone: "success" },
  invited: { label: "Invité", tone: "warning" },
  suspended: { label: "Suspendue", tone: "danger" },
  revoked: { label: "Retirée", tone: "neutral" },
} as const;

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ retires?: string }> }) {
  const showRevoked = (await searchParams).retires === "1";
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

  const visible = members.filter((m) => showRevoked || m.status !== "revoked");
  const count = (s: Membership["status"]) => members.filter((m) => m.status === s).length;
  const toActivate = members.filter((m) => m.status !== "revoked" && !m.user.account_activated).length;

  return (
    <AppShell
      nav={COOPERATIVE_NAV}
      activeHref="/equipe"
      workspace={{
        name: org.short_name || org.name,
        roleLabel: ORGANIZATION_TYPE_LABELS[org.organization_type] ?? org.organization_type,
        initials: organizationInitials(org.name),
      }}
      user={{ firstName: me.first_name, lastName: me.last_name, roleLabel: primaryRoleLabel(roles) }}
      breadcrumbs={[org.short_name || org.name, "Équipe"]}
    >
      <PageHeader
        title="Équipe"
        actions={canManage ? <InviteDialog isAdmin={isAdmin} organization={org.name} /> : undefined}
      />

      {forbidden ? (
        <Alert tone="info" className="mt-6">
          La liste de l&apos;équipe est réservée aux administrateurs et aux gérants de l&apos;organisation.
        </Alert>
      ) : (
        <>
          <StatRow>
            <Stat label="Membres actifs" icon={UsersRound} value={String(count("active"))} />
            <Stat label="Invitations" icon={MailOpen} iconTone="gold" value={String(count("invited"))} hint="en attente" />
            <Stat
              label="Comptes à activer"
              icon={KeyRound}
              iconTone="gold"
              value={String(toActivate)}
              hint={toActivate ? "Code à transmettre" : undefined}
              hintTone="warning"
            />
            <Stat label="Suspendus" icon={ShieldOff} iconTone="night" value={String(count("suspended"))} />
          </StatRow>

          <Card className="mt-6 overflow-hidden lg:mt-8">
            <div
              aria-hidden
              className="hidden border-b border-line bg-surface px-5 py-2.5 text-[12px] font-medium text-muted md:grid md:grid-cols-[minmax(0,1.5fr)_minmax(0,1.3fr)_minmax(0,1fr)_110px_84px] md:gap-4"
            >
              <span>Membre</span>
              <span>Rôle</span>
              <span>Statut</span>
              <span>Depuis</span>
              <span />
            </div>
            <ul aria-label="Membres de l'organisation">
              {visible.map((m) => {
                const status = STATUS[m.status];
                const isSelf = m.user.id === me.id;
                return (
                  <li
                    key={m.id}
                    className={cn(
                      "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 border-b border-line px-4 py-3.5 last:border-0 sm:px-5 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1.3fr)_minmax(0,1fr)_110px_84px] md:gap-4",
                      m.status === "revoked" && "text-muted",
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-50 font-display text-[11px] font-bold text-brand-800">
                        {`${m.user.first_name.charAt(0)}${m.user.last_name.charAt(0)}`.toUpperCase()}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[14px] font-semibold">
                          {m.user.first_name} {m.user.last_name}
                          {isSelf ? <span className="ml-1.5 text-[12px] font-normal text-muted">(vous)</span> : null}
                        </span>
                        <span className="tabular block text-[12px] text-muted">{formatPhone(m.user.phone_number)}</span>
                      </span>
                    </span>

                    <span className="col-start-1 row-start-2 flex flex-wrap items-center gap-1.5 pl-12 md:col-start-auto md:row-start-auto md:pl-0">
                      {m.roles.length ? (
                        m.roles.map((r) => (
                          <Badge key={r} tone={r === "organization_admin" ? "dark" : "brand"}>
                            {ROLE_LABELS[r] ?? r}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-[13px] text-muted">Aucun rôle</span>
                      )}
                      <span className="md:hidden">
                        <StatusDot tone={status.tone}>{status.label}</StatusDot>
                      </span>
                    </span>

                    <span className="hidden flex-col gap-0.5 md:flex">
                      <StatusDot tone={status.tone}>{status.label}</StatusDot>
                      {!m.user.account_activated && m.status !== "revoked" ? (
                        <span className="text-[12px] text-warning">Compte à activer</span>
                      ) : null}
                    </span>

                    <span className="tabular hidden text-[13px] text-muted md:block">
                      {formatDate(m.joined_at ?? m.created_at)}
                    </span>

                    <span className="col-start-2 row-span-2 row-start-1 text-right md:col-start-auto md:row-span-1 md:row-start-auto">
                      {canManage ? (
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
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface/60 px-5 py-3 text-[13px] text-muted">
              <span>
                {visible.length} membre{visible.length > 1 ? "s" : ""}
              </span>
              <Link href={showRevoked ? "/equipe" : "/equipe?retires=1"} className="font-medium text-brand-700 hover:underline">
                {showRevoked ? "Masquer les personnes retirées" : "Voir les personnes retirées"}
              </Link>
            </div>
          </Card>
        </>
      )}
    </AppShell>
  );
}
