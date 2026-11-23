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
import { ROLE_LABELS, formatDate, organizationInitials, primaryRoleLabel } from "@/lib/spaces";
import { cn } from "@/lib/utils";

import { InviteDialog } from "./invite-dialog";
import { MemberDialog } from "./member-dialog";

export const metadata: Metadata = { title: "Membres et invitations" };

type Membership = components["schemas"]["Membership"];

const STATUS = {
  active: { label: "Active", tone: "success" },
  invited: { label: "Invitation envoyée", tone: "warning" },
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
      workspace={{ name: org.name, roleLabel: primaryRoleLabel(roles), initials: organizationInitials(org.name) }}
      user={{ firstName: me.first_name, lastName: me.last_name, roleLabel: primaryRoleLabel(roles) }}
      breadcrumbs={[org.short_name || org.name, "Membres et invitations"]}
    >
      <PageHeader
        title="Membres et invitations"
        description="Les personnes qui travaillent dans l'organisation et leurs rôles."
        actions={canManage ? <InviteDialog isAdmin={isAdmin} organization={org.name} /> : undefined}
      />

      {forbidden ? (
        <Alert tone="info" className="mt-6">
          La liste de l&apos;équipe est réservée aux administrateurs et aux gérants de l&apos;organisation.
        </Alert>
      ) : (
        <>
          <StatRow>
            <Stat label="Membres actifs" value={String(count("active"))} hint="accès ouvert" hintTone="success" />
            <Stat label="Invitations en attente" value={String(count("invited"))} hint="pas encore acceptées" />
            <Stat
              label="Comptes à activer"
              value={String(toActivate)}
              hint="mot de passe non choisi"
              hintTone={toActivate ? "warning" : "muted"}
            />
            <Stat label="Accès suspendus" value={String(count("suspended"))} hint="sans suppression" />
          </StatRow>

          <Card className="mt-8 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-[14px]">
                <thead className="border-b border-line bg-surface text-[12px] text-muted">
                  <tr>
                    <th scope="col" className="px-4 py-2.5 font-medium">Membre</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Rôles</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Statut</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Depuis</th>
                    <th scope="col" className="w-24 px-4 py-2.5 font-medium">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((m) => {
                    const status = STATUS[m.status];
                    const isSelf = m.user.id === me.id;
                    return (
                      <tr key={m.id} className={cn("border-b border-line last:border-0", m.status === "revoked" && "text-muted")}>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-3">
                            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-50 text-[11px] font-semibold text-brand-800">
                              {`${m.user.first_name.charAt(0)}${m.user.last_name.charAt(0)}`.toUpperCase()}
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate font-medium">
                                {m.user.first_name} {m.user.last_name}
                                {isSelf ? <span className="ml-1.5 text-[12px] font-normal text-muted">(vous)</span> : null}
                              </span>
                              <span className="tabular block text-[12px] text-muted">{formatPhone(m.user.phone_number)}</span>
                            </span>
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="flex flex-wrap gap-1">
                            {m.roles.length ? (
                              m.roles.map((r) => (
                                <Badge key={r} tone={r === "organization_admin" ? "dark" : "brand"}>
                                  {ROLE_LABELS[r] ?? r}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-[13px] text-muted">Aucun rôle</span>
                            )}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="flex flex-col gap-1">
                            <StatusDot tone={status.tone}>{status.label}</StatusDot>
                            {!m.user.account_activated && m.status !== "revoked" ? (
                              <span className="text-[12px] text-warning">Compte à activer</span>
                            ) : null}
                          </span>
                        </td>
                        <td className="tabular px-4 py-3 text-muted">
                          {m.joined_at ? formatDate(m.joined_at) : `Invité le ${formatDate(m.created_at)}`}
                        </td>
                        <td className="px-4 py-3 text-right">
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
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 text-[13px] text-muted">
              <span>
                {visible.length} membre{visible.length > 1 ? "s" : ""}
              </span>
              <Link href={showRevoked ? "/equipe" : "/equipe?retires=1"} className="font-medium text-brand-700 hover:underline">
                {showRevoked ? "Masquer les personnes retirées" : "Afficher les personnes retirées"}
              </Link>
            </div>
          </Card>
        </>
      )}
    </AppShell>
  );
}
