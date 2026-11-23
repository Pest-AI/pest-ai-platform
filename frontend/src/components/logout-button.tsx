"use client";

import { LogOut } from "lucide-react";
import { useId, useRef } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Bouton de déconnexion avec confirmation.
 * La fenêtre utilise l'élément natif <dialog> : focus piégé, touche Échap et
 * lecteurs d'écran gérés par le navigateur.
 */
export function LogoutButton({ variant = "icon", onDark = false }: { variant?: "icon" | "text" | "menu"; onDark?: boolean }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const id = useId();

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        aria-haspopup="dialog"
        className={cn(
          "transition-colors",
          onDark ? "text-white/60 hover:bg-white/10 hover:text-white" : "text-muted hover:bg-subtle hover:text-ink",
          variant === "menu"
            ? "flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-[14px] text-ink hover:bg-surface"
            : variant === "icon"
            ? "grid size-9 place-items-center rounded-lg"
            : "inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-[13px]",
        )}
        aria-label={variant === "icon" ? "Se déconnecter" : undefined}
        title={variant === "icon" ? "Se déconnecter" : undefined}
      >
        <LogOut className="size-4" aria-hidden />
        {variant !== "icon" ? "Se déconnecter" : null}
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-text`}
        onClick={(e) => {
          if (e.target === e.currentTarget) e.currentTarget.close();
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-line bg-canvas p-0 text-left text-ink shadow-pop backdrop:bg-night/40 backdrop:backdrop-blur-[2px]"
      >
        <div className="p-6">
          <span className="grid size-10 place-items-center rounded-full bg-subtle text-ink">
            <LogOut className="size-5" aria-hidden />
          </span>
          <h2 id={`${id}-title`} className="mt-4 text-[18px] leading-6 font-semibold">
            Se déconnecter ?
          </h2>
          <p id={`${id}-text`} className="mt-1.5 text-[14px] text-muted">
            Vous devrez vous reconnecter pour revenir dans votre espace.
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
