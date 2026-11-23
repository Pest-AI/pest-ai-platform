import type { Metadata } from "next";
import Link from "next/link";

import { AuthLayout } from "@/components/auth-layout";

import { ActivationForm } from "./activation-form";

export const metadata: Metadata = { title: "Activer mon compte" };

export default function ActivationPage() {
  return (
    <AuthLayout>
      <div className="text-center">
        <h1 className="text-[28px] leading-9 font-bold tracking-[-0.02em] sm:text-[32px] sm:leading-10">Activer mon compte</h1>
        <p className="mt-1.5 text-[15px] text-muted">Saisissez le code reçu et choisissez votre mot de passe.</p>
      </div>
      <ActivationForm />
      <p className="mt-6 text-center text-[14px] text-muted">
        Déjà activé ?{" "}
        <Link href="/connexion" className="font-semibold text-brand-700 hover:underline">
          Se connecter
        </Link>
      </p>
    </AuthLayout>
  );
}
