import { ChevronRight, Clock3, Globe2, Inbox, MailOpen, ShieldCheck, Sprout } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type * as React from "react";

import { Logo } from "@/components/logo";
import { LogoutButton } from "@/components/logout-button";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { currentWorkspace, getApi } from "@/lib/api/client";
import { ORGANIZATION_TYPE_LABELS, formatDate, primaryRoleLabel } from "@/lib/spaces";
import { cn } from "@/lib/utils";

import { acceptInvitation } from "./actions";

export const metadata: Metadata = { title: "Choisir un espace" };

const CARD =
  "group flex h-full w-full flex-col gap-5 rounded-xl border bg-canvas p-5 text-left shadow-card transition-colors hover:border-line-strong";

function WorkspaceCard({
  icon,
  iconClass,
  name,
  meta,
  facts,
  role,
  roleTone = "brand",
  lastUsed = false,
}: {
  icon: React.ReactNode;
  iconClass: string;
  name: string;
  meta: string;
  facts: [string, string][];
  role: string;
  roleTone?: "brand" | "dark";
  lastUsed?: boolean;
}) {
  return (
    <>
      <span className="flex items-start gap-3">
        <span className={cn("grid size-10 shrink-0 place-items-center rounded-lg", iconClass)}>{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-[16px] leading-6 font-semibold">{name}</span>
          <span className="block text-[13px] text-muted">{meta}</span>
        </span>
        <ChevronRight className="mt-1 size-4 text-muted transition-transform group-hover:translate-x-0.5" aria-hidden />
      </span>
      <span className="grid grid-cols-2 border-y border-line">
        {facts.map(([value, label], i) => (
          <span key={label} className={cn("py-3", i > 0 && "border-l border-line pl-4")}>
            <span className="block text-[15px] font-semibold">{value}</span>
            <span className="block text-[12px] text-muted">{label}</span>
          </span>
        ))}
      </span>
      <span className="flex items-center justify-between gap-2">
        <Badge tone={roleTone}>{role}</Badge>
        {lastUsed ? (
          <span className="inline-flex items-center gap-1 text-[12px] font-medium text-ink">
            <Clock3 className="size-3.5" aria-hidden />
            Dernier espace utilisé
          </span>
        ) : null}
      </span>
    </>
  );
}

export default async function WorkspacesPage({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string; bienvenue?: string }>;
}) {
  const { erreur, bienvenue } = await searchParams;
  const api = await getApi();
  const { data: me, response } = await api.GET("/api/v1/me/");
  if (response.status === 401 || !me) redirect("/connexion?erreur=session");

  const lastWorkspace = await currentWorkspace();
  const memberships = me.memberships.filter((m) => m.status === "active");
  const invitations = me.memberships.filter((m) => m.status === "invited");
  const total = memberships.length + (me.is_platform_admin ? 1 : 0);

  return (
    <div className="min-h-screen">
      <header className="flex h-14 items-center justify-between border-b border-line bg-canvas px-6">
        <Logo />
        <div className="flex items-center gap-3">
          <span className="grid size-8 place-items-center rounded-full bg-brand-800 text-[12px] font-semibold text-white">
            {`${me.first_name.charAt(0)}${me.last_name.charAt(0)}`.toUpperCase()}
          </span>
          <span className="hidden text-[13px] font-medium sm:inline">
            {me.first_name} {me.last_name}
          </span>
          <span className="h-5 w-px bg-line" aria-hidden />
          <LogoutButton variant="text" />
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-14">
        <p className="text-[14px] text-muted">Bonjour {me.first_name}</p>
        <h1 className="mt-1 text-[30px] leading-9 font-bold tracking-[-0.02em]">Où travaillez-vous aujourd&apos;hui ?</h1>
        <p className="mt-1.5 text-muted">Chaque espace a ses propres données et vos droits dans cet espace.</p>

        <div className="mt-6 space-y-3 empty:hidden">
          {erreur === "acces" ? <Alert>Vous n&apos;avez plus accès à cet espace. Choisissez-en un autre.</Alert> : null}
          {erreur === "espace" ? <Alert>Espace invalide.</Alert> : null}
          {erreur === "invitation" ? <Alert>Cette invitation n&apos;est plus valable.</Alert> : null}
          {bienvenue ? <Alert tone="info">Invitation acceptée : l&apos;organisation fait maintenant partie de vos espaces.</Alert> : null}
        </div>

        {invitations.length > 0 ? (
          <section aria-labelledby="invitations" className="mt-8">
            <h2 id="invitations" className="font-sans text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">
              Invitations à accepter
            </h2>
            <ul className="mt-3 space-y-3">
              {invitations.map((inv) => (
                <li
                  key={inv.id}
                  className="flex flex-wrap items-center gap-4 rounded-xl border border-gold/60 bg-warning-bg/50 px-5 py-4"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-canvas text-warning">
                    <MailOpen className="size-5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-[15px] font-semibold">{inv.organization_name}</span>
                    <span className="block text-[13px] text-muted">
                      {ORGANIZATION_TYPE_LABELS[inv.organization_type] ?? inv.organization_type} · vous invite comme{" "}
                      {primaryRoleLabel(inv.roles).toLowerCase()}
                    </span>
                  </span>
                  <form action={acceptInvitation}>
                    <input type="hidden" name="membership_id" value={inv.id} />
                    <Button type="submit">Accepter l&apos;invitation</Button>
                  </form>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {total === 0 && invitations.length === 0 ? (
          <div className="mt-8 flex flex-col items-center rounded-xl border border-dashed border-line-strong bg-canvas px-6 py-14 text-center">
            <Inbox className="size-8 text-muted" aria-hidden />
            <p className="mt-3 font-display text-[16px] font-semibold">Aucun espace pour le moment</p>
            <p className="mt-1 max-w-sm text-[13px] text-muted">
              Vous n&apos;êtes membre actif d&apos;aucune organisation. Demandez à son administrateur de vous inviter sur
              votre numéro.
            </p>
          </div>
        ) : (
          <ul className="mt-8 grid gap-4 md:grid-cols-2">
            {memberships.map((m) => {
              const isNgo = m.organization_type === "ngo";
              const lastUsed = m.workspace === lastWorkspace;
              return (
                <li key={m.id}>
                  <form action="/api/session/workspace" method="post" className="h-full">
                    <input type="hidden" name="workspace" value={m.workspace} />
                    <button type="submit" className={cn(CARD, lastUsed ? "border-brand-800" : "border-line")}>
                      <WorkspaceCard
                        icon={isNgo ? <Globe2 className="size-5" /> : <Sprout className="size-5" />}
                        iconClass={isNgo ? "bg-warning-bg text-warning" : "bg-brand-50 text-brand-800"}
                        name={m.organization_name}
                        meta={ORGANIZATION_TYPE_LABELS[m.organization_type] ?? m.organization_type}
                        facts={[
                          [String(m.roles.length || "—"), m.roles.length > 1 ? "rôles" : "rôle"],
                          [formatDate(m.joined_at), "membre depuis"],
                        ]}
                        role={primaryRoleLabel(m.roles)}
                        lastUsed={lastUsed}
                      />
                    </button>
                  </form>
                </li>
              );
            })}
            {me.is_platform_admin ? (
              <li>
                <Link href="/admin/organisations" className={cn(CARD, "border-line")}>
                  <WorkspaceCard
                    icon={<ShieldCheck className="size-5" />}
                    iconClass="bg-night text-gold"
                    name="Console d'administration"
                    meta="Plateforme PEST AI · toutes les organisations"
                    facts={[
                      ["Organisations", "création et suivi"],
                      ["Accès", "journalisé"],
                    ]}
                    role="Super-admin"
                    roleTone="dark"
                  />
                </Link>
              </li>
            ) : null}
          </ul>
        )}

        <p className="mt-10 border-t border-line pt-6 text-center text-[13px] text-muted">
          Une organisation manque ? Son administrateur peut vous inviter sur votre numéro.
        </p>
      </main>
    </div>
  );
}
