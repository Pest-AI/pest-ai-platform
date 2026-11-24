import { ChevronRight, Clock3, Globe2, Inbox, Info, MailOpen, ShieldCheck, Sprout } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import type * as React from "react";

import { initials } from "@/components/app-shell";
import { Logo } from "@/components/logo";
import { LogoutButton } from "@/components/logout-button";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { currentWorkspace, getApi } from "@/lib/api/client";
import { ORGANIZATION_TYPE_LABELS, canUseWebOS, primaryRoleLabel, webMemberships } from "@/lib/spaces";
import { cn } from "@/lib/utils";

import panorama from "../../../public/brand/espaces-panorama.jpg";
import { acceptInvitation } from "./actions";

export const metadata: Metadata = { title: "Choisir un espace" };

const CARD =
  "group relative flex w-full items-center gap-4 overflow-hidden rounded-2xl border border-line bg-canvas p-4 text-left shadow-card transition-all hover:-translate-y-px hover:border-line-strong hover:shadow-pop sm:gap-5 sm:p-5";

/** Une carte d'espace : icône, nom, type et rôle. */
function WorkspaceCard({
  icon,
  iconClass,
  name,
  meta,
  recent = false,
}: {
  icon: React.ReactNode;
  iconClass: string;
  name: string;
  meta: string;
  recent?: boolean;
}) {
  return (
    <>
      {recent ? <span aria-hidden className="absolute inset-y-0 left-0 w-1.5 bg-leaf" /> : null}
      <span className={cn("grid size-14 shrink-0 place-items-center rounded-2xl sm:size-16", iconClass)}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-[16px] leading-6 font-bold sm:text-[17px]">{name}</span>
        <span className="mt-0.5 block text-[14px] text-muted">{meta}</span>
        {recent ? (
          <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-[12px] font-semibold text-brand-800 sm:hidden">
            <Clock3 className="size-3.5" aria-hidden />
            Récent
          </span>
        ) : null}
      </span>
      {recent ? (
        <span className="hidden items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1.5 text-[13px] font-semibold text-brand-800 sm:inline-flex">
          <Clock3 className="size-4" aria-hidden />
          Récent
        </span>
      ) : null}
      <ChevronRight className="size-5 shrink-0 text-ink/70 transition-transform group-hover:translate-x-0.5" aria-hidden />
    </>
  );
}

