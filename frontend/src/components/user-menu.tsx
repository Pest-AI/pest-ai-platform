"use client";

import { ArrowLeftRight, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { LogoutButton } from "@/components/logout-button";

/** Menu du profil (barre du haut) : espace actif, changement d'espace, déconnexion. */
export function UserMenu({
  initials,
  name,
  roleLabel,
  workspaceName,
}: {
  initials: string;
  name: string;
  roleLabel: string;
  workspaceName: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      // Ne pas fermer quand la fenêtre de déconnexion (hors du menu) est ouverte.
      if (document.querySelector("dialog[open]")) return;
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2.5 rounded-full bg-canvas/90 py-1 pr-2.5 pl-1 shadow-card ring-1 ring-line backdrop-blur transition-colors hover:bg-canvas sm:pr-3.5"
      >
        <span className="grid size-9 place-items-center rounded-full bg-forest font-display text-[12px] font-bold text-white">
          {initials}
        </span>
        <span className="hidden text-[14px] font-semibold sm:inline">{name}</span>
        <ChevronDown className="size-4 text-muted" aria-hidden />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute top-[calc(100%+8px)] right-0 z-40 w-64 overflow-hidden rounded-2xl border border-line bg-canvas shadow-pop"
        >
          <div className="border-b border-line px-4 py-3">
            <p className="truncate text-[14px] font-semibold">{name}</p>
            <p className="truncate text-[12px] text-muted">
              {roleLabel} · {workspaceName}
            </p>
          </div>
          <div className="p-1.5">
            <Link
              href="/espaces"
              role="menuitem"
              className="flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[14px] hover:bg-surface"
            >
              <ArrowLeftRight className="size-4 text-muted" aria-hidden />
              Changer d&apos;espace
            </Link>
            <LogoutButton variant="menu" />
          </div>
        </div>
      ) : null}
    </div>
  );
}
