"use client";

import { Link2, Pencil, Sprout, UserMinus, UserPlus } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { LANGUAGE_LABELS, RELATIONSHIP_LABELS, SEX_LABELS, producerInitials } from "@/lib/producers";

import {
  type CreateState,
  type ProducerValues,
  type SimpleState,
  attachProducer,
  createProducer,
  detachProducer,
  updateProducer,
} from "./actions";

const SELECT =
  "h-11 w-full rounded-lg border border-field bg-canvas px-3 text-[15px] text-ink focus:border-brand-800 focus:ring-3 focus:ring-gold/35 focus:outline-none";

/** Champs de la fiche producteur, partagés par la création et la modification. */
function ProducerFields({ values, idPrefix }: { values?: Partial<ProducerValues>; idPrefix: string }) {
  const id = (name: string) => `${idPrefix}-${name}`;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={id("first")}>Prénom</Label>
          <Input id={id("first")} name="first_name" defaultValue={values?.firstName} autoComplete="off" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={id("last")}>Nom</Label>
          <Input id={id("last")} name="last_name" defaultValue={values?.lastName} autoComplete="off" required />
        </div>
      </div>

      <fieldset>
        <legend className="text-[13px] font-medium">Sexe</legend>
        <div className="mt-1.5 grid grid-cols-3 gap-2">
          {Object.entries(SEX_LABELS).map(([code, label]) => (
            <label
              key={code}
              className="flex h-10 cursor-pointer items-center justify-center rounded-lg border border-line text-[14px] font-medium hover:bg-surface has-[:checked]:border-brand-800 has-[:checked]:bg-brand-50 has-[:checked]:text-brand-800"
            >
              <input type="radio" name="sex" value={code} defaultChecked={values?.sex === code} className="sr-only" />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={id("year")}>Année de naissance</Label>
          <Input
            id={id("year")}
            name="birth_year"
            inputMode="numeric"
            placeholder="ex. 1985"
            maxLength={4}
            defaultValue={values?.birthYear}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={id("lang")}>Langue préférée</Label>
          <select id={id("lang")} name="preferred_language" defaultValue={values?.language ?? "fr"} className={SELECT}>
            {Object.entries(LANGUAGE_LABELS).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={id("locality")}>Village ou commune</Label>
        <Input id={id("locality")} name="locality_text" placeholder="ex. Guédé" defaultValue={values?.locality} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={id("phone")}>Téléphone</Label>
        <Input
          id={id("phone")}
          name="phone_number"
          type="tel"
          inputMode="tel"
          prefix="+221"
          placeholder="77 123 45 67"
          defaultValue={values?.phone}
        />
      </div>

      <div className="grid gap-3 border-t border-line pt-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={id("rel")}>Relation avec l&apos;organisation</Label>
          <select id={id("rel")} name="relationship_type" defaultValue={values?.relationship ?? "member"} className={SELECT}>
            {Object.entries(RELATIONSHIP_LABELS).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={id("num")}>N° d&apos;adhérent</Label>
          <Input id={id("num")} name="membership_number" placeholder="Facultatif" defaultValue={values?.membershipNumber} />
        </div>
      </div>
    </div>
  );
}

function HiddenValues({ values }: { values: ProducerValues }) {
  const fields: [string, string][] = [
    ["first_name", values.firstName],
    ["last_name", values.lastName],
    ["sex", values.sex],
    ["birth_year", values.birthYear],
    ["locality_text", values.locality],
    ["phone_number", values.phone],
    ["preferred_language", values.language],
    ["relationship_type", values.relationship],
    ["membership_number", values.membershipNumber],
  ];
  return (
    <>
      {fields.map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
    </>
  );
}

/** Doublons probables (D-28) : rattacher la fiche existante ou créer quand même. */
function Duplicates({
  state,
  onBack,
}: {
  state: Extract<CreateState, { status: "duplicates" }>;
  onBack: () => void;
}) {
  const [attachState, attach, attaching] = useActionState<SimpleState, FormData>(attachProducer, { status: "idle" });
  const [, create, creating] = useActionState<CreateState, FormData>(createProducer, { status: "idle" });
  return (
    <div>
      <div className="space-y-4 px-6 py-5">
        <Alert tone="info">
          Un producteur proche est déjà enregistré sur PEST AI. Vérifiez avant de créer une nouvelle fiche.
        </Alert>
        {attachState.status === "error" ? <Alert>{attachState.message}</Alert> : null}
        <ul className="space-y-2">
          {state.candidates.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line p-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-50 font-display text-[12px] font-bold text-brand-800">
                {producerInitials(c.display_name, c.display_name.split(" ").at(-1) ?? "")}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{c.display_name}</span>
                <span className="block text-[13px] text-muted">
                  {[c.locality, c.phone_hint].filter(Boolean).join(" · ") || "Localité non renseignée"}
                </span>
              </span>
              {c.in_organization ? (
                <Button asChild variant="secondary" size="sm">
                  <Link href={`/producteurs/${c.id}`}>Déjà dans votre registre</Link>
                </Button>
              ) : c.can_attach ? (
                <form action={attach}>
                  <input type="hidden" name="producer_id" value={c.id} />
                  <input type="hidden" name="relationship_type" value={state.values.relationship} />
                  <input type="hidden" name="membership_number" value={state.values.membershipNumber} />
                  <Button type="submit" size="sm" disabled={attaching}>
                    <Link2 aria-hidden />
                    Rattacher
                  </Button>
                </form>
              ) : (
                <span className="max-w-[180px] text-[12px] text-muted">Inscrit lui-même : son accord sera nécessaire.</span>
              )}
            </li>
          ))}
        </ul>
      </div>
      <form action={create} className="flex flex-wrap justify-between gap-2 border-t border-line bg-surface px-6 py-4">
        <HiddenValues values={state.values} />
        <input type="hidden" name="confirm_new" value="1" />
        <Button type="button" variant="ghost" onClick={onBack}>
          Retour
        </Button>
        <Button type="submit" variant="secondary" disabled={creating}>
          {creating ? "Création…" : "Personne différente : créer la fiche"}
        </Button>
      </form>
    </div>
  );
}

function CreateForm({ onDone }: { onDone: () => void }) {
  const [state, action, pending] = useActionState<CreateState, FormData>(createProducer, { status: "idle" });
  // « Retour » depuis les doublons : on revient au formulaire rempli, sans perdre la saisie.
  const [dismissed, setDismissed] = useState<CreateState | null>(null);

  if (state.status === "duplicates" && state !== dismissed) {
    return <Duplicates state={state} onBack={() => setDismissed(state)} />;
  }
  const values = state.status === "idle" ? undefined : state.values;
  return (
    <form action={action} key={state.status === "error" ? state.message : String(state.status)}>
      <div className="max-h-[65dvh] space-y-4 overflow-y-auto px-6 py-5">
        {state.status === "error" ? <Alert>{state.message}</Alert> : null}
        <ProducerFields values={values} idPrefix="new" />
      </div>
      <div className="flex justify-end gap-2 border-t border-line bg-surface px-6 py-4">
        <Button type="button" variant="secondary" onClick={onDone}>
          Annuler
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>
    </form>
  );
}

export function CreateProducerDialog({ label = "Enregistrer un producteur" }: { label?: string }) {
  const [open, setOpen] = useState(false);
  const [round, setRound] = useState(0);
  const close = () => {
    setOpen(false);
    setRound((r) => r + 1);
  };
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <UserPlus aria-hidden />
        {label}
      </Button>
      <Modal
        open={open}
        onClose={close}
        title="Nouveau producteur"
        description="Sa fiche est rattachée à votre organisation."
        className="max-w-xl"
      >
        <CreateForm key={round} onDone={close} />
      </Modal>
    </>
  );
}

export function EditProducerDialog({ producerId, values }: { producerId: string; values: ProducerValues }) {
  const [open, setOpen] = useState(false);
  const [round, setRound] = useState(0);
  const close = () => {
    setOpen(false);
    setRound((r) => r + 1);
  };
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Pencil aria-hidden />
        Modifier
      </Button>
      <Modal open={open} onClose={close} title="Modifier la fiche" className="max-w-xl">
        <EditForm key={round} producerId={producerId} values={values} onDone={close} />
      </Modal>
    </>
  );
}

function EditForm({ producerId, values, onDone }: { producerId: string; values: ProducerValues; onDone: () => void }) {
  const [state, action, pending] = useActionState<CreateState, FormData>(
    async (prev, form) => {
      const next = await updateProducer(prev, form);
      if (next.status === "idle") onDone();
      return next;
    },
    { status: "idle" },
  );
  const current = state.status === "error" ? state.values : values;
  return (
    <form action={action} key={state.status === "error" ? state.message : "edit"}>
      <input type="hidden" name="producer_id" value={producerId} />
      <div className="max-h-[65dvh] space-y-4 overflow-y-auto px-6 py-5">
        {state.status === "error" ? <Alert>{state.message}</Alert> : null}
        <ProducerFields values={current} idPrefix="edit" />
      </div>
      <div className="flex justify-end gap-2 border-t border-line bg-surface px-6 py-4">
        <Button type="button" variant="secondary" onClick={onDone}>
          Annuler
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>
    </form>
  );
}

export function DetachProducerDialog({ producerId, name, organization }: { producerId: string; name: string; organization: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<SimpleState, FormData>(detachProducer, { status: "idle" });
  return (
    <>
      <Button variant="ghost" className="text-danger hover:bg-danger-bg" onClick={() => setOpen(true)}>
        <UserMinus aria-hidden />
        Retirer du registre
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Retirer ${name} ?`}>
        <form action={action}>
          <input type="hidden" name="producer_id" value={producerId} />
          <div className="space-y-3 px-6 py-5 text-[14px]">
            {state.status === "error" ? <Alert>{state.message}</Alert> : null}
            <p>
              {name} ne sera plus suivi par {organization}. Sa fiche et l&apos;historique du rattachement sont conservés ;
              vous pourrez le rattacher de nouveau plus tard.
            </p>
          </div>
          <div className="flex justify-end gap-2 border-t border-line bg-surface px-6 py-4">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" variant="danger" disabled={pending}>
              Retirer
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

/** État vide du registre : invite à enregistrer le premier producteur. */
export function EmptyRegistry({ canCreate }: { canCreate: boolean }) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-brand-50 text-brand-700">
        <Sprout className="size-7" aria-hidden />
      </span>
      <p className="mt-4 font-display text-[17px] font-bold">Aucun producteur pour le moment</p>
      <p className="mt-1 max-w-xs text-[14px] text-muted">
        Enregistrez les producteurs de votre organisation pour suivre leurs parcelles.
      </p>
      {canCreate ? (
        <div className="mt-5">
          <CreateProducerDialog label="Enregistrer le premier producteur" />
        </div>
      ) : null}
    </div>
  );
}
