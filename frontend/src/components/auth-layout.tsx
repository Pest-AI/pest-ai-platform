import { Fingerprint, LockKeyhole, UserCheck } from "lucide-react";
import Image from "next/image";
import type * as React from "react";

import champ from "../../public/brand/connexion-champ.jpg";

/**
 * Mise en page des écrans d'accès (connexion, activation).
 * Photo de terrain en fond, logo officiel en grand, message de marque à gauche, carte du formulaire à droite.
 * - Mobile : la photo en bandeau, le formulaire en feuille blanche dessous.
 * - Tablette : photo plein écran, logo et message en haut, carte centrée dessous.
 * - Ordinateur : photo plein écran, message à gauche, carte à droite.
 */
export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative min-h-dvh bg-canvas">
      {/* Fond photo */}
      <div className="absolute inset-x-0 top-0 h-[52dvh] min-h-[380px] overflow-hidden md:fixed md:inset-0 md:h-auto">
        <Image
          src={champ}
          alt="Agriculteur consultant la carte de ses parcelles sur une tablette, dans un champ"
          fill
          priority
          placeholder="blur"
          sizes="100vw"
          className="object-cover object-[72%_center] md:object-[62%_center] lg:object-center"
        />
        {/* Lisibilité du message (bas et gauche) sans assombrir le ciel où se trouve le logo */}
        <div
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(180deg,rgb(255_255_255/0)_30%,rgb(10_38_22/0.55)_62%,rgb(10_38_22/0.85)_100%)] md:bg-[linear-gradient(180deg,rgb(10_38_22/0)_9%,rgb(10_38_22/0.55)_20%,rgb(10_38_22/0.5)_34%,rgb(10_38_22/0.35)_60%,rgb(10_38_22/0.65)_100%)] lg:bg-[linear-gradient(180deg,rgb(255_255_255/0)_28%,rgb(10_38_22/0.55)_60%,rgb(10_38_22/0.35)_100%)] lg:[mask-image:linear-gradient(90deg,#000_40%,transparent_62%)]"
        />
        {/* Voile clair derrière la carte (ordinateur) */}
        <div
          aria-hidden
          className="absolute inset-0 hidden bg-[linear-gradient(90deg,transparent_58%,rgb(255_255_255/0.45)_100%)] lg:block"
        />
        {/* Courbes vertes translucides (en haut) */}
        <svg
          aria-hidden
          viewBox="0 0 800 400"
          preserveAspectRatio="none"
          className="absolute top-0 right-0 hidden h-[34vh] w-[62vw] lg:block"
        >
          <path d="M60 0 C 220 130, 420 250, 800 260 L800 0Z" fill="#3a9442" fillOpacity="0.2" />
          <path d="M300 0 C 420 90, 580 150, 800 150 L800 0Z" fill="#184429" fillOpacity="0.16" />
        </svg>
        {/* Vague vert forêt et filet or (en bas à gauche) */}
        <svg
          aria-hidden
          viewBox="0 0 700 220"
          preserveAspectRatio="none"
          className="absolute bottom-0 left-0 hidden h-[150px] w-[58vw] lg:block"
        >
          <path d="M0 70 C 200 30, 420 60, 700 220 L0 220Z" fill="#184429" />
          <path d="M0 70 C 200 30, 420 60, 700 220" fill="none" stroke="#e8aa17" strokeWidth="4" />
        </svg>
        <ul className="absolute bottom-7 left-[5vw] hidden items-center gap-6 text-[13px] font-medium text-white/90 lg:flex">
          {[
            { icon: LockKeyhole, label: "Connexion chiffrée" },
            { icon: UserCheck, label: "Accès sur invitation" },
            { icon: Fingerprint, label: "Un AgroID par parcelle" },
          ].map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-2">
              <Icon className="size-4 text-gold" aria-hidden />
              {label}
            </li>
          ))}
        </ul>
      </div>

      <div className="relative mx-auto flex min-h-dvh max-w-[1440px] flex-col md:px-10 md:py-10 lg:flex-row lg:items-center lg:justify-between lg:gap-12 lg:px-[5vw] lg:py-12">
        {/* Logo et message de marque */}
        <section className="flex h-[52dvh] min-h-[380px] flex-col justify-between px-6 pt-6 pb-14 md:h-auto md:min-h-0 md:p-0 lg:h-[calc(100dvh-6rem)] lg:max-w-[560px] lg:flex-1 lg:pb-24">
          <Image
            src="/brand/pest-ai-logo.png"
            alt="PEST AI"
            width={340}
            height={391}
            priority
            className="h-24 w-auto self-start drop-shadow-[0_2px_10px_rgb(255_255_255/0.6)] sm:h-28 lg:h-40"
          />
          <div className="md:mt-10 lg:mt-0">
            <h2 className="font-display text-[28px] leading-[34px] font-bold text-white drop-shadow-[0_2px_12px_rgb(0_0_0/0.35)] sm:text-[36px] sm:leading-[42px] lg:text-[54px] lg:leading-[62px]">
              Une agriculture plus <span className="text-gold">intelligente</span> pour l&apos;Afrique
            </h2>
            <span aria-hidden className="mt-5 hidden h-1 w-24 rounded-full bg-gold sm:block lg:mt-7" />
            <p className="mt-4 hidden max-w-md text-[16px] leading-6 text-white/90 drop-shadow-[0_1px_8px_rgb(0_0_0/0.4)] sm:block lg:mt-6 lg:text-[17px] lg:leading-7">
              Digitalisez vos parcelles, valorisez vos données, boostez vos rendements.
            </p>
          </div>
        </section>

        {/* Carte du formulaire */}
        <section className="relative z-10 -mt-8 flex-1 rounded-t-[28px] bg-canvas px-6 pt-8 pb-10 md:mx-auto md:mt-10 md:w-full md:max-w-[460px] md:flex-none md:rounded-[28px] md:p-10 md:shadow-[0_40px_80px_-24px_rgb(11_25_41/0.45)] lg:m-0 lg:shrink-0">
          {children}
        </section>
      </div>
    </main>
  );
}
