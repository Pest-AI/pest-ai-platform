import type { Metadata } from "next";

import { Brand } from "@/components/brand";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const metadata: Metadata = { title: "Connexion" };

const ERRORS: Record<string, string> = {
  identifiants: "Numéro de téléphone ou mot de passe incorrect.",
  champs: "Renseignez votre numéro et votre mot de passe.",
  serveur: "Le serveur ne répond pas. Réessayez dans un instant.",
  session: "Votre session a expiré. Reconnectez-vous.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string; deconnecte?: string }>;
}) {
  const { erreur, deconnecte } = await searchParams;
  const error = erreur ? (ERRORS[erreur] ?? ERRORS.serveur) : null;

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-forest p-12 text-white lg:flex">
        <Brand inverted />
        <div>
          <p className="text-3xl font-bold leading-tight">
            L&apos;intelligence agricole au service des petits producteurs.
          </p>
          <p className="mt-4 text-white/80">Coopératives, agronomes, ONG : un seul espace de travail.</p>
        </div>
        <div className="h-1 w-24 rounded bg-sun" />
      </section>

      <section className="flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <div className="mb-6 lg:hidden">
            <Brand />
          </div>
          <h1 className="text-2xl font-bold text-forest">Connexion</h1>
          <p className="mt-1 text-sm text-muted">Accédez à votre espace PEST AI OS.</p>

          <div className="mt-6 space-y-4">
            {error ? <Alert>{error}</Alert> : null}
            {deconnecte ? <Alert tone="info">Vous êtes déconnecté.</Alert> : null}
          </div>

          <form action="/api/session/login" method="post" className="mt-6 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="phone_number">Numéro de téléphone</Label>
              <Input
                id="phone_number"
                name="phone_number"
                type="tel"
                inputMode="tel"
                autoComplete="username"
                placeholder="+221 77 123 45 67"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input id="password" name="password" type="password" autoComplete="current-password" required />
            </div>
            <Button type="submit" size="lg" className="w-full">
              Se connecter
            </Button>
          </form>
        </Card>
      </section>
    </main>
  );
}
