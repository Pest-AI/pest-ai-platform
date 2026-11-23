"use client";

import { Menu, X } from "lucide-react";
import { useRef } from "react";
import type * as React from "react";

/**
 * Menu des petits écrans : la barre latérale s'ouvre dans un tiroir.
 * Élément natif <dialog> : focus piégé, touche Échap et lecteurs d'écran gérés par le navigateur.
 */
export function MobileNav({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        aria-label="Ouvrir le menu"
        aria-haspopup="dialog"
        className="-ml-1.5 grid size-9 place-items-center rounded-lg text-ink hover:bg-subtle lg:hidden"
      >
        <Menu className="size-5" aria-hidden />
      </button>
      <dialog
        ref={ref}
        aria-label="Menu"
        onClick={(e) => {
          // Fermeture au clic sur le fond ou sur un lien du menu.
          if (e.target === e.currentTarget || (e.target as HTMLElement).closest("a")) e.currentTarget.close();
        }}
        className="m-0 h-dvh max-h-dvh w-[min(300px,85vw)] max-w-none bg-forest p-0 text-white backdrop:bg-night/50 backdrop:backdrop-blur-[2px] open:animate-[nav-in_180ms_ease-out]"
      >
        <button
          type="button"
          onClick={() => ref.current?.close()}
          aria-label="Fermer le menu"
          className="absolute top-4 right-3 z-10 grid size-9 place-items-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white"
        >
          <X className="size-5" aria-hidden />
        </button>
        {children}
      </dialog>
    </>
  );
}
