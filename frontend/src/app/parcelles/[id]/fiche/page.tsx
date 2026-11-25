import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { QrCode } from "@/components/qr-code";
import { loadOrgContext } from "@/lib/org-context";
import { formatArea } from "@/lib/parcels";
import { agroidUrl } from "@/lib/qr";
import { formatDate } from "@/lib/spaces";

import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "Fiche AgroID à imprimer" };

/**
 * Fiche AgroID imprimable (J19) : à plastifier et poser au champ. Le QR code ouvre la
 * parcelle dans l'app terrain ; l'AgroID est aussi écrit en clair pour la saisie à la main.
 */
export default async function PrintableFichePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const ctx = await loadOrgContext();
  const { data: p } = await ctx.api.GET("/api/v1/parcels/{id}/", { params: { header: ctx.header, path: { id } } });
  if (!p || !p.agroid) notFound();
  const operator = p.operators.find((o) => o.is_current && o.operator_role === "primary");

  return (
    <main className="mx-auto max-w-[720px] px-6 py-8 print:max-w-none print:p-0">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <Link href={`/parcelles/${id}`} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-700 hover:underline">
          <ArrowLeft className="size-4" aria-hidden />
          Fiche parcelle
        </Link>
        <PrintButton />
      </div>

      <article className="rounded-3xl border-2 border-ink p-8 print:rounded-none print:border-[3px]">
        <header className="flex items-center justify-between border-b border-line pb-4">
          <p className="text-[18px] font-bold">
            PEST AI <span className="text-gold">AgroID</span>
          </p>
          <p className="text-[13px] text-muted">{ctx.org.short_name || ctx.org.name}</p>
        </header>
        <div className="mt-6 flex flex-col items-center gap-6 sm:flex-row sm:items-start">
          <QrCode value={agroidUrl(p.agroid)} size={240} label={`QR code de l'AgroID ${p.agroid}`} />
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-semibold tracking-wider text-muted uppercase">Identifiant de la parcelle</p>
            <p className="mt-1 font-mono text-[30px] leading-9 font-bold tracking-wide">{p.agroid}</p>
            <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[15px]">
              <dt className="text-muted">Parcelle</dt>
              <dd className="font-semibold">{p.local_name || "—"}</dd>
              <dt className="text-muted">Exploitant</dt>
              <dd className="font-semibold">{operator?.producer_name ?? "—"}</dd>
              <dt className="text-muted">Surface</dt>
              <dd className="tabular font-mono">{formatArea(p.current_area_m2)}</dd>
              <dt className="text-muted">Enregistrée le</dt>
              <dd className="tabular font-mono">{p.agroid_assigned_at ? formatDate(p.agroid_assigned_at) : "—"}</dd>
            </dl>
          </div>
        </div>
        <p className="mt-6 border-t border-line pt-4 text-[13px] text-muted">
          Scannez avec l&apos;application terrain PEST AI pour ouvrir la parcelle, ses unités, ses cycles et ses observations.
          Sans réseau, saisissez l&apos;AgroID à la main.
        </p>
      </article>
    </main>
  );
}
