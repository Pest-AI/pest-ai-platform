import { BadgeCheck, Globe, Lock, Users } from "lucide-react";
import type { Metadata } from "next";

import { AgroIdBadge } from "@/components/agroid-badge";
import { Logo } from "@/components/logo";
import { PasswordInput } from "@/components/password-input";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const metadata: Metadata = { title: "Connexion" };

const ERRORS: Record<string, string> = {
  identifiants: "Numéro de téléphone ou mot de passe incorrect.",
  champs: "Renseignez votre numéro et votre mot de passe.",
  serveur: "Le serveur ne répond pas. Réessayez dans un instant.",
  session: "Votre session a expiré. Reconnectez-vous.",
};

const PILLARS = [
  { title: "Identifier", text: "Un AgroID unique par parcelle, relevé au GPS." },
  { title: "Suivre", text: "Campagnes, opérations et récoltes horodatées." },
  { title: "Protéger", text: "Données partagées avec consentement uniquement." },
];

/** Illustration : à quoi ressemble une fiche d'identité de parcelle. */
function IdentityCardIllustration() {
  const rows = [
    ["Exploitant", "Mamadou Ba"],
    ["Culture", "Riz · hivernage 2026"],
    ["Surface", "2,4 ha"],
    ["Historique", "3 campagnes, 41 événements"],
  ];
  return (
    <div
      aria-hidden
      className="w-80 max-w-full rotate-[1.5deg] rounded-xl bg-white p-4 text-ink shadow-[0_24px_60px_-12px_rgba(0,0,0,0.45)]"
    >
      <div className="flex items-center justify-between gap-2">
        <AgroIdBadge code="PAI-SN-4F7K2Q9M" />
        <span className="inline-flex items-center gap-1 text-[12px] font-medium text-success">
          <BadgeCheck className="size-3.5" />
          Vérifiée
        </span>
      </div>
      <svg viewBox="0 0 280 120" className="mt-3 h-28 w-full rounded-lg" role="presentation">
        <rect width="280" height="120" fill="#c3c9b6" />
        <path d="M0 10c50-8 95 8 140-2s90-8 140-2V0H0Z" fill="#9fb1b3" />
        <path d="m8 22 60-2 2 38-60 3Z" fill="#b4bea2" />
        <path d="m10 70 62-3 2 44-62 3Z" fill="#a9b495" />
        <path d="m210 20 64-2 2 42-64 3Z" fill="#b9c2a7" />
        <path d="m212 72 64-3 2 44-64 3Z" fill="#c6cbb6" />
        <path d="m0 64 280-5" stroke="#dcd8c8" strokeWidth="3" />
        <path d="m78 14 6 106M202 14 6 106" stroke="#dcd8c8" strokeWidth="2" />
        <path d="m108 28 70-6 10 42-10 38-64 5-14-38Z" fill="rgb(232 170 23 / 0.25)" stroke="#e8aa17" strokeWidth="2.5" strokeLinejoin="round" />
        {[
          [108, 28],
          [178, 22],
          [188, 64],
          [178, 102],
          [114, 107],
          [100, 69],
        ].map(([cx, cy]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2.6" fill="#fff" stroke="#0b1929" strokeWidth="1.4" />
        ))}
      </svg>
      <dl className="mt-2 text-[12px]">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 border-b border-line py-1.5 last:border-0">
            <dt className="text-muted">{k}</dt>
            <dd className="font-medium">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string; deconnecte?: string }>;
}) {
  const { erreur, deconnecte } = await searchParams;
  const error = erreur ? (ERRORS[erreur] ?? ERRORS.serveur) : null;

  return (
    <main className="grid min-h-screen bg-canvas lg:grid-cols-2">
      <section className="relative hidden flex-col justify-between gap-10 overflow-hidden bg-brand-800 px-14 py-12 text-white lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-[size:40px_40px]"
        />
        <div className="relative">
          <Logo inverted />
        </div>
        <div className="relative flex flex-col gap-10">
          <div className="max-w-md">
            <h1 className="text-[44px] leading-[48px] font-bold tracking-[-0.03em] text-white">
              Chaque parcelle africaine a une identité numérique.
            </h1>
            <p className="mt-5 text-[15px] leading-6 text-white/75">
              L&apos;AgroID relie chaque parcelle à son exploitant, à ses campagnes et à ses données terrain. Une
              identité unique, traçable et vérifiable.
            </p>
          </div>
          <IdentityCardIllustration />
        </div>
        <ul className="relative grid grid-cols-3 border-t border-white/15 pt-6">
          {PILLARS.map((p, i) => (
            <li key={p.title} className={i > 0 ? "border-l border-white/15 pl-6" : "pr-6"}>
              <p className="font-display text-[15px] font-semibold text-gold">{p.title}</p>
              <p className="mt-1 text-[12px] leading-4 text-white/70">{p.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col justify-between px-6 py-10 sm:px-12">
        <div className="lg:hidden">
          <Logo />
        </div>
        <div className="mx-auto w-full max-w-[380px] py-10">
          <h2 className="text-[30px] leading-9 font-bold tracking-[-0.02em]">Bon retour</h2>
          <p className="mt-1.5 text-muted">Connectez-vous à votre espace PEST AI OS.</p>

          <div className="mt-6 space-y-3 empty:hidden">
            {error ? <Alert>{error}</Alert> : null}
            {deconnecte ? <Alert tone="info">Vous êtes déconnecté.</Alert> : null}
          </div>

          <form action="/api/session/login" method="post" className="mt-7 space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="phone_number">Numéro de téléphone</Label>
              <Input
                id="phone_number"
                name="phone_number"
                type="tel"
                inputMode="tel"
                autoComplete="username"
                placeholder="77 123 45 67"
                prefix="+221"
                aria-describedby="phone-hint"
                required
              />
              <p id="phone-hint" className="text-[12px] text-muted">
                Numéro étranger : saisissez-le avec son indicatif (+33…).
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Mot de passe</Label>
              <PasswordInput id="password" name="password" autoComplete="current-password" required />
            </div>
            <Button type="submit" size="lg" className="w-full">
              Se connecter
            </Button>
          </form>

          <div className="mt-6 flex items-start gap-3 rounded-lg border border-line bg-surface px-4 py-3 text-[13px] text-muted">
            <Users className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p>L&apos;accès se fait sur invitation de votre coopérative ou de votre organisation.</p>
          </div>
        </div>
        <div className="mx-auto flex w-full max-w-[380px] flex-wrap items-center justify-between gap-3 text-[12px] text-muted">
          <span className="inline-flex items-center gap-2">
            <Globe className="size-3.5" aria-hidden />
            <span className="font-medium text-ink">Français</span>
            <span aria-hidden>·</span>
            <span title="Bientôt disponible">Wolof</span>
            <span aria-hidden>·</span>
            <span title="Bientôt disponible">Pulaar</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Lock className="size-3.5" aria-hidden />
            Connexion chiffrée
          </span>
        </div>
      </section>
    </main>
  );
}
