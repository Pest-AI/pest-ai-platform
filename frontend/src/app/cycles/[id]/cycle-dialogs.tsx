"use client";

import { PLANTING_METHODS, SEED_SOURCES } from "@/lib/agriculture";
import { BadgeCheck, CalendarClock, LoaderCircle, Plus, Wheat } from "lucide-react";
import { useActionState, useEffect, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { CYCLE_NEXT, MEASUREMENT_METHODS, OPERATION_TYPES, todayIso } from "@/lib/agriculture";
import { cn } from "@/lib/utils";

import { type FormState, addHarvest, addOperation, confirmCrop, updateCycle } from "../../campagnes/actions";
import { SELECT } from "../../campagnes/campaign-dialogs";

const IDLE: FormState = { status: "idle" };

/** Ferme la fenêtre quand l'action a réussi. */
function useCloseOnDone(state: FormState, close: () => void) {
  useEffect(() => {
    if (state.status === "done") close();
  }, [state, close]);
}

function Footer({ pending, label, onCancel }: { pending: boolean; label: string; onCancel: () => void }) {
  return (
    <div className="flex justify-end gap-2 border-t border-line pt-4">
      <Button type="button" variant="ghost" onClick={onCancel}>
        Annuler
      </Button>
      <Button type="submit" disabled={pending}>
        {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
        {label}
      </Button>
    </div>
  );
}

const CONFIRM: Record<string, string> = {
  abandoned: "Abandonner ce cycle ? Il ne pourra plus recevoir de récolte.",
  harvested: "Marquer le cycle comme récolté ? Son statut ne pourra plus changer.",
};

export function CycleStatusActions({ cycleId, status }: { cycleId: string; status: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateCycle, IDLE);
  const next = CYCLE_NEXT[status] ?? [];
  if (next.length === 0) return null;
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="cycle_id" value={cycleId} />
      {next.map((n) => (
        <Button
          key={n.status}
          type="submit"
          name="status"
          value={n.status}
          variant={n.status === "abandoned" ? "ghost" : "primary"}
          disabled={pending}
          className="h-10 rounded-xl"
          onClick={(e) => {
            const message = CONFIRM[n.status];
            if (message && !window.confirm(message)) e.preventDefault();
          }}
        >
          {n.label}
        </Button>
      ))}
      {state.status === "error" ? <span className="text-[13px] text-danger">{state.message}</span> : null}
    </form>
  );
}

export function EditDatesButton({
  cycleId,
  values,
  crops,
}: {
  cycleId: string;
  values: {
    sowing_date: string | null;
    transplanting_date: string | null;
    expected_harvest_date: string | null;
    harvest_end_date: string | null;
    declared_area_m2: string | null;
    seed_source: string;
    planting_method: string;
    previous: string;
  };
  crops: { code: string; name_fr: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<FormState, FormData>(updateCycle, IDLE);
  useCloseOnDone(state, () => setOpen(false));
  const field = (name: "sowing_date" | "transplanting_date" | "expected_harvest_date" | "harvest_end_date", label: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={`d-${name}`}>{label}</Label>
      <Input id={`d-${name}`} name={name} type="date" defaultValue={values[name] ?? ""} />
    </div>
  );
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <CalendarClock aria-hidden />
        Modifier
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Dates, surface et implantation">
        <form action={action} className="space-y-4 px-6 py-5">
          <input type="hidden" name="cycle_id" value={cycleId} />
          {state.status === "error" ? <Alert tone="danger">{state.message}</Alert> : null}
          <div className="grid gap-3 sm:grid-cols-2">
            {field("sowing_date", "Semis")}
            {field("transplanting_date", "Repiquage")}
            {field("expected_harvest_date", "Récolte prévue")}
            {field("harvest_end_date", "Fin de récolte")}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="d-area">Surface cultivée (m²)</Label>
            <Input id="d-area" name="declared_area_m2" inputMode="decimal" defaultValue={values.declared_area_m2 ?? ""} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="d-seed">Semence</Label>
              <select id="d-seed" name="seed_source" defaultValue={values.seed_source} className={SELECT}>
                <option value="">Non renseignée</option>
                {Object.entries(SEED_SOURCES).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="d-planting">Implantation</Label>
              <select id="d-planting" name="planting_method" defaultValue={values.planting_method} className={SELECT}>
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
            <Label htmlFor="d-previous">Saison précédente</Label>
            <select id="d-previous" name="previous" defaultValue={values.previous} className={SELECT}>
              <option value="">Non renseignée</option>
              <option value="fallow">Jachère</option>
              {crops.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name_fr}
                </option>
              ))}
            </select>
          </div>
          <Footer pending={pending} label="Enregistrer" onCancel={() => setOpen(false)} />
        </form>
      </Modal>
    </>
  );
}

