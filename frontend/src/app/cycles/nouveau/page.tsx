import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { AppShell, PageHeader } from "@/components/app-shell";
import { Alert } from "@/components/ui/alert";
import { COOPERATIVE_NAV } from "@/lib/navigation";
import { loadOrgContext } from "@/lib/org-context";

import { CycleForm } from "./cycle-form";

export const metadata: Metadata = { title: "Nouveau cycle" };

const UUID = /^[0-9a-f-]{36}$/;

export default async function NewCyclePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const ctx = await loadOrgContext();
  const parcelId = UUID.test(sp.parcelle ?? "") ? (sp.parcelle as string) : null;
  const [cropsResult, campaignsResult, parcelResult] = await Promise.all([
    ctx.api.GET("/api/v1/crops/"),
    ctx.api.GET("/api/v1/campaigns/", { params: { header: ctx.header } }),
    parcelId
      ? ctx.api.GET("/api/v1/parcels/{id}/", { params: { header: ctx.header, path: { id: parcelId } } })
      : Promise.resolve({ data: undefined }),
  ]);
  // Une campagne clôturée n'accepte plus de cycle (règle de l'API) : elle n'est pas proposée.
  const campaigns = (campaignsResult.data?.results ?? []).filter((c) => c.status !== "closed");
  const defaultCampaign = campaigns.some((c) => c.id === sp.campagne)
    ? (sp.campagne as string)
    : (campaigns.find((c) => c.status === "active")?.id ?? "");
  const p = parcelResult.data;
  const initialParcel = p
    ? {
        id: p.id,
        agroid: p.agroid,
        local_name: p.local_name,
        area_m2: p.current_area_m2,
        operator: (p.primary_operator as { name?: string } | null)?.name ?? null,
        units: p.units.filter((u) => u.status === "active").map((u) => ({ id: u.id, code: u.code, name: u.name, area_m2: u.area_m2 })),
      }
    : null;
  const back = sp.campagne && UUID.test(sp.campagne) ? `/campagnes/${sp.campagne}` : parcelId ? `/parcelles/${parcelId}` : "/cycles";

  return (
    <AppShell
      nav={COOPERATIVE_NAV}
      activeHref="/campagnes"
      workspace={ctx.shell.workspace}
      user={ctx.shell.user}
      breadcrumbs={[ctx.shell.workspace.name, "Campagnes", "Nouveau cycle"]}
    >
      <Link href={back} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-700 hover:underline">
        <ArrowLeft className="size-4" aria-hidden />
        Retour
      </Link>
      <PageHeader
        context={`${ctx.org.name} · ${ctx.typeLabel}`}
        title="Nouveau cycle de culture"
        description="Une culture sur une parcelle, pour une saison. L'exploitant principal de la parcelle est repris automatiquement."
      />
      {ctx.can("crop_cycles.manage") ? (
        <div className="mt-6">
          <CycleForm
            crops={(cropsResult.data ?? []).map((c) => ({ code: c.code, name_fr: c.name_fr, varieties: c.varieties }))}
            campaigns={campaigns.map((c) => ({ id: c.id, name: c.name }))}
            defaultCampaign={defaultCampaign}
            initialParcel={initialParcel}
          />
        </div>
      ) : (
        <Alert tone="info" className="mt-6">
          Votre rôle ne permet pas d&apos;enregistrer un cycle de culture.
        </Alert>
      )}
    </AppShell>
  );
}
