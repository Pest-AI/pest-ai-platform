import { ArrowLeft, Sprout, Wheat } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AgroIdBadge } from "@/components/agroid-badge";
import { AppShell, PageHeader } from "@/components/app-shell";
import { StatusPill } from "@/components/list-toolbar";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import {
  CYCLE_STATUS,
  MEASUREMENT_METHODS,
  OPERATION_TYPES,
  SOURCES,
  formatKg,
  shortDate,
  yieldTHa,
} from "@/lib/agriculture";
import { COOPERATIVE_NAV } from "@/lib/navigation";
import { loadOrgContext } from "@/lib/org-context";
import { formatArea } from "@/lib/parcels";

import {
  AddHarvestButton,
  AddOperationButton,
  ConfirmCropButton,
  CycleStatusActions,
  EditDatesButton,
} from "./cycle-dialogs";

export const metadata: Metadata = { title: "Cycle de culture" };

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[12px] text-muted">{label}</dt>
      <dd className="mt-0.5 text-[14px] font-semibold">{children}</dd>
    </div>
  );
}

export default async function CyclePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const justCreated = (await searchParams).nouveau === "1";
  const ctx = await loadOrgContext();
  const [cycleResult, cropsResult] = await Promise.all([
    ctx.api.GET("/api/v1/crop-cycles/{id}/", { params: { header: ctx.header, path: { id } } }),
    ctx.api.GET("/api/v1/crops/"),
  ]);
  const c = cycleResult.data;
  if (!c) notFound();
  const st = CYCLE_STATUS[c.status] ?? { label: c.status, tone: "neutral" as const };
  const editable = ctx.can("crop_cycles.manage") && !c.is_archived;
  const canHarvest = editable && (c.status === "in_progress" || c.status === "harvested");
  const harvestArea = c.harvests.reduce((s, h) => s + Number(h.harvested_area_m2 ?? 0), 0);
  const yieldText = yieldTHa(c.total_harvest_kg, harvestArea || c.declared_area_m2);
  const operations = [...c.operations].sort((a, b) =>
    (b.performed_date ?? b.planned_date ?? "").localeCompare(a.performed_date ?? a.planned_date ?? ""),
  );

  return (
    <AppShell
      nav={COOPERATIVE_NAV}
      activeHref="/campagnes"
      workspace={ctx.shell.workspace}
      user={ctx.shell.user}
      breadcrumbs={[ctx.shell.workspace.name, "Campagnes", "Cycle"]}
    >
      <Link
        href={c.campaign ? `/campagnes/${c.campaign.id}` : "/cycles"}
        className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-700 hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {c.campaign ? c.campaign.name : "Cycles de culture"}
      </Link>
      {justCreated ? (
        <Alert tone="info" className="mt-3">
          Cycle enregistré. Ajoutez les opérations au fil de la saison, puis les récoltes.
        </Alert>
      ) : null}
      <PageHeader
        context={c.campaign ? "Cycle de culture" : "Cycle de culture · hors campagne"}
        title={`${c.crop.name_fr}${c.variety ? ` · ${c.variety.name}` : ""}`}
        description={`${c.parcel.local_name || "Parcelle sans nom"}${c.cultivation_unit ? ` · unité ${c.cultivation_unit.code}` : ""}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone={st.tone}>{st.label}</StatusPill>
            {c.is_archived ? <StatusPill tone="neutral">Archivé</StatusPill> : null}
            {editable ? <CycleStatusActions cycleId={c.id} status={c.status} /> : null}
          </div>
        }
      />

      {c.overlaps.length > 0 ? (
        <Alert tone="warning" className="mt-4">
          <span>
            <span>
              Autre{c.overlaps.length > 1 ? "s" : ""} cycle{c.overlaps.length > 1 ? "s" : ""} en même temps sur cette parcelle :{" "}
              {c.overlaps.map((o, i) => (
                <span key={o.id}>
                  {i > 0 ? ", " : ""}
                  <Link href={`/cycles/${o.id}`} className="font-semibold underline">
                    {o.crop}
                  </Link>
                </span>
              ))}
              . Normal pour des cultures associées ; sinon, vérifiez qu&apos;il ne s&apos;agit pas d&apos;un doublon.
            </span>
          </span>
        </Alert>
      ) : null}

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <Card className="h-fit rounded-2xl p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[15px] font-semibold">Le cycle</h2>
            {editable ? (
              <EditDatesButton
                cycleId={c.id}
                values={{
                  sowing_date: c.sowing_date,
                  transplanting_date: c.transplanting_date,
                  expected_harvest_date: c.expected_harvest_date,
                  harvest_end_date: c.harvest_end_date,
                  declared_area_m2: c.declared_area_m2,
                }}
              />
            ) : null}
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3.5">
            <Fact label="Parcelle">
              <Link href={`/parcelles/${c.parcel.id}`} className="hover:underline">
                {c.parcel.agroid ? <AgroIdBadge code={c.parcel.agroid} /> : c.parcel.local_name}
              </Link>
            </Fact>
            <Fact label="Exploitant">{c.operator?.name ?? "—"}</Fact>
            <Fact label="Culture déclarée">{c.declared_crop.name_fr}</Fact>
            <Fact label="Culture confirmée">
              {c.confirmed_crop ? (
                <span className="text-forest">
                  {c.confirmed_crop.name_fr} <span className="font-normal text-muted">le {shortDate(c.confirmed_at)}</span>
                </span>
              ) : (
                <span className="font-normal text-muted">pas encore</span>
              )}
            </Fact>
            <Fact label={c.sowing_date ? "Semis" : "Semis prévu"}>{shortDate(c.sowing_date ?? c.planned_sowing_date)}</Fact>
            <Fact label="Repiquage">{shortDate(c.transplanting_date)}</Fact>
            <Fact label="Récolte prévue">{shortDate(c.expected_harvest_date)}</Fact>
            <Fact label="Fin de récolte">{shortDate(c.harvest_end_date)}</Fact>
            <Fact label="Surface cultivée">{c.declared_area_m2 ? formatArea(c.declared_area_m2) : "—"}</Fact>
            <Fact label="Rendement">{yieldText ?? "—"}</Fact>
          </dl>
          {ctx.can("crop_cycles.confirm") && !c.is_archived ? (
            <div className="mt-4 border-t border-line pt-4">
              <ConfirmCropButton
                cycleId={c.id}
                current={c.crop.code}
                crops={(cropsResult.data ?? []).map((k) => ({ code: k.code, name_fr: k.name_fr }))}
              />
            </div>
          ) : null}
        </Card>

        <div className="space-y-5">
          <section>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-[16px] font-semibold">
                <Wheat className="size-4 text-leaf" aria-hidden />
                Récoltes
                {c.total_harvest_kg ? (
                  <span className="tabular font-mono text-[14px] font-normal text-muted">· {formatKg(c.total_harvest_kg)}</span>
                ) : null}
              </h2>
              {canHarvest ? <AddHarvestButton cycleId={c.id} minDate={c.sowing_date} /> : null}
            </div>
            {c.harvests.length === 0 ? (
              <Card className="rounded-2xl px-5 py-6 text-center text-[14px] text-muted">
                {c.status === "planned" ? "Démarrez le cycle pour enregistrer des récoltes." : "Aucune récolte enregistrée."}
              </Card>
            ) : (
              <Card className="overflow-hidden rounded-2xl">
                <ul aria-label="Récoltes">
                  {c.harvests.map((h) => (
                    <li key={h.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3 last:border-0">
                      <span className="text-[14px]">
                        <span className="tabular font-mono font-semibold">{formatKg(h.quantity_kg)}</span>
                        {h.original_quantity && h.original_unit ? (
                          <span className="text-muted">
                            {" "}
                            · {Number(h.original_quantity).toLocaleString("fr-FR")} × {h.original_unit}
                          </span>
                        ) : null}
                      </span>
                      <span className="text-[13px] text-muted">
                        {shortDate(h.harvest_date)} · {MEASUREMENT_METHODS[h.measurement_method] ?? h.measurement_method}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-[16px] font-semibold">
                <Sprout className="size-4 text-leaf" aria-hidden />
                Opérations
              </h2>
              {editable ? <AddOperationButton cycleId={c.id} /> : null}
            </div>
            {operations.length === 0 ? (
              <Card className="rounded-2xl px-5 py-6 text-center text-[14px] text-muted">
                Aucune opération : préparation du sol, semis, irrigation, fertilisation, traitements…
              </Card>
            ) : (
              <Card className="overflow-hidden rounded-2xl">
                <ol aria-label="Opérations">
                  {operations.map((o) => (
                    <li key={o.id} className="grid grid-cols-[110px_minmax(0,1fr)] gap-x-4 border-b border-line px-5 py-3 last:border-0">
                      <span className="tabular text-[13px] text-muted">
                        {shortDate(o.performed_date ?? o.planned_date)}
                        {!o.performed_date ? <span className="block text-[11px] font-semibold text-gold">prévue</span> : null}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[14px] font-semibold">{OPERATION_TYPES[o.operation_type] ?? o.operation_type}</span>
                        <span className="block text-[13px] text-muted">
                          {[
                            o.product_text,
                            o.quantity ? `${Number(o.quantity).toLocaleString("fr-FR")} ${o.quantity_unit}`.trim() : "",
                            SOURCES[o.source] ?? o.source,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                        {o.notes ? <span className="mt-0.5 block text-[13px]">{o.notes}</span> : null}
                      </span>
                    </li>
                  ))}
                </ol>
              </Card>
            )}
          </section>
        </div>
      </div>
    </AppShell>
  );
}
