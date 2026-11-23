"use client";

import { useActionState } from "react";

import { PasswordInput } from "@/components/password-input";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { type ActivationState, activateAccount } from "./actions";

export function ActivationForm() {
  const [state, action, pending] = useActionState<ActivationState, FormData>(activateAccount, { message: null });
  return (
    <form action={action} className="mt-7 space-y-5" key={`${state.phone}-${state.code}-${state.message}`}>
      {state.message ? <Alert>{state.message}</Alert> : null}
      <div className="space-y-1.5">
        <Label htmlFor="phone_number">Numéro de téléphone</Label>
        <Input id="phone_number" name="phone_number" defaultValue={state.phone} type="tel" inputMode="tel" autoComplete="username" prefix="+221" placeholder="77 123 45 67" className="h-[52px] rounded-xl" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="code">Code d&apos;activation</Label>
        <Input
          id="code"
          name="code"
          defaultValue={state.code}
          autoComplete="one-time-code"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="ABCD-EF12"
          className="h-[52px] rounded-xl font-mono tracking-[0.12em] uppercase"
          aria-describedby="code-hint"
          required
        />
        <p id="code-hint" className="text-[12px] text-muted">
          Reçu de votre organisation, valable 7 jours.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Choisissez un mot de passe</Label>
        <PasswordInput id="password" name="password" autoComplete="new-password" aria-describedby="password-hint" className="h-[52px] rounded-xl" required />
        <p id="password-hint" className="text-[12px] text-muted">
          8 caractères minimum, pas uniquement des chiffres.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password_confirm">Confirmez le mot de passe</Label>
        <PasswordInput id="password_confirm" name="password_confirm" autoComplete="new-password" className="h-[52px] rounded-xl" required />
      </div>
      <Button type="submit" size="lg" className="h-[52px] rounded-xl w-full" disabled={pending}>
        {pending ? "Activation…" : "Activer mon compte"}
      </Button>
    </form>
  );
}
