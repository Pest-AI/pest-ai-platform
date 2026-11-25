import { ArrowLeft, BadgeCheck, CalendarDays, Fingerprint, Languages, MapPin, MessageCircle, Phone, User, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { currentWorkspace, getApi } from "@/lib/api/client";
import { COOPERATIVE_NAV } from "@/lib/navigation";
import { formatPhone } from "@/lib/phone";
import { LANGUAGE_LABELS, RELATIONSHIP_LABELS, SEX_LABELS, approximateAge, producerInitials } from "@/lib/producers";
import { ORGANIZATION_TYPE_LABELS, formatDate, organizationInitials, primaryRoleLabel } from "@/lib/spaces";

import { DetachProducerDialog, EditProducerDialog } from "../producer-dialogs";

export const metadata: Metadata = { title: "Fiche producteur" };

const CONTACT_ICONS = { phone: Phone, whatsapp: MessageCircle, email: MessageCircle, relay_person: User } as const;
const CONTACT_LABELS: Record<string, string> = {
  phone: "Téléphone",
  whatsapp: "WhatsApp",
  email: "E-mail",
  relay_person: "Personne relais",
};

export default async function ProducerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ nouveau?: string; rattache?: string }>;
}) {
  const { id } = await params;
  const flags = await searchParams;
  const workspace = await currentWorkspace();
  if (!workspace) redirect("/espaces");

  const api = await getApi();
  const header = { "X-Workspace": workspace };
  const [{ data: me }, orgResult, contextResult, producerResult] = await Promise.all([
    api.GET("/api/v1/me/"),
    api.GET("/api/v1/organization/", { params: { header } }),
    api.GET("/api/v1/workspace/", { headers: header }),
    api.GET("/api/v1/producers/{id}/", { params: { header, path: { id } } }),
  ]);
  if (!me) redirect("/connexion?erreur=session");
  if (!orgResult.data) redirect("/espaces?erreur=acces");
  const p = producerResult.data;
  if (!p) notFound();
  const org = orgResult.data;
  const roles = me.memberships.find((m) => m.workspace === workspace)?.roles ?? [];
  const permissions = new Set(contextResult.data?.permissions ?? []);
  const canManage = permissions.has("producers.manage");
  const editable = canManage && p.registration_channel === "organization";
  const name = `${p.first_name} ${p.last_name}`;
  const age = approximateAge(p.birth_year);
  const typeLabel = ORGANIZATION_TYPE_LABELS[org.organization_type] ?? org.organization_type;

  const facts: [React.ComponentType<{ className?: string }>, string, string][] = [
    [User, "Sexe", p.sex ? (SEX_LABELS[p.sex] ?? p.sex) : "Non renseigné"],
    [CalendarDays, "Année de naissance", p.birth_year ? `${p.birth_year}${age !== null ? ` (≈ ${age} ans)` : ""}` : "Non renseignée"],
    [MapPin, "Village ou commune", p.locality_text || "Non renseigné"],
    [Languages, "Langue préférée", LANGUAGE_LABELS[p.preferred_language] ?? p.preferred_language],
    [
      Users,
      "Ménage",
      p.household_size
        ? `${p.household_size} personne${p.household_size > 1 ? "s" : ""}${
            p.household_farm_workers !== null && p.household_farm_workers !== undefined
              ? `, dont ${p.household_farm_workers} actif${p.household_farm_workers > 1 ? "s" : ""} aux champs`
              : ""
          }`
        : "Non renseigné",
    ],
  ];

  return (
    <AppShell
      nav={COOPERATIVE_NAV}
      activeHref="/producteurs"
      workspace={{ name: org.short_name || org.name, roleLabel: typeLabel, initials: organizationInitials(org.name) }}
      user={{ firstName: me.first_name, lastName: me.last_name, roleLabel: primaryRoleLabel(roles) }}
      breadcrumbs={[org.short_name || org.name, "Producteurs", name]}
    >
      <Link href="/producteurs" className="inline-flex items-center gap-1.5 text-[14px] font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden />
        Producteurs
      </Link>

      {flags.nouveau ? (
        <Alert tone="info" className="mt-4">
          Producteur enregistré et rattaché à {org.short_name || org.name}.
        </Alert>
      ) : null}
      {flags.rattache ? (
        <Alert tone="info" className="mt-4">
          Fiche existante rattachée à {org.short_name || org.name}.
        </Alert>
      ) : null}

      <Card className="mt-4 rounded-2xl p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-4 sm:gap-5">
          <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-brand-50 font-display text-[20px] font-bold text-brand-800 sm:size-[72px]">
            {producerInitials(p.first_name, p.last_name)}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-[24px] leading-8 font-bold sm:text-[28px] sm:leading-9">{name}</h1>
            <p className="mt-1 font-mono text-[14px] tracking-[0.04em] text-brand-800" title="Identifiant producteur PEST AI, permanent">
              {p.producer_code}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge tone="brand">{RELATIONSHIP_LABELS[p.assignment?.relationship_type ?? "member"]}</Badge>
              {p.assignment?.membership_number ? (
                <Badge tone="neutral" className="font-mono">
                  N° {p.assignment.membership_number}
                </Badge>
              ) : null}
              {p.assignment?.section ? <Badge tone="neutral">{p.assignment.section}</Badge> : null}
              {p.has_account ? (
                <Badge tone="success">
                  <BadgeCheck aria-hidden />
                  Compte PEST AI
                </Badge>
              ) : null}
              {p.status === "inactive" ? <Badge tone="warning">Inactif</Badge> : null}
            </div>
          </div>
          {canManage ? (
            <div className="flex w-full flex-wrap gap-2 sm:w-auto">
              {editable ? (
                <EditProducerDialog
                  producerId={p.id}
                  values={{
                    firstName: p.first_name,
                    lastName: p.last_name,
                    sex: p.sex,
                    birthYear: p.birth_year ? String(p.birth_year) : "",
                    locality: p.locality_text,
                    phone: p.phone_number.replace(/^\+221/, ""),
                    language: p.preferred_language,
                    relationship: p.assignment?.relationship_type ?? "member",
                    membershipNumber: p.assignment?.membership_number ?? "",
                    householdSize: p.household_size ? String(p.household_size) : "",
                    section: p.assignment?.section ?? "",
                    householdWorkers:
                      p.household_farm_workers !== null && p.household_farm_workers !== undefined
                        ? String(p.household_farm_workers)
                        : "",
                  }}
                />
              ) : null}
              <DetachProducerDialog producerId={p.id} name={name} organization={org.short_name || org.name} />
            </div>
          ) : null}
        </div>
        {!editable && canManage ? (
          <p className="mt-4 text-[13px] text-muted">Ce producteur gère lui-même son profil : seules ses informations de rattachement vous appartiennent.</p>
        ) : null}
      </Card>

      <div className="mt-4 grid gap-4 lg:mt-5 lg:grid-cols-[1fr_360px] lg:gap-5">
        <div className="space-y-4 lg:space-y-5">
          <Card className="rounded-2xl p-5">
            <h2 className="text-[17px] font-semibold">Identité</h2>
            <dl className="mt-3 grid gap-x-6 sm:grid-cols-2">
              {facts.map(([Icon, label, value]) => (
                <div key={label} className="flex items-start gap-3 border-b border-line py-3 last:border-0 sm:[&:nth-last-child(2)]:border-0">
                  <Icon className="mt-0.5 size-[18px] shrink-0 text-muted" aria-hidden />
                  <div>
                    <dt className="text-[12px] text-muted">{label}</dt>
                    <dd className="text-[14px] font-medium">{value}</dd>
                  </div>
                </div>
              ))}
            </dl>
          </Card>

          <Card className="rounded-2xl p-5">
            <h2 className="text-[17px] font-semibold">Contacts</h2>
            {p.contacts.length === 0 ? (
              <p className="mt-2 text-[14px] text-muted">Aucun contact enregistré.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {p.contacts.map((c) => {
                  const Icon = CONTACT_ICONS[c.contact_type] ?? Phone;
                  return (
                    <li key={c.id} className="flex items-center gap-3 rounded-xl bg-surface px-3 py-2.5">
                      <span className="grid size-9 place-items-center rounded-lg bg-canvas text-brand-700 shadow-card">
                        <Icon className="size-4" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="tabular block text-[14px] font-medium">
                          {c.contact_type === "phone" || c.contact_type === "whatsapp" ? formatPhone(c.value) : c.value}
                        </span>
                        <span className="block text-[12px] text-muted">
                          {CONTACT_LABELS[c.contact_type]}
                          {c.relay_name ? ` · via ${c.relay_name}` : ""}
                        </span>
                      </span>
                      {c.is_primary ? <Badge tone="brand">Principal</Badge> : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card className="flex items-center gap-4 rounded-2xl border-dashed p-5">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-warning-bg text-[#b07d00]">
              <Fingerprint className="size-6" aria-hidden />
            </span>
            <div>
              <h2 className="text-[16px] font-semibold">Parcelles AgroID</h2>
              <p className="text-[14px] text-muted">Les parcelles de ce producteur apparaîtront ici avec le registre cartographique.</p>
            </div>
          </Card>
        </div>

        <Card className="h-fit rounded-2xl p-5">
          <h2 className="text-[17px] font-semibold">Rattachement</h2>
          <ol className="mt-4 space-y-0">
            {p.history.map((a, i) => (
              <li key={a.id} className="relative flex gap-3 pb-5 last:pb-0">
                {i < p.history.length - 1 ? <span aria-hidden className="absolute top-5 left-[7px] h-full w-px bg-line" /> : null}
                <span
                  aria-hidden
                  className={`relative mt-1 size-[15px] shrink-0 rounded-full border-[3px] ${a.is_active ? "border-leaf bg-canvas" : "border-line-strong bg-canvas"}`}
                />
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold">
                    {RELATIONSHIP_LABELS[a.relationship_type]} {a.is_active ? <span className="font-normal text-success">· en cours</span> : null}
                  </p>
                  <p className="tabular text-[13px] text-muted">
                    Depuis le {formatDate(a.start_date)}
                    {a.end_date ? ` · jusqu'au ${formatDate(a.end_date)}` : ""}
                  </p>
                  {a.membership_number ? <p className="font-mono text-[12px] text-muted">N° {a.membership_number}</p> : null}
                </div>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </AppShell>
  );
}
