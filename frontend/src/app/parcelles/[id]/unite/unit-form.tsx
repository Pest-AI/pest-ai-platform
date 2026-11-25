"use client";

import { Check, LoaderCircle, RotateCcw, Undo2 } from "lucide-react";
import { useActionState, useState } from "react";

import { ParcelDrawMap } from "@/components/parcel-draw-map";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type LonLat, ringAreaM2 } from "@/lib/coordinates";
import { type Bbox, formatArea } from "@/lib/parcels";

import { type UnitState, createUnit } from "./actions";

type Reference = { type: "FeatureCollection"; features: unknown[] };

/** Ajout d'une unité : tracé sur l'image satellite (contour de la parcelle en blanc) ou surface seule. */
export function UnitForm({
  parcelId,
  bbox,
  reference,
  nextCode,
}: {
  parcelId: string;
  bbox: Bbox | null;
  reference: Reference;
  nextCode: string;
}) {
  const [state, action, pending] = useActionState<UnitState, FormData>(createUnit, { status: "idle" });
  const [points, setPoints] = useState<LonLat[]>([]);
  const [withContour, setWithContour] = useState(true);
  const area = points.length >= 3 ? ringAreaM2(points) : 0;

  return (
    <form action={action} className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <input type="hidden" name="parcel_id" value={parcelId} />
      <input type="hidden" name="points" value={JSON.stringify(withContour ? points : [])} />
      <div className="space-y-3">
        <div className="flex gap-2" role="radiogroup" aria-label="Façon de déclarer l'unité">
          {[
            [true, "Tracer sur la carte"],
            [false, "Surface seulement"],
          ].map(([value, label]) => (
            <button
              key={String(value)}
              type="button"
              role="radio"
              aria-checked={withContour === value}
              onClick={() => setWithContour(value as boolean)}
              className={
                withContour === value
                  ? "rounded-xl border border-forest bg-forest px-3 py-2 text-[13px] font-semibold text-white"
                  : "rounded-xl border border-line bg-canvas px-3 py-2 text-[13px] font-semibold"
              }
            >
              {label as string}
            </button>
          ))}
        </div>
        {withContour ? (
          <>
            <p className="text-[13px] text-muted">
              Cliquez chaque coin de la zone cultivée, à l&apos;intérieur du contour blanc de la parcelle. Les unités déjà
              déclarées sont en vert.
            </p>
            <div className="relative">
              <ParcelDrawMap mode="trace" points={points} onAdd={(p) => setPoints((pts) => [...pts, p])} bbox={bbox} reference={reference} label="Carte de saisie de l'unité de culture" maxZoom={18} />
              <div className="absolute top-3 left-3 flex gap-2">
                <Button type="button" size="sm" variant="secondary" disabled={!points.length} onClick={() => setPoints((p) => p.slice(0, -1))}>
                  <Undo2 aria-hidden />
                  Annuler le point
                </Button>
                <Button type="button" size="sm" variant="secondary" disabled={!points.length} onClick={() => setPoints([])}>
                  <RotateCcw aria-hidden />
                  Recommencer
                </Button>
              </div>
            </div>
          </>
        ) : (
          <p className="rounded-xl bg-surface px-4 py-4 text-[13px] text-muted">
            L&apos;unité est déclarée par son code et sa surface (D-16) ; son contour pourra être relevé au GPS par l&apos;agent.
          </p>
        )}
      </div>

      <div className="space-y-4 rounded-2xl border border-line bg-canvas p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="code">Code</Label>
            <Input id="code" name="code" placeholder={nextCode} className="font-mono uppercase" maxLength={16} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="name">Nom (facultatif)</Label>
            <Input id="name" name="name" placeholder="ex. Tomate nord" maxLength={100} />
          </div>
        </div>
        {withContour ? (
          <div className="rounded-xl bg-surface px-4 py-3 text-[13px]">
            <p className="text-muted">Surface tracée</p>
            <p className="tabular font-mono text-[18px] font-semibold">{area ? formatArea(area) : "—"}</p>
            <p className="mt-1 text-[12px] text-muted">{points.length} point{points.length > 1 ? "s" : ""} · mesurée à nouveau par le serveur</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="area">Surface en m²</Label>
            <Input id="area" name="area_m2" inputMode="decimal" placeholder="ex. 2500" />
          </div>
        )}
        <p className="text-[12px] leading-5 text-muted">
          Une unité qui déborde de la parcelle de plus de 1 m, ou chevauche une autre unité, est enregistrée mais signalée.
        </p>
        {state.status === "error" ? <Alert tone="danger">{state.message}</Alert> : null}
        <Button type="submit" disabled={pending || (withContour && points.length < 3)} className="h-10 w-full rounded-xl">
          {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : <Check aria-hidden />}
          Enregistrer l&apos;unité
        </Button>
      </div>
    </form>
  );
}
