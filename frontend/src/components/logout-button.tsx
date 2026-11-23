"use client";

import { LogOut } from "lucide-react";
import { useRef } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Bouton de déconnexion avec confirmation.
 * La fenêtre utilise l'élément natif <dialog> : focus piégé, touche Échap et
 * lecteurs d'écran gérés par le navigateur.
 */
export function LogoutButton({ variant = "icon" }: { variant?: "icon" | "text" }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        aria-haspopup="dialog"
        className={cn(
          "text-muted transition-colors hover:bg-subtle hover:text-ink",
          variant === "icon"
            ? "grid size-8 place-items-center rounded-md"
            : "inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-[13px]",
        )}
        aria-label={variant === "icon" ? "Se déconnecter" : undefined}
        title={variant === "icon" ? "Se déconnecter" : undefined}
      >
        <LogOut className="size-4" aria-hidden />
        {variant === "text" ? "Se déconnecter" : null}
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby="logout-title"
        aria-describedby="logout-text"
        onClick={(e) => {
          if (e.target === e.currentTarget) e.currentTarget.close();
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-xl border border-line bg-canvas p-0 text-ink shadow-pop backdrop:bg-night/40 backdrop:backdrop-blur-[2px]"
      >
        <div className="p-6">
          <span className="grid size-10 place-items-center rounded-full bg-subtle text-ink">
            <LogOut className="size-5" aria-hidden />
          </span>
          <h2 id="logout-title" className="mt-4 text-[18px] leading-6 font-semibold">
            Se déconnecter ?
          </h2>
          <p id="logout-text" className="mt-1.5 text-[14px] text-muted">
            Vous devrez saisir à nouveau votre numéro et votre mot de passe pour revenir dans PEST AI OS.
          </p>
        </div>
        <form
          action="/api/session/logout"
          method="post"
          className="flex justify-end gap-2 border-t border-line bg-surface px-6 py-4"
        >
          <Button type="button" variant="secondary" onClick={() => dialogRef.current?.close()} autoFocus>
            Annuler
          </Button>
          <Button type="submit">Se déconnecter</Button>
        </form>
      </dialog>
    </>
  );
}