export function ConfirmCropButton({ cycleId, crops, current }: { cycleId: string; crops: { code: string; name_fr: string }[]; current: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<FormState, FormData>(confirmCrop, IDLE);
  useCloseOnDone(state, () => setOpen(false));
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <BadgeCheck aria-hidden />
        Confirmer la culture
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Confirmer la culture" description="Culture vérifiée sur la parcelle. La culture déclarée reste dans l'historique.">
        <form action={action} className="space-y-4 px-6 py-5">
          <input type="hidden" name="cycle_id" value={cycleId} />
          {state.status === "error" ? <Alert tone="danger">{state.message}</Alert> : null}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {crops.map((c) => (
              <label
                key={c.code}
                className="flex h-11 cursor-pointer items-center justify-center rounded-lg border border-line text-[14px] font-medium hover:bg-surface has-[:checked]:border-brand-800 has-[:checked]:bg-brand-50 has-[:checked]:text-brand-800"
              >
                <input type="radio" name="crop" value={c.code} defaultChecked={c.code === current} required className="sr-only" />
                {c.name_fr}
              </label>
            ))}
          </div>
          <Footer pending={pending} label="Confirmer" onCancel={() => setOpen(false)} />
        </form>
      </Modal>
    </>
  );
}

export function AddOperationButton({ cycleId }: { cycleId: string }) {
  const [open, setOpen] = useState(false);
  const [when, setWhen] = useState<"done" | "planned">("done");
  const [state, action, pending] = useActionState<FormState, FormData>(addOperation, IDLE);
  useCloseOnDone(state, () => setOpen(false));
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus aria-hidden />
        Opération
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Nouvelle opération" description="Semis, irrigation, fertilisation, traitement…">
        <form action={action} className="space-y-4 px-6 py-5">
          <input type="hidden" name="cycle_id" value={cycleId} />
          <input type="hidden" name="when" value={when} />
          {state.status === "error" ? <Alert tone="danger">{state.message}</Alert> : null}
          <div className="space-y-1.5">
            <Label htmlFor="o-type">Opération</Label>
            <select id="o-type" name="operation_type" required defaultValue="" className={SELECT}>
              <option value="" disabled>
                Choisir…
              </option>
              {Object.entries(OPERATION_TYPES).map(([v, t]) => (
                <option key={v} value={v}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(["done", "planned"] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={when === v}
                onClick={() => setWhen(v)}
                className={cn(
                  "h-10 rounded-lg border text-[14px] font-medium",
                  when === v ? "border-brand-800 bg-brand-50 text-brand-800" : "border-line hover:bg-surface",
                )}
              >
                {v === "done" ? "Réalisée" : "Prévue"}
              </button>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="o-date">{when === "done" ? "Date de réalisation" : "Date prévue"}</Label>
            <Input id="o-date" name="date" type="date" required defaultValue={when === "done" ? todayIso() : ""} />
          </div>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,0.7fr)_minmax(0,0.7fr)]">
            <div className="space-y-1.5">
              <Label htmlFor="o-product">
                Produit <span className="font-normal text-muted">(facultatif)</span>
              </Label>
              <Input id="o-product" name="product_text" maxLength={200} placeholder="ex. Urée 46 %" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="o-qty">Quantité</Label>
              <Input id="o-qty" name="quantity" inputMode="decimal" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="o-unit">Unité</Label>
              <Input id="o-unit" name="quantity_unit" maxLength={20} placeholder="kg, L…" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="o-notes">
              Remarques <span className="font-normal text-muted">(facultatif)</span>
            </Label>
            <textarea id="o-notes" name="notes" rows={2} className="w-full rounded-lg border border-field bg-canvas px-3 py-2 text-[15px] focus:border-brand-800 focus:outline-none" />
          </div>
          <Footer pending={pending} label="Enregistrer" onCancel={() => setOpen(false)} />
        </form>
      </Modal>
    </>
  );
}

export function AddHarvestButton({ cycleId, minDate }: { cycleId: string; minDate: string | null }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"kg" | "units">("units");
  const [count, setCount] = useState("");
  const [unitKg, setUnitKg] = useState("");
  const [state, action, pending] = useActionState<FormState, FormData>(addHarvest, IDLE);
  useCloseOnDone(state, () => setOpen(false));
  const total = Number(count.replace(",", ".")) * Number(unitKg.replace(",", "."));
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Wheat aria-hidden />
        Récolte
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Nouvelle récolte" description="La quantité est enregistrée en kg ; l'unité d'origine est conservée.">
        <form action={action} className="space-y-4 px-6 py-5">
          <input type="hidden" name="cycle_id" value={cycleId} />
          {state.status === "error" ? <Alert tone="danger">{state.message}</Alert> : null}
          <div className="space-y-1.5">
            <Label htmlFor="h-date">Date de récolte</Label>
            <Input id="h-date" name="harvest_date" type="date" required defaultValue={todayIso()} min={minDate ?? undefined} max={todayIso()} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(["units", "kg"] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={mode === v}
                onClick={() => setMode(v)}
                className={cn(
                  "h-10 rounded-lg border text-[14px] font-medium",
                  mode === v ? "border-brand-800 bg-brand-50 text-brand-800" : "border-line hover:bg-surface",
                )}
              >
                {v === "units" ? "En sacs ou caisses" : "En kg"}
              </button>
            ))}
          </div>
          {mode === "units" ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="h-count">Nombre</Label>
                <Input id="h-count" name="original_quantity" inputMode="decimal" value={count} onChange={(e) => setCount(e.currentTarget.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="h-unit">Contenant</Label>
                <Input id="h-unit" name="unit_name" defaultValue="sac" maxLength={10} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="h-unitkg">kg par contenant</Label>
                <Input id="h-unitkg" name="unit_kg" inputMode="decimal" value={unitKg} onChange={(e) => setUnitKg(e.currentTarget.value)} required placeholder="ex. 80" />
              </div>
              <p className="text-[13px] text-muted sm:col-span-3" aria-live="polite">
                {Number.isFinite(total) && total > 0 ? `Soit ${total.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} kg.` : " "}
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="h-kg">Quantité (kg)</Label>
              <Input id="h-kg" name="quantity_kg" inputMode="decimal" required />
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="h-method">Mesure</Label>
              <select id="h-method" name="measurement_method" defaultValue="declared" className={SELECT}>
                {Object.entries(MEASUREMENT_METHODS).map(([v, t]) => (
                  <option key={v} value={v}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="h-area">
                Surface récoltée (m²) <span className="font-normal text-muted">(facultatif)</span>
              </Label>
              <Input id="h-area" name="harvested_area_m2" inputMode="decimal" />
            </div>
          </div>
          <Footer pending={pending} label="Enregistrer" onCancel={() => setOpen(false)} />
        </form>
      </Modal>
    </>
  );
}
