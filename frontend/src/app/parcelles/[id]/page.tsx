import { ArrowLeft, CalendarDays, History, Ruler, ShieldCheck, TriangleAlert, UserRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AgroIdBadge } from "@/components/agroid-badge";
import { AppShell } from "@/components/app-shell";
import { StatusPill } from "@/components/list-toolbar";
import { ParcelShape } from "@/components/parcel-shape";
import { Card } from "@/components/ui/card";
import { currentWorkspace, getApi } from "@/lib/api/client";
import { COOPERATIVE_NAV } from "@/lib/navigation";
import {
  CAPTURE_METHODS,
  OPERATOR_ROLE_LABELS,
  TENURE_LABELS,
  VALIDATION_STATUS,
  VERIFICATION_LABELS,
  formatArea,
  parcelStatus,
} from "@/lib/parcels";
import { ORGANIZATION_TYPE_LABELS, formatDate, organizationInitials, primaryRoleLabel } from "@/lib/spaces";

import { ReviewForm } from "../review-form";

export const metadata: Metadata = { title: "Fiche parcelle" };

type Geometry = { type: string; coordinates: unknown };

function Section({ title, icon: Icon, children }: { title: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <Card className="rounded-2xl p-5">
      <h2 className="flex items-center gap-2 text-[16px] font-semibold">
        <Icon className="size-4 text-leaf" aria-hidden />
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </Card>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl bg-surface px-4 py-4 text-center text-[13px] text-muted">{children}</p>;
}

export default async function ParcelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const workspace = await currentWorkspace();
  if (!workspace) redirect("/espaces");
  const api = await getApi();
  const header = { "X-Workspace": workspace };
  const [{ data: me }, orgResult, parcelResult, historyResult, contextResult] = await Promise.all([
    api.GET("/api/v1/me/"),
    api.GET("/api/v1/organization/", { params: { header } }),
    api.GET("/api/v1/parcels/{id}/", { params: { header, path: { id } } }),
    api.GET("/api/v1/parcels/{id}/history/", { params: { header, path: { id } } }),
    api.GET("/api/v1/workspace/", { headers: header }),
  ]);
  if (!me) redirect("/connexion?erreur=session");
  if (!orgResult.data) redirect("/espaces?erreur=acces");
  if (!parcelResult.data) notFound();
  const org = orgResult.data;
  const p = parcelResult.data;
  const history = historyResult.data;
  const roles = me.memberships.find((m) => m.workspace === workspace)?.roles ?? [];
  const typeLabel = ORGANIZATION_TYPE_LABELS[org.organization_type] ?? org.organization_type;
  const canReview = (contextResult.data?.permissions ?? []).includes("parcels.validate_geometry");
  const st = parcelStatus(p.status);
  const current = p.current_geometry;
  const validation = current ? VALIDATION_STATUS[current.validation.status] : null;
  const previous = (history?.geometries ?? []).filter((g) => !g.is_current).slice(0, 3).map((g) => g.geometry as Geometry);
  const needsReview = current && ["flagged", "pending"].includes(current.validation.status);

  return (
    <AppShell
      nav={COOPERATIVE_NAV}
      activeHref="/parcelles"
      workspace={{ name: org.short_name || org.name, roleLabel: typeLabel, initials: organizationInitials(org.name) }}
      user={{ firstName: me.first_name, lastName: me.last_name, roleLabel: primaryRoleLabel(roles) }}
      breadcrumbs={[org.short_name || org.name, "Parcelles & AgroID", p.agroid ?? "Brouillon"]}
      search={{ action: "/parcelles", placeholder: "Rechercher un AgroID ou une parcelle…" }}
    >
      <Link href="/parcelles" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-700 hover:underline">
        <ArrowLeft className="size-4" aria-hidden />
        Parcelles
      </Link>

      {/* En-tête : identité */}
      <div className="mt-3 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div className="min-w-0">
          <AgroIdBadge code={p.agroid} className="h-8 px-2.5 text-[15px]" />
          <h1 className="mt-2 text-[26px] leading-8 font-bold sm:text-[28px] sm:leading-9">
            {p.local_name || "Parcelle sans nom"}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-muted">
            <StatusPill tone={st.tone}>{st.label}</StatusPill>
            <span className="tabular font-mono">{formatArea(p.current_area_m2)}</span>
            <span aria-hidden>·</span>
            <span>
              {p.registration_channel === "producer_self" ? "Déclarée par le producteur" : "Enregistrée par l'organisation"} le{" "}
              {formatDate(p.created_at)}
            </span>
            {p.access === "view" ? (
              <>
                <span aria-hidden>·</span>
                <span>Consultation seule</span>
              </>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-5">
        <div className="space-y-4">
          {current ? (
            <ParcelShape current={current.geometry as Geometry} previous={previous} color={st.color} />
          ) : (
            <Card className="grid h-[320px] place-items-center rounded-2xl text-center">
              <p className="px-6 text-[14px] text-muted">Contour pas encore relevé.</p>
            </Card>
          )}

          {current && validation ? (
            <Section title="Contrôle du contour" icon={needsReview ? TriangleAlert : ShieldCheck}>
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill tone={validation.tone}>{validation.label}</StatusPill>
                <span className="text-[13px] text-muted">
                  Version {current.version} · {CAPTURE_METHODS[current.capture_method] ?? current.capture_method}
                  {current.gps_accuracy_m ? ` · précision ${Number(current.gps_accuracy_m).toLocaleString("fr-FR")} m` : ""}
                </span>
              </div>
              {current.validation.labels.length ? (
                <ul className="mt-3 space-y-1.5 text-[14px]">
                  {current.validation.labels.map((label) => (
                    <li key={label} className="flex items-center gap-2">
                      <span className="size-1.5 rounded-full bg-gold" aria-hidden />
                      {label}
                    </li>
                  ))}
                  {current.validation.overlaps.map((o, i) => (
                    <li key={i} className="pl-3.5 text-[13px] text-muted">
                      Chevauchement de {Number(o.percent).toLocaleString("fr-FR")} % avec{" "}
                      {o.parcel_id ? (
                        <Link href={`/parcelles/${o.parcel_id}`} className="font-mono font-semibold text-brand-700 hover:underline">
                          {String(o.agroid)}
                        </Link>
                      ) : (
                        String(o.label)
                      )}
                    </li>
                  ))}
                </ul>
              ) : null}
              {current.validation.review ? (
                <p className="mt-3 rounded-xl bg-surface px-3 py-2 text-[13px] text-muted">
                  Décision : {current.validation.review.decision === "valid" ? "confirmé" : "refusé"}
                  {current.validation.review.note ? ` — « ${String(current.validation.review.note)} »` : ""}
                </p>
              ) : null}
              {needsReview && canReview ? <ReviewForm parcelId={p.id} geometryId={current.id} /> : null}
              {needsReview && !canReview ? (
                <p className="mt-3 text-[13px] text-muted">Un agronome ou un gérant doit confirmer ce contour.</p>
              ) : null}
            </Section>
          ) : null}

          <Section title="Historique du contour" icon={History}>
            {history?.geometries.length ? (
              <ol className="space-y-2">
                {history.geometries.map((g) => {
                  const v = VALIDATION_STATUS[g.validation.status];
                  return (
                    <li key={g.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-line px-3 py-2.5">
                      <span className="tabular font-mono text-[13px] font-semibold">v{g.version}</span>
                      <span className="tabular font-mono text-[13px]">{formatArea(g.area_m2)}</span>
                      <span className="text-[13px] text-muted">{CAPTURE_METHODS[g.capture_method] ?? g.capture_method}</span>
                      <span className="ml-auto flex items-center gap-2">
                        {v ? <StatusPill tone={v.tone}>{v.label}</StatusPill> : null}
                        <span className="tabular font-mono text-[12px] text-muted">{formatDate(g.captured_at)}</span>
                        {g.is_current ? <StatusPill tone="success">Courant</StatusPill> : null}
                      </span>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <Empty>Aucun contour enregistré.</Empty>
            )}
          </Section>
        </div>

        <div className="space-y-4">
          <Section title="Exploitants" icon={UserRound}>
            {p.operators.length ? (
              <ul className="space-y-2">
                {p.operators.map((o) => (
                  <li key={o.id} className="rounded-xl border border-line px-3 py-2.5">
                    <Link href={`/producteurs/${o.producer}`} className="text-[14px] font-semibold hover:underline">
                      {o.producer_name}
                    </Link>
                    <p className="text-[12px] text-muted">
                      {OPERATOR_ROLE_LABELS[o.operator_role] ?? o.operator_role} · depuis le {formatDate(o.start_date)} ·{" "}
                      {VERIFICATION_LABELS[o.verification_status] ?? o.verification_status}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>Aucun exploitant renseigné.</Empty>
            )}
          </Section>

          <Section title="Propriété" icon={ShieldCheck}>
            {p.owners.length ? (
              <ul className="space-y-2">
                {p.owners.map((o) => (
                  <li key={o.id} className="rounded-xl border border-line px-3 py-2.5">
                    <p className="text-[14px] font-semibold">{o.owner_display}</p>
                    <p className="text-[12px] text-muted">
                      {TENURE_LABELS[o.tenure_type] ?? o.tenure_type}
                      {o.share_percent ? ` · ${Number(o.share_percent).toLocaleString("fr-FR")} %` : ""} · depuis le{" "}
                      {formatDate(o.start_date)} · {VERIFICATION_LABELS[o.verification_status] ?? o.verification_status}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>Aucun propriétaire renseigné.</Empty>
            )}
            <p className="mt-3 text-[12px] text-muted">La propriété et l&apos;exploitation sont tenues séparément.</p>
          </Section>

          <Section title="Unités de culture" icon={Ruler}>
            {p.units.length ? (
              <ul className="divide-y divide-line">
                {p.units.map((u) => (
                  <li key={u.id} className="flex items-center gap-3 py-2">
                    <span className="tabular font-mono text-[13px] font-semibold">{u.code}</span>
                    <span className="min-w-0 flex-1 truncate text-[13px]">{u.name || "—"}</span>
                    <span className="tabular font-mono text-[12px] text-muted">{formatArea(u.area_m2)}</span>
                    {u.status === "retired" ? <StatusPill tone="neutral">Retirée</StatusPill> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>Pas d&apos;unité de culture.</Empty>
            )}
          </Section>

          <Section title="Identité" icon={CalendarDays}>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[13px]">
              <dt className="text-muted">AgroID</dt>
              <dd className="font-mono font-semibold">{p.agroid ?? "En attente"}</dd>
              <dt className="text-muted">Attribué le</dt>
              <dd className="tabular font-mono">{p.agroid_assigned_at ? formatDate(p.agroid_assigned_at) : "—"}</dd>
              <dt className="text-muted">Pays</dt>
              <dd>{p.country_code}</dd>
              <dt className="text-muted">Point central</dt>
              <dd className="tabular font-mono">
                {p.centroid && p.centroid.length === 2
                  ? `${Number(p.centroid[1]).toFixed(5)}° N, ${Math.abs(Number(p.centroid[0])).toFixed(5)}° W`
                  : "—"}
              </dd>
            </dl>
          </Section>
        </div>
      </div>
    </AppShell>
  );
}
