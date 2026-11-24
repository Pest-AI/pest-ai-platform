import { ArrowLeft, Plus, Ruler, Sprout, Wheat } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell, PageHeader, Stat, StatRow } from "@/components/app-shell";
import { type CycleRow, CycleTable } from "@/components/cycle-table";
import { StatusPill } from "@/components/list-toolbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CAMPAIGN_STATUS, SEASONS, campaignPeriod, formatKg } from "@/lib/agriculture";
import { COOPERATIVE_NAV } from "@/lib/navigation";
import { loadOrgContext } from "@/lib/org-context";
import { hectares } from "@/lib/parcels";

import { CampaignStatusActions } from "../campaign-dialogs";

export const metadata: Metadata = { title: "Campagne" };

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const ctx = await loadOrgContext();
  const [campaignResult, cyclesResult] = await Promise.all([
    ctx.api.GET("/api/v1/campaigns/{id}/", { params: { header: ctx.header, path: { id } } }),
    ctx.api.GET("/api/v1/crop-cycles/", { params: { header: ctx.header, query: { campaign: id } } }),
  ]);
  const campaign = campaignResult.data;
  if (!campaign) notFound();
  const cycles = (cyclesResult.data?.results ?? []) as CycleRow[];
  const st = CAMPAIGN_STATUS[campaign.status] ?? { label: campaign.status, tone: "neutral" as const };
  const area = cycles.reduce((s, c) => s + Number((c as { declared_area_m2?: string | null }).declared_area_m2 ?? 0), 0);
  const harvest = cycles.reduce((s, c) => s + Number(c.total_harvest_kg ?? 0), 0);
  const byCrop = Object.entries(
    cycles.reduce<Record<string, number>>((acc, c) => ({ ...acc, [c.crop.name_fr]: (acc[c.crop.name_fr] ?? 0) + 1 }), {}),
  ).sort((a, b) => b[1] - a[1]);
  const canAddCycle = ctx.can("crop_cycles.manage") && campaign.status !== "closed" && !campaign.is_archived;

  return (
    <AppShell
      nav={COOPERATIVE_NAV}
      activeHref="/campagnes"
      workspace={ctx.shell.workspace}
      user={ctx.shell.user}
      breadcrumbs={[ctx.shell.workspace.name, "Campagnes", campaign.name]}
    >
      <Link href="/campagnes" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-700 hover:underline">
        <ArrowLeft className="size-4" aria-hidden />
        Campagnes
      </Link>
      <PageHeader
        context={`${SEASONS[campaign.season_type] ?? campaign.season_type} · ${campaign.year} · ${campaignPeriod(campaign.start_date, campaign.end_date)}`}
        title={campaign.name}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone={st.tone}>{st.label}</StatusPill>
            {ctx.can("campaigns.manage") && !campaign.is_archived ? (
              <CampaignStatusActions campaignId={campaign.id} status={campaign.status} />
            ) : null}
            {canAddCycle ? (
              <Button asChild className="h-10 rounded-xl">
                <Link href={`/cycles/nouveau?campagne=${campaign.id}`}>
                  <Plus aria-hidden />
                  Nouveau cycle
                </Link>
              </Button>
            ) : null}
          </div>
        }
      />

      <StatRow>
        <Stat label="Cycles" icon={Sprout} value={String(cycles.length)} hint={`${cycles.filter((c) => c.status === "in_progress").length} en cours`} />
        <Stat label="Surface déclarée" icon={Ruler} value={area ? hectares(area) : "—"} unit={area ? "ha" : undefined} hint="somme des cycles" />
        <Stat label="Récolté" icon={Wheat} value={harvest ? formatKg(harvest) : "—"} hint="récoltes enregistrées" />
      </StatRow>

      {byCrop.length > 0 ? (
        <Card className="mt-5 flex flex-wrap items-center gap-2 rounded-2xl p-4">
          <span className="mr-1 text-[13px] font-semibold">Cultures</span>
          {byCrop.map(([crop, n]) => (
            <Link
              key={crop}
              href={`/cycles?campagne=${campaign.id}&culture=${cycles.find((c) => c.crop.name_fr === crop)?.crop.code ?? ""}`}
              className="rounded-full border border-line bg-surface px-3 py-1 text-[13px] hover:border-leaf/40"
            >
              {crop} <span className="tabular font-mono text-muted">{n}</span>
            </Link>
          ))}
        </Card>
      ) : null}

      <section className="mt-6">
        <h2 className="mb-3 text-[16px] font-semibold">Cycles de la campagne</h2>
        <CycleTable
          cycles={cycles}
          hideCampaign
          empty={canAddCycle ? "Aucun cycle : ajoutez les cultures de vos parcelles avec « Nouveau cycle »." : "Aucun cycle dans cette campagne."}
        />
      </section>
    </AppShell>
  );
}
