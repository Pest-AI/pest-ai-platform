"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import type * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Fenêtre modale accessible, basée sur l'élément natif <dialog>
 * (focus piégé, Échap, annonce aux lecteurs d'écran gérés par le navigateur).
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className={cn(
        "m-auto w-[calc(100%-2rem)] max-w-lg rounded-xl border border-line bg-canvas p-0 text-left font-normal text-ink shadow-pop backdrop:bg-night/40 backdrop:backdrop-blur-[2px]",
        className,
      )}
    >
      {open ? (
        <>
          <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
            <div>
              <h2 id={titleId} className="text-[17px] leading-6 font-semibold">
                {title}
              </h2>
              {description ? <p className="mt-0.5 text-[13px] text-muted">{description}</p> : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="grid size-8 shrink-0 place-items-center rounded-md text-muted hover:bg-subtle hover:text-ink"
              aria-label="Fermer"
            >
              <X className="size-4" />
            </button>
          </div>
          {children}
        </>
      ) : null}
    </dialog>
  );
}
