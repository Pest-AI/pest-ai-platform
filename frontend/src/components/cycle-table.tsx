import Link from "next/link";

import { AgroIdBadge } from "@/components/agroid-badge";
import { StatusPill } from "@/components/list-toolbar";
import { Card } from "@/components/ui/card";
import { CYCLE_STATUS, formatKg, shortDate } from "@/lib/agriculture";

export type CycleRow = {
  id: string;
  parcel: { id: string; agroid: string | null; local_name: string };
  crop: { code: string; name_fr: string };
  campaign: { id: string; name: string } | null;
  operator: { id: string; name: string } | null;
  cultivation_unit: { id: string; code: string } | null;
  variety: { name: string } | null;
  status: string;
  sowing_date?: string | null;
  planned_sowing_date?: string | null;
  expected_harvest_date?: string | null;
  total_harvest_kg?: string | null;
};

const GRID = "lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_120px_130px_100px]";

/** Tableau des cycles de culture (lecture) : chaque ligne ouvre la fiche du cycle. */
export function CycleTable({ cycles, hideCampaign = false, empty }: { cycles: CycleRow[]; hideCampaign?: boolean; empty: string }) {
  if (cycles.length === 0) {
    return (
      <Card className="rounded-2xl px-6 py-10 text-center">
        <p className="text-[14px] text-muted">{empty}</p>
      </Card>
    );
  }
  return (
    <Card className="overflow-hidden rounded-2xl">
      <div aria-hidden className={`hidden border-b border-line bg-surface px-5 py-3 text-[12px] font-semibold text-muted lg:grid lg:gap-4 ${GRID}`}>
        <span>Parcelle</span>
        <span>Culture</span>
        <span>{hideCampaign ? "Exploitant" : "Campagne"}</span>
        <span>Statut</span>
        <span>Semis</span>
        <span className="text-right">Récolté</span>
      </div>
      <ul aria-label="Cycles de culture">
        {cycles.map((c) => {
          const st = CYCLE_STATUS[c.status] ?? { label: c.status, tone: "neutral" as const };
          return (
            <li key={c.id} className="border-b border-line last:border-0">
              <Link
                href={`/cycles/${c.id}`}
                className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-5 py-3.5 hover:bg-surface lg:gap-4 ${GRID}`}
              >
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-semibold">{c.parcel.local_name || "Parcelle sans nom"}</span>
                  {c.parcel.agroid ? <AgroIdBadge code={c.parcel.agroid} /> : null}
                  {c.cultivation_unit ? <span className="ml-1.5 text-[12px] text-muted">unité {c.cultivation_unit.code}</span> : null}
                </span>
                <span className="text-[14px] max-lg:col-start-1">
                  <span className="font-semibold">{c.crop.name_fr}</span>
                  {c.variety ? <span className="text-muted"> · {c.variety.name}</span> : null}
                </span>
                <span className="truncate text-[13px] text-muted max-lg:hidden">
                  {hideCampaign ? (c.operator?.name ?? "—") : (c.campaign?.name ?? "Hors campagne")}
                </span>
                <span className="max-lg:col-start-2 max-lg:row-start-1">
                  <StatusPill tone={st.tone}>{st.label}</StatusPill>
                </span>
                <span className="tabular text-[13px] text-muted max-lg:hidden">
                  {shortDate(c.sowing_date ?? c.planned_sowing_date)}
                  {!c.sowing_date && c.planned_sowing_date ? <span className="block text-[11px]">prévu</span> : null}
                </span>
                <span className="tabular text-right font-mono text-[13px] max-lg:hidden">
                  {c.total_harvest_kg ? formatKg(c.total_harvest_kg) : "—"}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
