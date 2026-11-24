"use client";

import { Check, LoaderCircle, Trash2 } from "lucide-react";
import { useActionState, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { OPERATOR_KEYS } from "@/lib/parcel-imports";

import { type ImportState, changeMapping, commitImport, discardImport } from "../actions";

const SELECT =
  "h-10 w-full cursor-pointer rounded-xl border border-line bg-surface px-3 text-[14px] text-ink focus:border-leaf focus:outline-none";

/** Colonnes du fichier : nom de la parcelle, exploitant et sa nature. Recalcule l'aperçu. */
export function MappingForm({
  importId,
  columns,
  mapping,
}: {
  importId: string;
  columns: string[];
  mapping: { name_column?: string | null; operator_column?: string | null; operator_key?: string };
}) {
  const [state, action, pending] = useActionState<ImportState, FormData>(changeMapping, { status: "idle" });
  const [operator, setOperator] = useState(mapping.operator_column ?? "");
  const submit = (e: React.ChangeEvent<HTMLSelectElement>) => e.currentTarget.form?.requestSubmit();
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-3">
      <input type="hidden" name="import_id" value={importId} />
      <label className="block">
        <span className="mb-1 block text-[13px] font-semibold">Nom de la parcelle</span>
        <select name="name_column" defaultValue={mapping.name_column ?? ""} onChange={submit} className={SELECT}>
          <option value="">Aucune colonne</option>
          {columns.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-[13px] font-semibold">Exploitant</span>
        <select
          name="operator_column"
          defaultValue={mapping.operator_column ?? ""}
          onChange={(e) => {
            setOperator(e.currentTarget.value);
            submit(e);
          }}
          className={SELECT}
        >
          <option value="">Pas d’exploitant</option>
          {columns.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-[13px] font-semibold">La colonne contient</span>
        <select
          name="operator_key"
          defaultValue={mapping.operator_key === "phone" ? "phone" : "membership_number"}
          disabled={!operator}
          onChange={submit}
          className={`${SELECT} disabled:opacity-50`}
        >
          {OPERATOR_KEYS.map(([v, t]) => (
            <option key={v} value={v}>
              {t}
            </option>
          ))}
        </select>
      </label>
      <div className="sm:col-span-3" aria-live="polite">
        {pending ? (
          <p className="flex items-center gap-2 text-[13px] text-muted">
            <LoaderCircle className="size-4 animate-spin" aria-hidden />
            Mise à jour de l’aperçu…
          </p>
        ) : state.status === "error" ? (
          <Alert tone="danger">{state.message}</Alert>
        ) : null}
      </div>
    </form>
  );
}

/** Confirmation : crée les lignes prêtes (et, sur demande, celles à vérifier). */
export function CommitForm({
  importId,
  ok,
  flagged,
  producersNew = 0,
  producersFlagged = 0,
}: {
  importId: string;
  ok: number;
  flagged: number;
  producersNew?: number;
  producersFlagged?: number;
}) {
  const [state, action, pending] = useActionState<ImportState, FormData>(commitImport, { status: "idle" });
  const [withFlagged, setWithFlagged] = useState(false);
  const count = ok + (withFlagged ? flagged : 0);
  const people = producersNew + (withFlagged ? producersFlagged : 0);
  const toCheck = flagged + producersFlagged;
  const label = [
    people ? `${people} producteur${people > 1 ? "s" : ""}` : "",
    count ? `${count} parcelle${count > 1 ? "s" : ""}` : "",
  ]
    .filter(Boolean)
    .join(" et ");
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="import_id" value={importId} />
      {state.status === "error" ? <Alert tone="danger">{state.message}</Alert> : null}
      {toCheck > 0 ? (
        <label className="flex items-start gap-2.5 text-[13px] leading-5">
          <input
            type="checkbox"
            name="include_flagged"
            checked={withFlagged}
            onChange={(e) => setWithFlagged(e.currentTarget.checked)}
            className="mt-0.5 size-4 accent-[var(--color-leaf)]"
          />
          <span>
            {toCheck > 1 ? `Créer aussi les ${toCheck} lignes à vérifier` : "Créer aussi la ligne à vérifier"}
            <span className="block text-muted">
              Doublons probables : une nouvelle fiche est créée. Contours signalés : « à vérifier » sur leur fiche.
            </span>
          </span>
        </label>
      ) : null}
      <Button type="submit" disabled={pending || (count === 0 && people === 0)} className="h-10 w-full rounded-xl">
        {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : <Check aria-hidden />}
        {label ? `Créer ${label}` : "Rien à créer"}
      </Button>
      <p className="text-[12px] leading-5 text-muted">
        Les contours importés seront « à confirmer par un relevé terrain ». Une parcelle créée garde son AgroID pour
        toujours : elle peut être retirée, jamais supprimée.
      </p>
    </form>
  );
}

export function DiscardButton({ importId }: { importId: string }) {
  return (
    <form action={discardImport}>
      <input type="hidden" name="import_id" value={importId} />
      <Button type="submit" variant="ghost" className="h-9 w-full rounded-xl text-muted">
        <Trash2 aria-hidden />
        Abandonner cet import
      </Button>
    </form>
  );
}
