"use client";

import { Check, Copy, MessageCircle } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

/** Affiche un code d'activation (une seule fois) avec copie et partage WhatsApp. */
export function ActivationCodePanel({
  code,
  firstName,
  phone,
  organization,
}: {
  code: string;
  firstName: string;
  phone: string;
  organization: string;
}) {
  const [copied, setCopied] = useState(false);
  const origin = typeof window === "undefined" ? "https://app.pestai.africa" : window.location.origin;
  const message =
    `Bonjour ${firstName}, ${organization} vous invite sur PEST AI OS. ` +
    `Activez votre compte sur ${origin}/activer avec votre numéro et le code ${code} (valable 7 jours).`;

  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <p className="text-[13px] text-muted">Code d&apos;activation à transmettre</p>
      <p className="mt-1 font-mono text-[28px] leading-9 font-medium tracking-[0.12em]" aria-live="polite">
        {code}
      </p>
      <p className="mt-1 text-[12px] text-muted">
        Valable 7 jours, une seule fois. Il ne sera plus affiché : transmettez-le maintenant ou générez-en un
        nouveau plus tard.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={async () => {
            await navigator.clipboard.writeText(message);
            setCopied(true);
          }}
        >
          {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
          {copied ? "Message copié" : "Copier le message"}
        </Button>
        <Button asChild variant="secondary" size="sm">
          <a href={`https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer">
            <MessageCircle aria-hidden />
            Envoyer par WhatsApp
          </a>
        </Button>
      </div>
    </div>
  );
}
