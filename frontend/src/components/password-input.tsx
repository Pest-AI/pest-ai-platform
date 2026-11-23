"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

import { Input } from "@/components/ui/input";

/** Champ mot de passe avec bouton afficher / masquer. */
export function PasswordInput(props: Omit<React.ComponentProps<"input">, "type" | "prefix">) {
  const [visible, setVisible] = useState(false);
  return (
    <Input
      {...props}
      type={visible ? "text" : "password"}
      end={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="grid h-full w-11 shrink-0 place-items-center rounded-r-lg text-muted hover:text-ink"
          aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      }
    />
  );
}
