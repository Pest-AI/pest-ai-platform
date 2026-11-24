"use client";

import { CircleCheck, Plus } from "lucide-react";
import { useActionState, useState } from "react";

import { ActivationCodePanel } from "@/app/equipe/activation-code";
import { PhoneField } from "@/components/phone-field";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { toInternationalPhone } from "@/lib/phone";
import { TERRAIN_URL } from "@/lib/spaces";

import { type AgentActionState, type AgentFormState, agentAction, createAgent } from "./actions";

const SELECT =
  "h-11 w-full rounded-lg border border-field bg-canvas px-3 text-[15px] text-ink focus:border-brand-800 focus:outline-none focus:ring-3 focus:ring-gold/35";

export type OrganizationOption = { id: string; name: string };

/** Message d'activation envoyé à l'agent (WhatsApp ou copie). Le lien préremplit son numéro. */
export function agentMessage(firstName: string, organization: string, phone: string, code: string) {
  const link = `${TERRAIN_URL}/activer?tel=${encodeURIComponent(phone)}`;
  return (
    `Bonjour ${firstName}, PEST AI vous a créé un compte d'agent terrain pour ${organization}. ` +
    `Ouvrez ${link}, saisissez le code ${code} (valable 7 jours), puis choisissez votre mot de passe.`
  );
}

function CreateForm({ organizations, onDone }: { organizations: OrganizationOption[]; onDone: () => void }) {
  const [state, action, pending] = useActionState<AgentFormState, FormData>(createAgent, { status: "idle" });

  if (state.status === "done") {
    const { agent } = state;
    return (
      <div className="space-y-4 px-6 py-5">
        <div className="flex items-start gap-3">
          <CircleCheck className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
          <p>
            <span className="font-medium">{agent.name}</span> est affecté à {agent.organization}.{" "}
            {agent.code
              ? "Transmettez-lui ce code : il active son compte dans l'application terrain, puis accepte l'affectation."
              : "Son compte est déjà actif : il voit l'affectation à sa prochaine connexion dans l'application terrain."}
          </p>
        </div>
        {agent.code ? (
          <ActivationCodePanel
            code={agent.code}
            firstName={agent.firstName}
            phone={agent.phone}
            organization={agent.organization}
            message={agentMessage(agent.firstName, agent.organization, agent.phone, agent.code)}
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

  const v = state.status === "error" ? state.values : undefined;
  return (
    <form action={action} key={state.status === "error" ? state.message : "vierge"}>
      <div className="max-h-[65vh] space-y-4 overflow-y-auto px-6 py-5">
        {state.status === "error" ? <Alert>{state.message}</Alert> : null}
        <div className="space-y-1.5">
          <Label htmlFor="organization">Coopérative d&apos;affectation</Label>
          <select id="organization" name="organization" defaultValue={v?.organization ?? ""} className={SELECT} required>
            <option value="" disabled>
              Choisir…
            </option>
            {organizations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone_number">Numéro de téléphone</Label>
          <PhoneField
            id="phone_number"
            defaultValue={v?.phone_number ? toInternationalPhone(v.phone_number, v.phone_country || "SN") : undefined}
            autoComplete="off"
            required
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="first_name">Prénom</Label>
            <Input id="first_name" name="first_name" autoComplete="off" defaultValue={v?.first_name} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="last_name">Nom</Label>
            <Input id="last_name" name="last_name" autoComplete="off" defaultValue={v?.last_name} />
          </div>
        </div>
        <p className="-mt-2 text-[12px] text-muted">
          Prénom et nom sont nécessaires si la personne n&apos;a pas encore de compte. Un agent déjà actif peut être
          affecté à une autre coopérative avec le même numéro.
        </p>
      </div>
      <div className="flex justify-end gap-2 border-t border-line bg-surface px-6 py-4">
        <Button type="button" variant="secondary" onClick={onDone}>
          Annuler
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Création…" : "Créer et affecter"}
        </Button>
      </div>
    </form>
  );
}

export function NewAgentDialog({ organizations }: { organizations: OrganizationOption[] }) {
  const [open, setOpen] = useState(false);
  const [round, setRound] = useState(0);
  const close = () => {
    setOpen(false);
    setRound((r) => r + 1);
  };
  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={organizations.length === 0}>
        <Plus aria-hidden />
        Nouvel agent
      </Button>
      <Modal open={open} onClose={close} title="Nouvel agent terrain" description="Créé par PEST AI et affecté à une coopérative.">
        <CreateForm key={round} organizations={organizations} onDone={close} />
      </Modal>
    </>
  );
}

export type AgentRow = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  status: string;
  organization: string;
  accountActivated: boolean;
};

function Manage({ agent, onDone }: { agent: AgentRow; onDone: () => void }) {
  const [state, action, pending] = useActionState<AgentActionState, FormData>(agentAction, { status: "idle" });
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const op = (name: string, label: string, variant: "secondary" | "danger" = "secondary") => (
    <form action={action}>
      <input type="hidden" name="membership_id" value={agent.id} />
      <input type="hidden" name="op" value={name} />
      <Button type="submit" variant={variant} size="sm" disabled={pending}>
        {label}
      </Button>
    </form>
  );

  return (
    <div className="space-y-5 px-6 py-5">
      {state.status === "error" ? <Alert>{state.message}</Alert> : null}
      {state.status === "code" ? (
        <ActivationCodePanel
          code={state.code}
          firstName={agent.firstName}
          phone={agent.phone}
          organization={agent.organization}
          message={agentMessage(agent.firstName, agent.organization, agent.phone, state.code)}
        />
      ) : null}
      <div className="space-y-2">
        <p className="text-[13px] font-semibold">Accès</p>
        <div className="flex flex-wrap gap-2">
          {!agent.accountActivated && state.status !== "code" ? op("code", "Nouveau code d'activation") : null}
          {agent.status === "active" ? op("suspend", "Suspendre") : null}
          {agent.status === "suspended" ? op("reactivate", "Réactiver") : null}
        </div>
      </div>
      <div className="space-y-2 rounded-lg border border-line p-4">
        <p className="text-[13px] font-semibold">Retirer de {agent.organization}</p>
        <p className="text-[13px] text-muted">
          L&apos;agent n&apos;a plus accès aux données de cette coopérative. Son compte et ses autres affectations sont
          conservés ; l&apos;historique reste consultable.
        </p>
        {confirmRevoke ? (
          <div className="flex flex-wrap gap-2">
            {op("revoke", "Confirmer le retrait", "danger")}
            <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmRevoke(false)}>
              Annuler
            </Button>
          </div>
        ) : (
          <Button type="button" variant="secondary" size="sm" onClick={() => setConfirmRevoke(true)}>
            Retirer l&apos;agent
          </Button>
        )}
      </div>
      <div className="flex justify-end">
        <Button type="button" variant="secondary" onClick={onDone}>
          Fermer
        </Button>
      </div>
    </div>
  );
}

export function ManageAgentDialog({ agent }: { agent: AgentRow }) {
  const [open, setOpen] = useState(false);
  const [round, setRound] = useState(0);
  const close = () => {
    setOpen(false);
    setRound((r) => r + 1);
  };
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        Gérer
      </Button>
      <Modal open={open} onClose={close} title={`${agent.firstName} ${agent.lastName}`} description={agent.organization}>
        <Manage key={round} agent={agent} onDone={close} />
      </Modal>
    </>
  );
}
