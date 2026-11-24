import { ArrowLeft, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { AppShell, PageHeader } from "@/components/app-shell";
import { AutoSubmitSelect } from "@/components/auto-submit-select";
import { type CycleRow, CycleTable } from "@/components/cycle-table";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CYCLE_STATUS } from "@/lib/agriculture";
import { COOPERATIVE_NAV } from "@/lib/navigation";
import { loadOrgContext } from "@/lib/org-context";

export const metadata: Metadata = { title: "Cycles de culture" };

const UUID = /^[0-9a-f-]{36}$/;
const PAGE_SIZE = 50;

export default async function CyclesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const status = sp.statut && sp.statut in CYCLE_STATUS ? sp.statut : "";
  const campaign = UUID.test(sp.campagne ?? "") ? (sp.campagne as string) : "";
  const crop = /^[a-z_]{2,32}$/.test(sp.culture ?? "") ? (sp.culture as string) : "";
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const ctx = await loadOrgContext();
  const [cyclesResult, campaignsResult, cropsResult] = await Promise.all([
    ctx.api.GET("/api/v1/crop-cycles/", {
      params: {
        header: ctx.header,
        query: { status: status || undefined, campaign: campaign || undefined, crop: crop || undefined, page },
      },
    }),
    ctx.api.GET("/api/v1/campaigns/", { params: { header: ctx.header } }),
    ctx.api.GET("/api/v1/crops/"),
  ]);
  const data = cyclesResult.data;
  const query = (p: number) => {
    const q = new URLSearchParams();
    if (status) q.set("statut", status);
    if (campaign) q.set("campagne", campaign);
    if (crop) q.set("culture", crop);
    if (p > 1) q.set("page", String(p));
    return `/cycles${q.size ? `?${q}` : ""}`;
  };

  return (
    <AppShell
      nav={COOPERATIVE_NAV}
      activeHref="/campagnes"
      workspace={ctx.shell.workspace}
      user={ctx.shell.user}
      breadcrumbs={[ctx.shell.workspace.name, "Campagnes", "Cycles"]}
    >
      <Link href="/campagnes" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-700 hover:underline">
        <ArrowLeft className="size-4" aria-hidden />
        Campagnes
      </Link>
      <PageHeader
        context={`${ctx.org.name} · ${ctx.typeLabel}`}
        title="Cycles de culture"
        description="Chaque cycle suit une culture sur une parcelle : semis, opérations, récoltes."
        actions={
          ctx.can("crop_cycles.manage") ? (
            <Button asChild className="h-10 rounded-xl">
              <Link href={`/cycles/nouveau${campaign ? `?campagne=${campaign}` : ""}`}>
                <Plus aria-hidden />
                Nouveau cycle
              </Link>
            </Button>
          ) : undefined
        }
      />
      {!data ? (
        <Alert tone="info" className="mt-6">
          Les cycles de culture ne sont pas accessibles avec votre rôle.
        </Alert>
      ) : (
        <>
          <form action="/cycles" className="mt-5 flex flex-wrap items-center gap-2" aria-label="Filtres des cycles">
            <AutoSubmitSelect
              name="statut"
              label="Statut"
              value={status}
              options={[["", "Statut : tous"], ...Object.entries(CYCLE_STATUS).map(([v, s]): [string, string] => [v, s.label])]}
            />
            <AutoSubmitSelect
              name="culture"
              label="Culture"
              value={crop}
              options={[["", "Culture : toutes"], ...(cropsResult.data ?? []).map((c): [string, string] => [c.code, c.name_fr])]}
            />
            {campaignsResult.data ? (
              <AutoSubmitSelect
                name="campagne"
                label="Campagne"
                value={campaign}
                options={[["", "Campagne : toutes"], ...campaignsResult.data.results.map((c): [string, string] => [c.id, c.name])]}
              />
            ) : null}
            {status || crop || campaign ? (
              <Link href="/cycles" className="text-[13px] font-semibold text-brand-700 hover:underline">
                Effacer les filtres
              </Link>
            ) : null}
            <span className="ml-auto tabular text-[13px] text-muted">
              {data.count} cycle{data.count > 1 ? "s" : ""}
            </span>
          </form>
          <div className="mt-3">
            <CycleTable
              cycles={data.results as CycleRow[]}
              empty={status || crop || campaign ? "Aucun cycle ne correspond aux filtres." : "Aucun cycle de culture enregistré."}
            />
          </div>
          {data.previous || data.next ? (
            <nav aria-label="Pages" className="mt-4 flex items-center justify-end gap-2 text-[13px]">
              {data.previous ? (
                <Link href={query(page - 1)} className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-1.5 hover:bg-surface">
                  <ChevronLeft className="size-4" aria-hidden /> Précédents
                </Link>
              ) : null}
              <span className="text-muted">
                Page {page} / {Math.max(1, Math.ceil(data.count / PAGE_SIZE))}
              </span>
              {data.next ? (
                <Link href={query(page + 1)} className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-1.5 hover:bg-surface">
                  Suivants <ChevronRight className="size-4" aria-hidden />
                </Link>
              ) : null}
            </nav>
          ) : null}
        </>
      )}
    </AppShell>
  );
}
