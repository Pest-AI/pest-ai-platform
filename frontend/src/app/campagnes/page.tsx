import { CalendarDays, Sprout, Wheat } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { AppShell, PageHeader, Stat, StatRow } from "@/components/app-shell";
import { StatusPill } from "@/components/list-toolbar";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CAMPAIGN_STATUS, SEASONS, campaignPeriod } from "@/lib/agriculture";
import { COOPERATIVE_NAV } from "@/lib/navigation";
import { loadOrgContext } from "@/lib/org-context";

import { NewCampaignButton } from "./campaign-dialogs";

export const metadata: Metadata = { title: "Campagnes" };

export default async function CampaignsPage() {
  const ctx = await loadOrgContext();
  const [campaignsResult, cyclesResult] = await Promise.all([
    ctx.api.GET("/api/v1/campaigns/", { params: { header: ctx.header } }),
    ctx.api.GET("/api/v1/crop-cycles/", { params: { header: ctx.header, query: { status: "in_progress" } } }),
  ]);
  const campaigns = campaignsResult.data?.results ?? null;
  const active = campaigns?.filter((c) => c.status === "active") ?? [];
  const totalCycles = campaigns?.reduce((n, c) => n + (c.cycle_count ?? 0), 0) ?? 0;
  const running = cyclesResult.data?.count ?? 0;

  return (
    <AppShell
      nav={COOPERATIVE_NAV}
      activeHref="/campagnes"
      workspace={ctx.shell.workspace}
      user={ctx.shell.user}
      breadcrumbs={[ctx.shell.workspace.name, "Campagnes"]}
    >
      <PageHeader
        context={`${ctx.org.name} · ${ctx.typeLabel}`}
        title="Campagnes"
        description="Hivernage, contre-saisons : chaque campagne regroupe les cycles de culture suivis sur vos parcelles."
        actions={
          campaigns ? (
            <div className="flex flex-wrap gap-2">
              {ctx.can("crop_cycles.view") ? (
                <Button asChild variant="secondary" className="h-10 rounded-xl">
                  <Link href="/cycles">
                    <Sprout aria-hidden />
                    Tous les cycles
                  </Link>
                </Button>
              ) : null}
              {ctx.can("campaigns.manage") ? <NewCampaignButton /> : null}
            </div>
          ) : undefined
        }
      />

      {!campaigns ? (
        <Alert tone="info" className="mt-6">
          Les campagnes ne sont pas accessibles avec votre rôle.
        </Alert>
      ) : (
        <>
          <StatRow>
            <Stat label="Campagnes" icon={CalendarDays} value={String(campaigns.length)} hint={`${active.length} en cours`} />
            <Stat label="Cycles suivis" icon={Wheat} value={String(totalCycles)} hint="dans les campagnes" />
            <Stat
              label="Cycles en cours"
              icon={Sprout}
              value={String(running)}
              valueTone={running ? "success" : undefined}
              hint="toutes campagnes"
              href={ctx.can("crop_cycles.view") ? "/cycles?statut=in_progress" : undefined}
            />
          </StatRow>

          {campaigns.length === 0 ? (
            <Card className="mt-6 grid place-items-center rounded-2xl px-6 py-14 text-center">
              <span className="grid size-12 place-items-center rounded-2xl bg-brand-50 text-forest">
                <CalendarDays className="size-6" aria-hidden />
              </span>
              <p className="mt-3 font-display text-[17px] font-semibold">Aucune campagne pour le moment</p>
              <p className="mt-1 max-w-md text-[14px] text-muted">
                Créez la campagne de la saison (hivernage, contre-saison) puis rattachez-y les cycles de culture de vos parcelles.
              </p>
            </Card>
          ) : (
            <ul aria-label="Campagnes" className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {campaigns.map((c) => {
                const st = CAMPAIGN_STATUS[c.status] ?? { label: c.status, tone: "neutral" as const };
                return (
                  <li key={c.id}>
                    <Link
                      href={`/campagnes/${c.id}`}
                      className="block h-full rounded-2xl border border-line bg-canvas p-5 transition-colors hover:border-leaf/40 hover:shadow-pop"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[12px] font-semibold tracking-wide text-leaf uppercase">
                            {SEASONS[c.season_type] ?? c.season_type} · {c.year}
                          </p>
                          <p className="mt-1 truncate font-display text-[18px] font-semibold">{c.name}</p>
                        </div>
                        <StatusPill tone={st.tone}>{st.label}</StatusPill>
                      </div>
                      <p className="mt-2 text-[13px] text-muted">{campaignPeriod(c.start_date, c.end_date)}</p>
                      <p className="mt-4 border-t border-line pt-3 text-[13px]">
                        <span className="tabular font-mono font-semibold">{c.cycle_count ?? 0}</span>{" "}
                        <span className="text-muted">cycle{(c.cycle_count ?? 0) > 1 ? "s" : ""} de culture</span>
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </AppShell>
  );
}
