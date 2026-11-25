"use client";

import { Pencil } from "lucide-react";
import { useActionState, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { EVIDENCE_LABELS, SITE_FIELD_LABELS, SITE_SOIL_FIELDS, SITE_WATER_FIELDS } from "@/lib/parcels";

import { type SiteState, recordSite } from "./actions";

const SELECT =
  "h-10 w-full rounded-lg border border-field bg-canvas px-3 text-[14px] text-ink focus:border-brand-800 focus:outline-none focus:ring-3 focus:ring-gold/35";

type Item = { value: string; label: string };
export type SiteRefs = Record<string, Item[]>;

function Field({ name, refs, value }: { name: string; refs: SiteRefs; value?: string }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={`site-${name}`}>{SITE_FIELD_LABELS[name] ?? name}</Label>
      <select id={`site-${name}`} name={name} defaultValue={value ?? ""} className={SELECT}>
        <option value="">Non renseigné</option>
        {(refs[name] ?? []).map((i) => (
          <option key={i.value} value={i.value}>
            {i.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Mise à jour du sol, de l'eau et de l'accès : ajoute une version complète du profil. */
export function SiteDialog({
  parcelId,
  refs,
  current,
}: {
  parcelId: string;
  refs: SiteRefs;
  current: Record<string, string | null> | null;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<SiteState, FormData>(async (prev, form) => {
    const result = await recordSite(prev, form);
    if (result.status === "done") setOpen(false);
    return result;
  }, { status: "idle" });
  const v = (k: string) => current?.[k] ?? "";

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <Pencil aria-hidden />
        {current ? "Mettre à jour" : "Renseigner"}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Sol, eau et accès" description="Une nouvelle version est ajoutée ; la précédente reste dans l'historique.">
        <form action={action}>
          <input type="hidden" name="parcel_id" value={parcelId} />
          <div className="max-h-[65vh] space-y-5 overflow-y-auto px-6 py-5">
            {state.status === "error" ? <Alert>{state.message}</Alert> : null}
            <fieldset className="space-y-3">
              <legend className="text-[13px] font-semibold text-muted">Eau et irrigation</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {SITE_WATER_FIELDS.map((f) => (
                  <Field key={f} name={f} refs={refs} value={v(f)} />
                ))}
              </div>
              <div className="space-y-1">
                <Label htmlFor="site-scheme_name">Périmètre, casier ou maille</Label>
                <Input id="site-scheme_name" name="scheme_name" defaultValue={v("scheme_name")} placeholder="ex. PIV de Guédé, casier 3" />
              </div>
            </fieldset>
            <fieldset className="space-y-3">
              <legend className="text-[13px] font-semibold text-muted">Sol</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {SITE_SOIL_FIELDS.map((f) => (
                  <Field key={f} name={f} refs={refs} value={v(f)} />
                ))}
              </div>
            </fieldset>
            <fieldset className="space-y-3">
              <legend className="text-[13px] font-semibold text-muted">Accès et source</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field name="road_access" refs={refs} value={v("road_access")} />
                <div className="space-y-1">
                  <Label htmlFor="site-distance">Distance au village (km)</Label>
                  <Input id="site-distance" name="distance_to_village_km" inputMode="decimal" defaultValue={v("distance_to_village_km")} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="site-evidence">Niveau de preuve</Label>
                  <select id="site-evidence" name="evidence" defaultValue={v("evidence") || "declared"} className={SELECT}>
                    {Object.entries(EVIDENCE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="site-other">Précision « Autre »</Label>
                  <Input id="site-other" name="other_detail" defaultValue={v("other_detail")} />
                </div>
              </div>
            </fieldset>
          </div>
          <div className="flex justify-end gap-2 border-t border-line bg-surface px-6 py-4">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
