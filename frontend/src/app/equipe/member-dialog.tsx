"use client";

import { KeyRound, Lock } from "lucide-react";
import { useActionState, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { formatPhone } from "@/lib/phone";
import { ASSIGNABLE_ROLES } from "@/lib/roles";

import { ActivationCodePanel } from "./activation-code";
import { type ActionState, memberStatus, newActivationCode, toggleRole } from "./actions";

export type TeamMember = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  roles: string[];
  status: "invited" | "active" | "suspended" | "revoked";
  accountActivated: boolean;
};

const IDLE: ActionState = { status: "idle" };

function RolesSection({ member, isAdmin, readOnly }: { member: TeamMember; isAdmin: boolean; readOnly: boolean }) {
  const [state, action, pending] = useActionState(toggleRole, IDLE);
  return (
    <section>
      <h3 className="text-[13px] font-medium">Rôles</h3>
      {state.status === "error" ? <Alert className="mt-2">{state.message}</Alert> : null}
      <ul className="mt-2 divide-y divide-line rounded-lg border border-line">
        {ASSIGNABLE_ROLES.map((role) => {
          const has = member.roles.includes(role.code);
          const locked = readOnly || (role.adminOnly && !isAdmin);
          return (
            <li key={role.code} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <span>
                <span className="block text-[14px] font-medium">{role.label}</span>
                <span className="block text-[12px] text-muted">{role.description}</span>
              </span>
              {locked ? (
                <span className="inline-flex items-center gap-1 text-[12px] text-muted">
                  {has ? "Attribué" : ""}
                  <Lock className="size-3.5" aria-label="Non modifiable" />
                </span>
              ) : (
                <form action={action}>
                  <input type="hidden" name="membership_id" value={member.id} />
                  <input type="hidden" name="role" value={role.code} />
                  <input type="hidden" name="add" value={has ? "0" : "1"} />
                  <Button type="submit" size="sm" variant={has ? "secondary" : "ghost"} disabled={pending}>
                    {has ? "Retirer" : "Attribuer"}
                  </Button>
                </form>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function StatusSection({ member }: { member: TeamMember }) {
  const [state, action, pending] = useActionState(memberStatus, IDLE);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  return (
    <section>
      <h3 className="text-[13px] font-medium">Accès</h3>
      {state.status === "error" ? <Alert className="mt-2">{state.message}</Alert> : null}
      <form action={action} className="mt-2 flex flex-wrap gap-2">
        <input type="hidden" name="membership_id" value={member.id} />
        {member.status === "active" ? (
          <Button type="submit" name="action" value="suspend" variant="secondary" size="sm" disabled={pending}>
            Suspendre l&apos;accès
          </Button>
        ) : null}
        {member.status === "suspended" ? (
          <Button type="submit" name="action" value="reactivate" variant="secondary" size="sm" disabled={pending}>
            Réactiver l&apos;accès
          </Button>
        ) : null}
        {confirmRevoke ? (
          <span className="flex flex-wrap items-center gap-2 rounded-lg bg-danger-bg px-3 py-2 text-[13px] text-danger">
            Retirer définitivement cette personne de l&apos;organisation ?
            <Button type="submit" name="action" value="revoke" variant="danger" size="sm" disabled={pending}>
              Confirmer
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmRevoke(false)}>
              Annuler
            </Button>
          </span>
        ) : (
          <Button type="button" variant="ghost" size="sm" className="text-danger" onClick={() => setConfirmRevoke(true)}>
            {member.status === "invited" ? "Annuler l'invitation" : "Retirer de l'organisation"}
          </Button>
        )}
      </form>
      <p className="mt-2 text-[12px] text-muted">
        Suspendre bloque l&apos;accès sans rien effacer. Retirer clôt l&apos;adhésion ; l&apos;historique est conservé.
      </p>
    </section>
  );
}

function CodeSection({ member, organization }: { member: TeamMember; organization: string }) {
  const [state, action, pending] = useActionState(newActivationCode, IDLE);
  return (
    <section>
      <h3 className="text-[13px] font-medium">Compte à activer</h3>
      <p className="mt-1 text-[13px] text-muted">
        Cette personne n&apos;a pas encore choisi son mot de passe. Si elle a perdu son code ou s&apos;il a expiré,
        générez-en un nouveau (l&apos;ancien ne fonctionnera plus).
      </p>
      {state.status === "error" ? <Alert className="mt-2">{state.message}</Alert> : null}
      {state.status === "ok" && state.code ? (
        <div className="mt-3">
          <ActivationCodePanel code={state.code} firstName={member.firstName} phone={member.phone} organization={organization} />
        </div>
      ) : (
        <form action={action} className="mt-2">
          <input type="hidden" name="membership_id" value={member.id} />
          <Button type="submit" variant="secondary" size="sm" disabled={pending}>
            <KeyRound aria-hidden />
            Générer un nouveau code
          </Button>
        </form>
      )}
    </section>
  );
}

export function MemberDialog({
  member,
  isAdmin,
  isSelf,
  organization,
}: {
  member: TeamMember;
  isAdmin: boolean;
  isSelf: boolean;
  organization: string;
}) {
  const [open, setOpen] = useState(false);
  const [round, setRound] = useState(0);
  const targetIsAdmin = member.roles.includes("organization_admin");
  const readOnly = (targetIsAdmin && !isAdmin) || member.status === "revoked";
  const close = () => {
    setOpen(false);
    setRound((r) => r + 1);
  };

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        Gérer
      </Button>
      <Modal
        open={open}
        onClose={close}
        title={`${member.firstName} ${member.lastName}`}
        description={formatPhone(member.phone)}
      >
        <div key={round} className="max-h-[70vh] space-y-6 overflow-y-auto px-6 py-5">
          {readOnly && member.status !== "revoked" ? (
            <Alert tone="info">Seul un administrateur d&apos;organisation peut modifier un administrateur.</Alert>
          ) : null}
          {isSelf ? <Alert tone="info">C&apos;est votre propre accès : vous ne pouvez pas modifier vos propres rôles ni votre accès.</Alert> : null}
          <RolesSection member={member} isAdmin={isAdmin} readOnly={readOnly || isSelf} />
          {!member.accountActivated && !readOnly ? <CodeSection member={member} organization={organization} /> : null}
          {!readOnly && !isSelf ? <StatusSection member={member} /> : null}
        </div>
        <div className="flex justify-end border-t border-line bg-surface px-6 py-4">
          <Button type="button" variant="secondary" onClick={close}>
            Fermer
          </Button>
        </div>
      </Modal>
    </>
  );
}