/** Feuilles décoratives en bas de page. */
function Leaves({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 400 400" className={cn("pointer-events-none absolute", className)}>
      <path d="M0 120 C 140 140, 260 260, 300 400 L0 400Z" fill="#3a9442" fillOpacity="0.07" />
      <path d="M0 230 C 90 230, 170 300, 200 400 L0 400Z" fill="#3a9442" fillOpacity="0.08" />
      <path d="M150 260 C 230 280, 290 340, 310 400 L190 400 C 180 350, 170 300, 150 260Z" fill="#3a9442" fillOpacity="0.08" />
    </svg>
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

  // Agent terrain ou producteur seulement : pas d'accès au Web OS (session effacée).
  if (!canUseWebOS(me)) redirect("/api/session/refus");

  const lastWorkspace = await currentWorkspace();
  const allowed = webMemberships(me.memberships);
  const memberships = allowed.filter((m) => m.status === "active");
  const invitations = allowed.filter((m) => m.status === "invited");
  const total = memberships.length + (me.is_platform_admin ? 1 : 0);

  return (
    <div className="relative min-h-dvh overflow-hidden bg-surface">
      <Leaves className="bottom-0 left-0 w-[260px] sm:w-[380px]" />
      <Leaves className="right-0 bottom-0 w-[220px] -scale-x-100 sm:w-[320px]" />

      {/* Bandeau photo */}
      <div className="relative h-[290px] sm:h-[330px] lg:h-[360px]">
        <Image
          src={panorama}
          alt=""
          fill
          priority
          placeholder="blur"
          sizes="100vw"
          className="object-cover object-[18%_center] md:object-center"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(90deg,rgb(16_68_38/0.55),rgb(16_68_38/0.15)_55%,rgb(16_68_38/0)_75%)]"
        />
        {/* Bord inférieur ondulé */}
        <svg aria-hidden viewBox="0 0 1440 80" preserveAspectRatio="none" className="absolute -bottom-px left-0 h-10 w-full sm:h-16">
          <path d="M0 40 C 260 80, 520 0, 820 26 S 1260 70, 1440 10 L1440 80 L0 80Z" className="fill-surface" />
        </svg>

        <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-4 pt-5 sm:px-8 sm:pt-7">
          <Logo inverted size="lg" />
          <div className="flex items-center gap-2.5 rounded-full bg-night/35 py-1 pr-1 pl-1 text-white ring-1 ring-white/15 backdrop-blur-md sm:pr-1.5">
            <span className="grid size-9 place-items-center rounded-full bg-leaf font-display text-[12px] font-bold">
              {initials(me.first_name, me.last_name)}
            </span>
            <span className="hidden text-[14px] font-semibold sm:inline">
              {me.first_name} {me.last_name}
            </span>
            <LogoutButton onDark />
          </div>
        </header>

        <div className="relative z-10 mx-auto max-w-6xl px-4 pt-8 sm:px-8 sm:pt-10 lg:px-[72px]">
          <p className="text-[16px] font-medium text-white/90 sm:text-[18px]">
            Bonjour {me.first_name} <span aria-hidden>👋</span>
          </p>
          <h1 className="mt-1 text-[30px] leading-9 font-bold text-white sm:text-[40px] sm:leading-[48px] lg:text-[46px] lg:leading-[54px]">
            Choisissez votre espace
          </h1>
          <p className="mt-2 text-[15px] text-white/85 sm:text-[17px]">Retrouvez vos environnements de travail.</p>
          <span aria-hidden className="mt-4 block h-1 w-16 rounded-full bg-gold sm:w-20" />
        </div>
      </div>

      <main className="relative z-10 mx-auto max-w-3xl px-4 pt-6 pb-20 sm:px-6 sm:pt-8">
        <div className="mb-5 space-y-3 empty:hidden">
          {erreur === "acces" ? <Alert>Vous n&apos;avez plus accès à cet espace.</Alert> : null}
          {erreur === "espace" ? <Alert>Espace invalide.</Alert> : null}
          {erreur === "invitation" ? <Alert>Cette invitation n&apos;est plus valable.</Alert> : null}
          {bienvenue ? <Alert tone="info">Invitation acceptée. L&apos;organisation est dans vos espaces.</Alert> : null}
        </div>

        {invitations.length > 0 ? (
          <section aria-label="Invitations à accepter" className="mb-4 space-y-4">
            {invitations.map((inv) => (
              <div
                key={inv.id}
                className="relative flex flex-wrap items-center gap-4 overflow-hidden rounded-2xl border border-gold/60 bg-canvas p-4 shadow-card sm:gap-5 sm:p-5"
              >
                <span aria-hidden className="absolute inset-y-0 left-0 w-1.5 bg-gold" />
                <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-warning-bg text-[#b07d00] sm:size-16">
                  <MailOpen className="size-7" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[12px] font-semibold text-[#b07d00]">Nouvelle invitation</span>
                  <span className="block font-display text-[16px] leading-6 font-bold">{inv.organization_name}</span>
                  <span className="block text-[14px] text-muted">{primaryRoleLabel(inv.roles)}</span>
                </span>
                <form action={acceptInvitation} className="max-sm:w-full">
                  <input type="hidden" name="membership_id" value={inv.id} />
                  <Button type="submit" className="max-sm:w-full">
                    Accepter
                  </Button>
                </form>
              </div>
            ))}
          </section>
        ) : null}

        {total === 0 && invitations.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-line bg-canvas px-6 py-14 text-center shadow-card">
            <span className="grid size-14 place-items-center rounded-2xl bg-subtle text-muted">
              <Inbox className="size-7" aria-hidden />
            </span>
            <p className="mt-4 font-display text-[17px] font-bold">Aucun espace pour le moment</p>
            <p className="mt-1 max-w-xs text-[14px] text-muted">
              Demandez à l&apos;administrateur de votre organisation de vous inviter.
            </p>
          </div>
        ) : (
          <ul className="space-y-4">
            {memberships.map((m) => {
              const isNgo = m.organization_type === "ngo";
              return (
                <li key={m.id}>
                  <form action="/api/session/workspace" method="post">
                    <input type="hidden" name="workspace" value={m.workspace} />
                    <button type="submit" className={CARD}>
                      <WorkspaceCard
                        icon={isNgo ? <Globe2 className="size-7" /> : <Sprout className="size-7" />}
                        iconClass={isNgo ? "bg-warning-bg text-[#b07d00]" : "bg-brand-50 text-brand-700"}
                        name={m.organization_name}
                        meta={`${ORGANIZATION_TYPE_LABELS[m.organization_type] ?? m.organization_type} · ${primaryRoleLabel(m.roles)}`}
                        recent={m.workspace === lastWorkspace}
                      />
                    </button>
                  </form>
                </li>
              );
            })}
            {me.is_platform_admin ? (
              <li>
                <Link href="/admin/organisations" className={CARD}>
                  <WorkspaceCard
                    icon={<ShieldCheck className="size-7" />}
                    iconClass="bg-night text-gold"
                    name="Console d'administration"
                    meta="Plateforme PEST AI · Super-admin"
                  />
                </Link>
              </li>
            ) : null}
          </ul>
        )}

        <div className="mt-10 flex items-center gap-4 text-muted">
          <span aria-hidden className="h-px flex-1 bg-line-strong" />
          <Info className="size-5" aria-hidden />
          <span aria-hidden className="h-px flex-1 bg-line-strong" />
        </div>
        <p className="mt-3 text-center text-[14px] text-muted">Une organisation manque ? Son administrateur peut vous inviter.</p>
      </main>
    </div>
  );
}
