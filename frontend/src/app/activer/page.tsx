import type { Metadata } from "next";
import Link from "next/link";

import { Logo } from "@/components/logo";

import { ActivationForm } from "./activation-form";

export const metadata: Metadata = { title: "Activer mon compte" };

export default function ActivationPage() {
  return (
    <main className="flex min-h-screen flex-col bg-canvas px-6 py-10 sm:px-12">
      <Link href="/connexion" aria-label="Retour à la connexion">
        <Logo />
      </Link>
      <div className="mx-auto w-full max-w-[400px] flex-1 py-12">
        <h1 className="text-[30px] leading-9 font-bold tracking-[-0.02em]">Activer mon compte</h1>
        <p className="mt-1.5 text-muted">
          Vous avez été invité sur PEST AI OS. Saisissez votre numéro, le code reçu et choisissez votre mot de passe.
        </p>
        <ActivationForm />
        <p className="mt-6 text-center text-[13px] text-muted">
          Déjà activé ?{" "}
          <Link href="/connexion" className="font-medium text-brand-700 hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    </main>
  );
}
