"use client";

import { CircleCheck, Plus, UserCog } from "lucide-react";
import { useActionState, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PhoneField } from "@/components/phone-field";
import { toInternationalPhone } from "@/lib/phone";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { ORGANIZATION_TYPE_LABELS } from "@/lib/spaces";

import { ActivationCodePanel } from "@/app/equipe/activation-code";

import { type AdminResult, type DesignateState, type OrgFormState, createOrganization, designateAdmin } from "./actions";

const SELECT =
  "h-11 w-full rounded-lg border border-field bg-canvas px-3 text-[15px] text-ink focus:border-brand-800 focus:outline-none focus:ring-3 focus:ring-gold/35";

function AdminFields({ values }: { values?: Record<string, string> }) {
  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor="admin_phone">Numéro de téléphone</Label>
        <PhoneField id="admin_phone" name="admin_phone" countryName="admin_phone_country" defaultValue={values?.admin_phone ? toInternationalPhone(values.admin_phone, values.admin_phone_country || "SN") : undefined} autoComplete="off" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="admin_first_name">Prénom</Label>
          <Input id="admin_first_name" name="admin_first_name" autoComplete="off" defaultValue={values?.admin_first_name} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="admin_last_name">Nom</Label>
          <Input id="admin_last_name" name="admin_last_name" autoComplete="off" defaultValue={values?.admin_last_name} />
        </div>
      </div>
      <p className="-mt-2 text-[12px] text-muted">
        Prénom et nom sont nécessaires si la personne n&apos;a pas encore de compte. Votre propre numéro fonctionne
        aussi.
      </p>
    </>
  );
}

function AdminOutcome({ admin, organization }: { admin: AdminResult; organization: string }) {
  return (
    <div className="space-y-3">
      <p className="text-[13px] text-muted">
        <span className="font-medium text-ink">{admin.name}</span> est invité comme administrateur.{" "}
        {admin.code
          ? "Il doit activer son compte avec ce code, se connecter, puis accepter l'invitation."
          : "Il voit l'invitation à sa prochaine connexion, sur la page de choix de l'espace."}
      </p>
      {admin.code ? (
        <ActivationCodePanel code={admin.code} firstName={admin.name.split(" ")[0] ?? ""} phone={admin.phone} organization={organization} />
      ) : null}
    </div>
  );
}

function CreateForm({ onDone }: { onDone: () => void }) {
  const [state, action, pending] = useActionState<OrgFormState, FormData>(createOrganization, { status: "idle" });

  if (state.status === "done") {
    return (
      <div className="space-y-4 px-6 py-5">
        <div className="flex items-start gap-3">
          <CircleCheck className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
          <p className="font-medium">« {state.organization} » est créée.</p>
        </div>
        {state.adminError ? <Alert>Administrateur non désigné : {state.adminError}</Alert> : null}
        {state.admin ? <AdminOutcome admin={state.admin} organization={state.organization} /> : null}
        <div className="flex justify-end">
          <Button type="button" onClick={onDone}>
            Terminé
          </Button>
        </div>
      </div>
    );
  }

  const v = state.status === "error" ? state.values : undefined;
  return (
    <form action={action} key={state.status === "error" ? state.message : "vierge"}>
      <div className="max-h-[65vh] space-y-4 overflow-y-auto px-6 py-5">
        {state.status === "error" ? <Alert>{state.message}</Alert> : null}
        <div className="space-y-1.5">
          <Label htmlFor="name">Nom de l&apos;organisation</Label>
          <Input id="name" name="name" placeholder="Coopérative agricole de Ross Béthio" defaultValue={v?.name} required />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="short_name">Nom court (facultatif)</Label>
            <Input id="short_name" name="short_name" placeholder="Ross Béthio" defaultValue={v?.short_name} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="organization_type">Type</Label>
            <select id="organization_type" name="organization_type" defaultValue={v?.organization_type || "cooperative"} className={SELECT}>
              {Object.entries(ORGANIZATION_TYPE_LABELS)
                .filter(([k]) => k !== "pest_ai")
                .map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
            </select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="member_number_prefix">Préfixe des numéros d&apos;adhérent (facultatif)</Label>
          <Input
            id="member_number_prefix"
            name="member_number_prefix"
            placeholder="ex. CARB — sinon déduit du nom court"
            maxLength={12}
            className="font-mono uppercase"
            defaultValue={v?.member_number_prefix}
          />
          <p className="text-[12px] text-muted">Numéros proposés aux agents : PRÉFIXE-000001, PRÉFIXE-000002…</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="status">Statut</Label>
          <select id="status" name="status" defaultValue={v?.status || "active"} className={SELECT}>
            <option value="active">Active : ses membres peuvent se connecter</option>
            <option value="pending">En attente : à activer plus tard</option>
          </select>
        </div>
        <fieldset className="space-y-4 rounded-lg border border-line p-4">
          <legend className="px-1 text-[13px] font-medium">Administrateur (facultatif)</legend>
          <AdminFields values={v} />
        </fieldset>
      </div>
      <div className="flex justify-end gap-2 border-t border-line bg-surface px-6 py-4">
        <Button type="button" variant="secondary" onClick={onDone}>
          Annuler
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Création…" : "Créer l'organisation"}
        </Button>
      </div>
    </form>
  );
}

export function CreateOrganizationDialog() {
  const [open, setOpen] = useState(false);
  const [round, setRound] = useState(0);
  const close = () => {
    setOpen(false);
    setRound((r) => r + 1);
  };
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus aria-hidden />
        Nouvelle organisation
      </Button>
      <Modal open={open} onClose={close} title="Nouvelle organisation" description="Coopérative, ONG ou programme inscrit sur PEST AI OS.">
        <CreateForm key={round} onDone={close} />
      </Modal>
    </>
  );
}

function DesignateForm({ organizationId, organization, onDone }: { organizationId: string; organization: string; onDone: () => void }) {
  const [state, action, pending] = useActionState<DesignateState, FormData>(designateAdmin, { status: "idle" });
  if (state.status === "done") {
    return (
      <div className="space-y-4 px-6 py-5">
        <AdminOutcome admin={state.admin} organization={organization} />
        <div className="flex justify-end">
          <Button type="button" onClick={onDone}>
            Terminé
          </Button>
        </div>
      </div>
    );
  }
  const v = state.status === "error" ? state.values : undefined;
  return (
    <form action={action} key={state.status === "error" ? state.message : "vierge"}>
      <input type="hidden" name="organization_id" value={organizationId} />
      <div className="space-y-4 px-6 py-5">
        {state.status === "error" ? <Alert>{state.message}</Alert> : null}
        <AdminFields values={v} />
      </div>
      <div className="flex justify-end gap-2 border-t border-line bg-surface px-6 py-4">
        <Button type="button" variant="secondary" onClick={onDone}>
          Annuler
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Envoi…" : "Désigner l'administrateur"}
        </Button>
      </div>
    </form>
  );
}

export function DesignateAdminDialog({ organizationId, organization }: { organizationId: string; organization: string }) {
  const [open, setOpen] = useState(false);
  const [round, setRound] = useState(0);
  const close = () => {
    setOpen(false);
    setRound((r) => r + 1);
  };
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)} title="Ajouter un administrateur">
        <UserCog aria-hidden />
        Administrateur
      </Button>
      <Modal open={open} onClose={close} title="Ajouter un administrateur" description={organization}>
        <DesignateForm key={round} organizationId={organizationId} organization={organization} onDone={close} />
      </Modal>
    </>
  );
}
