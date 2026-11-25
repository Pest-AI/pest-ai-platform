"use client";

import { Check, LoaderCircle, Search, X } from "lucide-react";
import { useActionState, useEffect, useState } from "react";

import { AgroIdBadge } from "@/components/agroid-badge";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PLANTING_METHODS, SEED_SOURCES } from "@/lib/agriculture";
import { formatArea } from "@/lib/parcels";
import { cn } from "@/lib/utils";

import { type FormState, createCycle } from "../../campagnes/actions";
import { SELECT } from "../../campagnes/campaign-dialogs";

type Crop = { code: string; name_fr: string; varieties: { id: string; name: string }[] };
type Campaign = { id: string; name: string };
type ParcelHit = { id: string; agroid: string | null; local_name: string };
type ParcelInfo = ParcelHit & {
  area_m2: string | null;
  operator: string | null;
  units: { id: string; code: string; name: string; area_m2: string | null }[];
};

function ParcelPicker({ value, onChange }: { value: ParcelInfo | null; onChange: (p: ParcelInfo | null) => void }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<ParcelHit[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (q.trim().length < 2) return;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/parcelles/localiser?q=${encodeURIComponent(q.trim())}`);
        setHits(res.ok ? ((await res.json()).results as ParcelHit[]) : []);
      } catch {
        setHits([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [q]);

  const pick = async (hit: ParcelHit) => {
    const res = await fetch(`/cycles/parcelle?id=${hit.id}`);
    if (res.ok) onChange((await res.json()) as ParcelInfo);
  };

  if (value) {
    return (
      <div className="flex items-start justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold">{value.local_name || "Parcelle sans nom"}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[13px] text-muted">
            {value.agroid ? <AgroIdBadge code={value.agroid} /> : null}
            {value.area_m2 ? <span>{formatArea(value.area_m2)}</span> : <span>contour à relever</span>}
            {value.operator ? <span>· {value.operator}</span> : null}
          </p>
        </div>
        <button type="button" aria-label="Changer de parcelle" onClick={() => onChange(null)} className="text-muted hover:text-ink">
          <X className="size-4" aria-hidden />
        </button>
      </div>
    );
  }
  const shown = q.trim().length >= 2 ? hits : [];
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
      <input
        id="parcel-search"
        type="search"
        autoComplete="off"
        value={q}
        onChange={(e) => setQ(e.currentTarget.value)}
        placeholder="AgroID ou nom de la parcelle…"
        className="h-11 w-full rounded-lg border border-field bg-canvas pr-3 pl-9 text-[15px] focus:border-brand-800 focus:ring-3 focus:ring-gold/35 focus:outline-none"
      />
      {q.trim().length >= 2 ? (
        <ul role="listbox" aria-label="Parcelles trouvées" className="mt-1 overflow-hidden rounded-xl border border-line bg-canvas">
          {loading && shown.length === 0 ? (
            <li className="px-3 py-2 text-[13px] text-muted">Recherche…</li>
          ) : shown.length === 0 ? (
            <li className="px-3 py-2 text-[13px] text-muted">Aucune parcelle trouvée</li>
          ) : (
            shown.map((h) => (
              <li key={h.id} role="option" aria-selected={false}>
                <button type="button" onClick={() => pick(h)} className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-surface">
                  <span className="truncate text-[14px] font-semibold">{h.local_name || "Parcelle sans nom"}</span>
                  {h.agroid ? <AgroIdBadge code={h.agroid} /> : null}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}

export function CycleForm({
  crops,
  campaigns,
  defaultCampaign,
  initialParcel,
}: {
  crops: Crop[];
  campaigns: Campaign[];
  defaultCampaign: string;
  initialParcel: ParcelInfo | null;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(createCycle, { status: "idle" });
  const [parcel, setParcel] = useState<ParcelInfo | null>(initialParcel);
  const [crop, setCrop] = useState("");
  const [started, setStarted] = useState(false);
  const varieties = crops.find((c) => c.code === crop)?.varieties ?? [];

  return (
    <form action={action} className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <input type="hidden" name="parcel" value={parcel?.id ?? ""} />
      <input type="hidden" name="status" value={started ? "in_progress" : "planned"} />
      <div className="space-y-5 rounded-2xl border border-line bg-canvas p-5">
        <div className="space-y-1.5">
          <Label htmlFor="parcel-search">Parcelle</Label>
          <ParcelPicker value={parcel} onChange={setParcel} />
        </div>
        {parcel && parcel.units.length > 0 ? (
          <div className="space-y-1.5">
            <Label htmlFor="unit">
              Unité de culture <span className="font-normal text-muted">(facultatif)</span>
            </Label>
            <select id="unit" name="cultivation_unit" defaultValue="" className={SELECT}>
              <option value="">Toute la parcelle</option>
              {parcel.units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.code}
                  {u.name ? ` — ${u.name}` : ""}
                  {u.area_m2 ? ` (${formatArea(u.area_m2)})` : ""}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <fieldset>
          <legend className="text-[13px] font-medium">Culture</legend>
          <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {crops.map((c) => (
              <label
                key={c.code}
                className="flex h-11 cursor-pointer items-center justify-center rounded-lg border border-line text-[14px] font-medium hover:bg-surface has-[:checked]:border-brand-800 has-[:checked]:bg-brand-50 has-[:checked]:text-brand-800"
              >
                <input
                  type="radio"
                  name="declared_crop"
                  value={c.code}
                  required
                  checked={crop === c.code}
                  onChange={() => setCrop(c.code)}
                  className="sr-only"
                />
                {c.name_fr}
              </label>
            ))}
          </div>
        </fieldset>
        {varieties.length > 0 ? (
          <div className="space-y-1.5">
            <Label htmlFor="variety">
              Variété <span className="font-normal text-muted">(facultatif)</span>
            </Label>
            <select id="variety" name="variety" defaultValue="" className={SELECT}>
              <option value="">Non précisée</option>
              {varieties.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="campaign">Campagne</Label>
          <select id="campaign" name="campaign" defaultValue={defaultCampaign} className={SELECT}>
            <option value="">Hors campagne</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="h-fit space-y-4 rounded-2xl border border-line bg-canvas p-5 lg:sticky lg:top-5">
        <fieldset>
          <legend className="text-[13px] font-medium">Où en est la culture ?</legend>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            {[
              [false, "À venir"],
              [true, "Déjà semée"],
            ].map(([value, text]) => (
              <button
                key={String(value)}
                type="button"
                aria-pressed={started === value}
                onClick={() => setStarted(value as boolean)}
                className={cn(
                  "h-10 rounded-lg border text-[14px] font-medium",
                  started === value ? "border-brand-800 bg-brand-50 text-brand-800" : "border-line hover:bg-surface",
                )}
              >
                {text as string}
              </button>
            ))}
          </div>
        </fieldset>
        {started ? (
          <div className="space-y-1.5">
            <Label htmlFor="sowing">Date de semis</Label>
            <Input id="sowing" name="sowing_date" type="date" />
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="planned">
              Semis prévu <span className="font-normal text-muted">(facultatif)</span>
            </Label>
            <Input id="planned" name="planned_sowing_date" type="date" />
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="harvest">
            Récolte prévue <span className="font-normal text-muted">(facultatif)</span>
          </Label>
          <Input id="harvest" name="expected_harvest_date" type="date" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="area">
            Surface cultivée en m² <span className="font-normal text-muted">(facultatif)</span>
          </Label>
          <Input
            id="area"
            name="declared_area_m2"
            inputMode="decimal"
            placeholder={parcel?.area_m2 ? `parcelle : ${Math.round(Number(parcel.area_m2))} m²` : "ex. 5000"}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="seed_source">
              Semence <span className="font-normal text-muted">(facultatif)</span>
            </Label>
            <select id="seed_source" name="seed_source" defaultValue="" className={SELECT}>
              <option value="">Non renseignée</option>
              {Object.entries(SEED_SOURCES).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="planting_method">
              Implantation <span className="font-normal text-muted">(facultatif)</span>
            </Label>
            <select id="planting_method" name="planting_method" defaultValue="" className={SELECT}>
              <option value="">Non renseignée</option>
              {Object.entries(PLANTING_METHODS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="previous">
            Saison précédente <span className="font-normal text-muted">(facultatif)</span>
          </Label>
          <select id="previous" name="previous" defaultValue="" className={SELECT}>
            <option value="">Non renseignée</option>
            <option value="fallow">Jachère</option>
            {crops.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name_fr}
              </option>
            ))}
          </select>
        </div>
        {parcel && !parcel.operator ? (
          <p className="text-[12px] leading-5 text-muted">
            Aucun exploitant principal sur cette parcelle : le cycle sera enregistré sans exploitant.
          </p>
        ) : null}
        {state.status === "error" ? <Alert tone="danger">{state.message}</Alert> : null}
        <Button type="submit" disabled={pending || !parcel || !crop} className="h-10 w-full rounded-xl">
          {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : <Check aria-hidden />}
          Enregistrer le cycle
        </Button>
      </div>
    </form>
  );
}
