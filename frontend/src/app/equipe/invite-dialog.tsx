"use client";

import { CircleCheck, UserPlus } from "lucide-react";
import { useActionState, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PhoneField } from "@/components/phone-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { ASSIGNABLE_ROLES } from "@/lib/roles";

import { ActivationCodePanel } from "./activation-code";
import { type InviteState, inviteMember } from "./actions";

function InviteForm({ isAdmin, organization, onDone }: { isAdmin: boolean; organization: string; onDone: () => void }) {
  const [state, action, pending] = useActionState<InviteState, FormData>(inviteMember, { status: "idle" });

  if (state.status === "done") {
    return (
      <div className="space-y-4 px-6 py-5">
        <div className="flex items-start gap-3">
          <CircleCheck className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
          <div>
            <p className="font-medium">Invitation envoyée à {state.name}</p>
            <p className="text-[13px] text-muted">
              {state.code
                ? "Cette personne n'a pas encore de compte : elle doit l'activer avec le code ci-dessous, puis accepter l'invitation."
                : "Cette personne a déjà un compte : elle verra l'invitation à sa prochaine connexion et pourra l'accepter."}
            </p>
          </div>
        </div>
        {state.code ? (
          <ActivationCodePanel
            code={state.code}
            firstName={state.name.split(" ")[0] ?? ""}
            phone={state.phone}
            organization={organization}
          />
        ) : null}
        <div className="flex justify-end">
          <Button type="button" onClick={onDone}>
            Terminé
          </Button>
        </div>
      </div>
    );
  }

  const values = state.status === "error" ? state.values : undefined;
  return (
    <form action={action} key={state.status === "error" ? state.message : "vierge"}>
      <div className="space-y-4 px-6 py-5">
        {state.status === "error" ? <Alert>{state.message}</Alert> : null}
        <div className="space-y-1.5">
          <Label htmlFor="invite-phone">Numéro de téléphone</Label>
          <PhoneField id="invite-phone" defaultValue={values?.phone} autoComplete="off" required />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="invite-first">Prénom</Label>
            <Input id="invite-first" name="first_name" autoComplete="off" defaultValue={values?.firstName} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invite-last">Nom</Label>
            <Input id="invite-last" name="last_name" autoComplete="off" defaultValue={values?.lastName} />
          </div>
        </div>
        <p className="-mt-2 text-[12px] text-muted">Prénom et nom sont nécessaires si la personne n&apos;a pas encore de compte.</p>
        <fieldset>
          <legend className="text-[13px] font-medium">Rôles</legend>
          <div className="mt-2 space-y-1.5">
            {ASSIGNABLE_ROLES.filter((r) => isAdmin || !r.adminOnly).map((role) => (
              <label
                key={role.code}
                className="flex cursor-pointer items-start gap-3 rounded-lg border border-line px-3 py-2.5 hover:bg-surface has-[:checked]:border-brand-800 has-[:checked]:bg-brand-50"
              >
                <input
                  type="checkbox"
                  name="roles"
                  value={role.code}
                  defaultChecked={values?.roles.includes(role.code)}
                  className="mt-0.5 size-4 accent-brand-800"
                />
                <span>
                  <span className="block text-[14px] font-medium">{role.label}</span>
                  <span className="block text-[12px] text-muted">{role.description}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>
      <div className="flex justify-end gap-2 border-t border-line bg-surface px-6 py-4">
        <Button type="button" variant="secondary" onClick={onDone}>
          Annuler
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Envoi…" : "Envoyer l'invitation"}
        </Button>
      </div>
    </form>
  );
}

export function InviteDialog({ isAdmin, organization }: { isAdmin: boolean; organization: string }) {
  const [open, setOpen] = useState(false);
  const [round, setRound] = useState(0);
  const close = () => {
    setOpen(false);
    setRound((r) => r + 1); // formulaire vierge à la prochaine ouverture
  };
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <UserPlus aria-hidden />
        Inviter un membre
      </Button>
      <Modal
        open={open}
        onClose={close}
        title="Inviter un membre"
        description="La personne rejoint l'organisation après avoir accepté l'invitation."
      >
        <InviteForm key={round} isAdmin={isAdmin} organization={organization} onDone={close} />
      </Modal>
    </>
  );
}
