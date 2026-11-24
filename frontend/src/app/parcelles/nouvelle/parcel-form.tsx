"use client";

import { Check, Keyboard, LoaderCircle, MapPin, MousePointerClick, Search, Trash2, Undo2, X } from "lucide-react";
import { useActionState, useEffect, useMemo, useState } from "react";

import { type DrawMode, ParcelDrawMap } from "@/components/parcel-draw-map";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { type LonLat, parseCoordinates, ringAreaM2 } from "@/lib/coordinates";
import { type Bbox, formatArea } from "@/lib/parcels";
import { cn } from "@/lib/utils";

import { type CreateState, createParcel } from "./actions";

const MODES: { value: DrawMode; label: string; icon: React.ComponentType<{ className?: string }>; hint: string }[] = [
  { value: "trace", label: "Tracer sur la carte", icon: MousePointerClick, hint: "Cliquez chaque coin du champ, dans l'ordre." },
  {
    value: "coordonnees",
    label: "Saisir des coordonnées",
    icon: Keyboard,
    hint: "Recopiez les points relevés (papier, GPS) : une ligne par point, latitude puis longitude.",
  },
  { value: "position", label: "Position seulement", icon: MapPin, hint: "Un clic sur la carte : le contour sera relevé plus tard." },
  { value: "aucune", label: "Sans localisation", icon: X, hint: "La parcelle reçoit son AgroID ; position et contour viendront du terrain." },
];

const INPUT =
  "h-10 w-full rounded-xl border border-line bg-surface px-3 text-[14px] text-ink placeholder:text-muted focus:border-leaf focus:outline-none";

type Producer = { id: string; name: string; detail: string };

