"use client";

import { CalendarPlus, LoaderCircle } from "lucide-react";
import { useActionState, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { CAMPAIGN_NEXT, SEASONS } from "@/lib/agriculture";

import { type FormState, changeCampaignStatus, createCampaign } from "./actions";

export const SELECT =
  "h-11 w-full rounded-lg border border-field bg-canvas px-3 text-[15px] text-ink focus:border-brand-800 focus:ring-3 focus:ring-gold/35 focus:outline-none";

/** Nouvelle campagne : nom, saison, année, période. Le nom est unique dans l'organisation. */
export function NewCampaignButton() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<FormState, FormData>(createCampaign, { status: "idle" });
  const year = new Date().getFullYear();
  return (
    <>
      <Button className="h-10 rounded-xl" onClick={() => setOpen(true)}>
        <CalendarPlus aria-hidden />
        Nouvelle campagne
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Nouvelle campagne" description="Une campagne regroupe les cycles de culture d'une saison.">
        <form action={action} className="space-y-4 px-6 py-5">
          {state.status === "error" ? <Alert tone="danger">{state.message}</Alert> : null}
          <div className="space-y-1.5">
            <Label htmlFor="c-name">Nom</Label>
            <Input id="c-name" name="name" required maxLength={150} placeholder="ex. Hivernage 2027" autoComplete="off" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="c-season">Saison</Label>
              <select id="c-season" name="season_type" defaultValue="rainy" className={SELECT}>
                {Object.entries(SEASONS).map(([v, t]) => (
                  <option key={v} value={v}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-year">Année</Label>
              <Input id="c-year" name="year" inputMode="numeric" maxLength={4} defaultValue={year} required />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="c-start">Début</Label>
              <Input id="c-start" name="start_date" type="date" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-end">
                Fin <span className="font-normal text-muted">(facultatif)</span>
              </Label>
              <Input id="c-end" name="end_date" type="date" />
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
              Créer la campagne
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

/** Boutons de changement de statut d'une campagne (planned → active → closed). */
export function CampaignStatusActions({ campaignId, status }: { campaignId: string; status: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(changeCampaignStatus, { status: "idle" });
  const next = CAMPAIGN_NEXT[status] ?? [];
  if (next.length === 0) return null;
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="campaign_id" value={campaignId} />
      {next.map((n) => (
        <Button
          key={n.status}
          type="submit"
          name="status"
          value={n.status}
          variant={n.status === "closed" ? "secondary" : "primary"}
          disabled={pending}
          className="h-10 rounded-xl"
          onClick={(e) => {
            if (n.status === "closed" && !window.confirm("Clôturer la campagne ? Elle ne se modifiera plus et n'acceptera plus de cycle.")) {
              e.preventDefault();
            }
          }}
        >
          {n.label}
        </Button>
      ))}
      {state.status === "error" ? <span className="text-[13px] text-danger">{state.message}</span> : null}
    </form>
  );
}
