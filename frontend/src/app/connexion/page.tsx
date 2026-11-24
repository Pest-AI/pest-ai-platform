import { ChevronRight, Lock, Mail, Phone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { AuthLayout } from "@/components/auth-layout";
import { PasswordInput } from "@/components/password-input";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const metadata: Metadata = { title: "Connexion" };

const ERRORS: Record<string, string> = {
  identifiants: "Numéro de téléphone ou mot de passe incorrect.",
  champs: "Renseignez votre numéro et votre mot de passe.",
  tentatives: "Trop de tentatives. Patientez une minute avant de réessayer.",
  serveur: "Le serveur ne répond pas. Réessayez dans un instant.",
  session: "Votre session a expiré. Reconnectez-vous.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string; deconnecte?: string; active?: string }>;
}) {
  const { erreur, deconnecte, active } = await searchParams;
  const error = erreur ? (ERRORS[erreur] ?? ERRORS.serveur) : null;

  return (
    <AuthLayout>
      <div className="text-center">
        <h1 className="text-[28px] leading-9 font-bold sm:text-[34px] sm:leading-10">Connexion</h1>
        <p className="mt-1.5 text-[15px] text-muted">Accédez à votre espace PEST AI OS</p>
      </div>

      <div className="mt-6 space-y-3 empty:hidden">
        {error ? <Alert>{error}</Alert> : null}
        {deconnecte ? <Alert tone="info">Vous êtes déconnecté.</Alert> : null}
        {active ? <Alert tone="info">Compte activé. Connectez-vous avec votre nouveau mot de passe.</Alert> : null}
      </div>

      <form action="/api/session/login" method="post" className="mt-7 space-y-4">
        <div>
          <Label htmlFor="phone_number" className="sr-only">
            Numéro de téléphone (+221)
          </Label>
          <Input
            id="phone_number"
            name="phone_number"
            type="tel"
            inputMode="tel"
            autoComplete="username"
            placeholder="Numéro de téléphone"
            icon={
              <span className="flex items-center gap-2">
                <Phone />
                <span className="text-[15px] font-medium text-ink">+221</span>
              </span>
            }
            title="Numéro étranger : saisissez-le avec son indicatif, par exemple +33…"
            className="h-[52px] rounded-xl border-line-strong"
            required
          />
        </div>
        <div>
          <Label htmlFor="password" className="sr-only">
            Mot de passe
          </Label>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="current-password"
            placeholder="Mot de passe"
            icon={<Lock />}
            className="h-[52px] rounded-xl border-line-strong"
            required
          />
        </div>
        <Button type="submit" size="lg" className="h-[52px] w-full rounded-xl text-[16px]">
          Se connecter
          <ChevronRight aria-hidden />
        </Button>
      </form>

      <div className="my-6 flex items-center gap-4 text-[13px] text-muted" aria-hidden>
        <span className="h-px flex-1 bg-line" />
        ou
        <span className="h-px flex-1 bg-line" />
      </div>

      <Link
        href="/activer"
        className="group flex gap-3.5 rounded-xl border-l-4 border-leaf bg-brand-50 px-4 py-4 transition-colors hover:bg-brand-100"
      >
        <Mail className="mt-0.5 size-6 shrink-0 text-brand-700" aria-hidden />
        <span>
          <span className="block text-[15px] font-semibold text-ink">Vous avez reçu un code d&apos;invitation&nbsp;?</span>
          <span className="mt-0.5 block text-[13px] leading-5 text-muted">
            Activez votre compte avec le code transmis par votre organisation ou coopérative.
          </span>
        </span>
      </Link>
    </AuthLayout>
  );
}