function OperatorPicker({ value, onChange }: { value: Producer | null; onChange: (p: Producer | null) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Producer[]>([]);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/parcelles/producteurs?q=${encodeURIComponent(q)}`);
        setResults(res.ok ? ((await res.json()).results as Producer[]) : []);
      } catch {
        setResults([]);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [q, open]);

  if (value) {
    return (
      <div className="flex h-10 items-center justify-between gap-2 rounded-xl border border-line bg-surface px-3">
        <span className="min-w-0 truncate text-[14px]">
          <span className="font-semibold">{value.name}</span>
          {value.detail ? <span className="text-muted"> · {value.detail}</span> : null}
        </span>
        <button type="button" aria-label="Retirer l'exploitant" onClick={() => onChange(null)} className="text-muted hover:text-ink">
          <X className="size-4" aria-hidden />
        </button>
      </div>
    );
  }
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
      <input
        id="operator-search"
        type="search"
        role="combobox"
        aria-expanded={open}
        aria-controls="operator-results"
        autoComplete="off"
        value={q}
        placeholder="Nom, téléphone ou n° d'adhérent…"
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => setQ(e.currentTarget.value)}
        className={`${INPUT} pl-9`}
      />
      {open ? (
        <ul
          id="operator-results"
          role="listbox"
          className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-line bg-canvas py-1 shadow-lg"
        >
          {results.length === 0 ? (
            <li className="px-3 py-2 text-[13px] text-muted">Aucun producteur trouvé</li>
          ) : (
            results.map((p) => (
              <li key={p.id} role="option" aria-selected={false}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange(p);
                    setOpen(false);
                  }}
                  className="block w-full px-3 py-2 text-left hover:bg-surface"
                >
                  <span className="block text-[14px] font-semibold">{p.name}</span>
                  {p.detail ? <span className="block text-[12px] text-muted">{p.detail}</span> : null}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}

export function ParcelForm({ bbox, canChooseOperator }: { bbox: Bbox | null; canChooseOperator: boolean }) {
  const [state, action, pending] = useActionState<CreateState, FormData>(createParcel, { status: "idle" });
  const [mode, setMode] = useState<DrawMode>("trace");
  const [traced, setTraced] = useState<LonLat[]>([]);
  const [position, setPosition] = useState<LonLat[]>([]);
  const [text, setText] = useState("");
  const [operator, setOperator] = useState<Producer | null>(null);

  const parsed = useMemo(() => parseCoordinates(text), [text]);
  const typed = parsed.flatMap((l) => (l.point ? [l.point] : []));
  const errors = parsed.filter((l) => l.error);
  const points = mode === "trace" ? traced : mode === "coordonnees" ? typed : mode === "position" ? position : [];
  const area = mode === "trace" || mode === "coordonnees" ? ringAreaM2(points) : 0;
  const ready =
    mode === "aucune" ||
    (mode === "position" && points.length === 1) ||
    ((mode === "trace" || mode === "coordonnees") && points.length >= 3 && errors.length === 0);
  const current = MODES.find((m) => m.value === mode);

  return (
    <form action={action} className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="points" value={JSON.stringify(points)} />
      <input type="hidden" name="operator" value={operator?.id ?? ""} />

      <div className="space-y-3">
        <div role="radiogroup" aria-label="Comment situer la parcelle" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {MODES.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={mode === value}
              onClick={() => setMode(value)}
              className={cn(
                "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-[13px] font-semibold transition-colors",
                mode === value ? "border-forest bg-forest text-white" : "border-line bg-canvas text-ink hover:border-leaf",
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              {label}
            </button>
          ))}
        </div>
        <p className="text-[13px] text-muted">{current?.hint}</p>

        {mode === "coordonnees" ? (
          <div>
            <label htmlFor="coordinates" className="sr-only">
              Coordonnées
            </label>
            <textarea
              id="coordinates"
              rows={5}
              value={text}
              onChange={(e) => setText(e.currentTarget.value)}
              placeholder={"16.6512, -14.9634\n16.6512, -14.9625\n16°39'07\"N 14°57'45\"W"}
              className="w-full rounded-xl border border-line bg-surface px-3 py-2 font-mono text-[13px] focus:border-leaf focus:outline-none"
            />
            {errors.length > 0 ? (
              <p className="mt-1 text-[12px] text-danger">
                {errors.map((e) => `Ligne ${e.line} ${e.error}`).join(" · ")}
              </p>
            ) : null}
          </div>
        ) : null}

        {mode !== "aucune" ? (
          <div className="relative">
            <ParcelDrawMap
              mode={mode}
              points={points}
              bbox={bbox}
              onAdd={(p) => (mode === "trace" ? setTraced((t) => [...t, p]) : setPosition([p]))}
            />
            {mode === "trace" || mode === "position" ? (
              <div className="absolute top-3 left-3 flex gap-2">
                {mode === "trace" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={traced.length === 0}
                    onClick={() => setTraced((t) => t.slice(0, -1))}
                  >
                    <Undo2 aria-hidden />
                    Annuler le point
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={points.length === 0}
                  onClick={() => (mode === "trace" ? setTraced([]) : setPosition([]))}
                >
                  <Trash2 aria-hidden />
                  Effacer
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="h-fit space-y-4 rounded-2xl border border-line bg-canvas p-5 lg:sticky lg:top-5">
        <div>
          <label htmlFor="local_name" className="mb-1 block text-[13px] font-semibold">
            Nom de la parcelle
          </label>
          <input id="local_name" name="local_name" maxLength={150} placeholder="Ex. Casier Nord, champ de Dado" className={INPUT} />
        </div>
        {canChooseOperator ? (
          <div>
            <label htmlFor="operator-search" className="mb-1 block text-[13px] font-semibold">
              Exploitant principal <span className="font-normal text-muted">(facultatif)</span>
            </label>
            <OperatorPicker value={operator} onChange={setOperator} />
          </div>
        ) : null}

        <dl className="grid grid-cols-2 gap-3 rounded-xl bg-surface p-3 text-[13px]">
          <div>
            <dt className="text-muted">Points</dt>
            <dd className="tabular font-mono font-semibold">{mode === "aucune" ? "—" : points.length}</dd>
          </div>
          <div>
            <dt className="text-muted">Surface estimée</dt>
            <dd className="tabular font-mono font-semibold">{area ? formatArea(area) : "—"}</dd>
          </div>
        </dl>

        {mode === "trace" || mode === "coordonnees" ? (
          <Alert tone="info">Contour à confirmer par un relevé terrain : il le restera jusqu&apos;au passage d&apos;un agent ou à la décision d&apos;un agronome.</Alert>
        ) : (
          <Alert tone="info">Sans contour, la parcelle a son AgroID tout de suite ; l&apos;agent relèvera le contour sur place.</Alert>
        )}
        {state.status === "error" ? <Alert tone="danger">{state.message}</Alert> : null}

        <Button type="submit" disabled={!ready || pending} className="h-10 w-full rounded-xl">
          {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : <Check aria-hidden />}
          Enregistrer et attribuer l&apos;AgroID
        </Button>
      </div>
    </form>
  );
}
