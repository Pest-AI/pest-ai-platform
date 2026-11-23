"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import {
  Crosshair,
  Expand,
  Layers,
  Minus,
  Pentagon,
  Plus,
  Ruler,
  Search,
} from "lucide-react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Espace cartographique de la vue d'ensemble (maquette AI Studio) :
 * fond satellite ou plan, barre d'outils flottante, légende, coordonnées du curseur, échelle.
 *
 * Les parcelles AgroID (contours, statuts) arrivent avec le registre cartographique (J11 → J14) ;
 * les outils qui en dépendent sont affichés mais désactivés (« Bientôt »).
 */

const SATELLITE = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const PLAN = "https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png";

export type MapView = { center: [number, number]; zoom: number };

const LEGEND = [
  ["bg-leaf", "Active"],
  ["bg-gold", "À surveiller"],
  ["bg-[#9aa8a1]", "En préparation"],
] as const;

function ToolButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={disabled ? `${label} : bientôt disponible` : label}
      aria-label={label}
      className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-white/90 transition-colors hover:bg-white/10 disabled:cursor-default disabled:text-white/40 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}

export function ParcelMap({ view, emptyLabel }: { view: MapView; emptyLabel: string }) {
  const container = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const [base, setBase] = useState<"satellite" | "plan">("satellite");
  const [cursor, setCursor] = useState<{ lat: number; lng: number; zoom: number }>({
    lat: view.center[1],
    lng: view.center[0],
    zoom: view.zoom,
  });

  useEffect(() => {
    let cancelled = false;
    let instance: MapLibreMap | null = null;
    import("maplibre-gl").then(({ Map, ScaleControl, AttributionControl }) => {
      if (cancelled || !container.current) return;
      instance = new Map({
        container: container.current,
        center: view.center,
        zoom: view.zoom,
        attributionControl: false,
        style: {
          version: 8,
          sources: {
            satellite: {
              type: "raster",
              tiles: [SATELLITE],
              tileSize: 256,
              maxzoom: 19,
              attribution: "Imagerie © Esri, Maxar, Earthstar Geographics",
            },
            plan: {
              type: "raster",
              tiles: [PLAN],
              tileSize: 256,
              attribution: "© OpenStreetMap, © CARTO",
            },
          },
          layers: [
            { id: "fond", type: "background", paint: { "background-color": "#16301f" } },
            { id: "satellite", type: "raster", source: "satellite" },
            { id: "plan", type: "raster", source: "plan", layout: { visibility: "none" } },
          ],
        },
      });
      instance.addControl(new ScaleControl({ unit: "metric", maxWidth: 110 }), "bottom-right");
      instance.addControl(new AttributionControl({ compact: true }), "bottom-right");
      const update = (lng: number, lat: number) => setCursor({ lng, lat, zoom: instance?.getZoom() ?? view.zoom });
      instance.on("mousemove", (e) => update(e.lngLat.lng, e.lngLat.lat));
      instance.on("zoomend", () => setCursor((c) => ({ ...c, zoom: instance?.getZoom() ?? c.zoom })));
      map.current = instance;
    });
    return () => {
      cancelled = true;
      instance?.remove();
      map.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- recréer la carte seulement si le cadrage change
  }, [view.center[0], view.center[1], view.zoom]);

  const switchBase = (next: "satellite" | "plan") => {
    setBase(next);
    const m = map.current;
    if (!m) return;
    m.setLayoutProperty("satellite", "visibility", next === "satellite" ? "visible" : "none");
    m.setLayoutProperty("plan", "visibility", next === "plan" ? "visible" : "none");
  };

  return (
    <div ref={frame} className="relative h-[460px] overflow-hidden rounded-2xl bg-[#16301f] shadow-[0_8px_24px_-12px_rgb(11_25_41/0.35)] sm:h-[560px] lg:h-[620px]">
      <div ref={container} className="absolute inset-0" aria-label="Carte des parcelles" role="region" />

      {/* Barre d'outils flottante */}
      <div className="absolute top-3 right-3 left-3 flex flex-wrap items-center gap-2 sm:right-auto">
        <div className="flex flex-wrap items-center gap-1 rounded-xl border border-white/10 bg-night/80 p-1 shadow-pop backdrop-blur-md">
          <label className="relative hidden sm:block">
            <span className="sr-only">Localiser une parcelle</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-white/45" aria-hidden />
            <input
              disabled
              title="Recherche d'AgroID : bientôt disponible"
              placeholder="Localiser un AgroID, un village…"
              className="h-9 w-56 rounded-lg border border-white/10 bg-white/5 pr-3 pl-9 text-[13px] text-white placeholder:text-white/45 disabled:cursor-default"
            />
          </label>
          <span className="mx-1 hidden h-6 w-px bg-white/15 sm:block" aria-hidden />
          <span className="inline-flex rounded-lg bg-white/5 p-0.5" role="group" aria-label="Fond de carte">
            {(
              [
                ["satellite", "Satellite"],
                ["plan", "Plan"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => switchBase(key)}
                aria-pressed={base === key}
                className={cn(
                  "h-8 rounded-md px-3 text-[13px] font-semibold transition-colors",
                  base === key ? "bg-leaf text-white" : "text-white/75 hover:text-white",
                )}
              >
                {label}
              </button>
            ))}
          </span>
          <ToolButton label="Couches" disabled>
            <Layers className="size-4" aria-hidden />
            <span className="max-md:hidden">Couches</span>
          </ToolButton>
          <ToolButton label="Mesurer une distance" disabled>
            <Ruler className="size-4" aria-hidden />
            <span className="max-md:hidden">Distance</span>
          </ToolButton>
          <ToolButton label="Mesurer une surface" disabled>
            <Pentagon className="size-4" aria-hidden />
            <span className="max-md:hidden">Surface</span>
          </ToolButton>
          <span className="mx-1 h-6 w-px bg-white/15" aria-hidden />
          <ToolButton label="Zoom avant" onClick={() => map.current?.zoomIn()}>
            <Plus className="size-4" aria-hidden />
          </ToolButton>
          <ToolButton label="Zoom arrière" onClick={() => map.current?.zoomOut()}>
            <Minus className="size-4" aria-hidden />
          </ToolButton>
          <ToolButton label="Recentrer" onClick={() => map.current?.flyTo({ center: view.center, zoom: view.zoom })}>
            <Crosshair className="size-4" aria-hidden />
          </ToolButton>
          <ToolButton
            label="Plein écran"
            onClick={() => (document.fullscreenElement ? document.exitFullscreen() : frame.current?.requestFullscreen())}
          >
            <Expand className="size-4" aria-hidden />
          </ToolButton>
        </div>
      </div>

      {/* Aucune parcelle encore : message centré, discret */}
      <div className="pointer-events-none absolute inset-0 grid place-items-center px-6">
        <span className="rounded-xl border border-white/15 bg-night/75 px-4 py-2.5 text-center text-[13px] font-medium text-white shadow-pop backdrop-blur-md">
          {emptyLabel}
        </span>
      </div>

      {/* Légende et coordonnées */}
      <div className="absolute bottom-3 left-3 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-3 rounded-xl border border-white/10 bg-night/80 px-3 py-2 text-[12px] text-white/90 backdrop-blur-md">
          {LEGEND.map(([color, label]) => (
            <span key={label} className="inline-flex items-center gap-1.5">
              <span className={cn("size-2.5 rounded-sm", color)} aria-hidden />
              {label}
            </span>
          ))}
        </span>
        <span className="tabular hidden items-center gap-2 rounded-xl border border-white/10 bg-night/80 px-3 py-2 font-mono text-[12px] text-white/90 backdrop-blur-md sm:inline-flex">
          <Crosshair className="size-3.5 text-gold" aria-hidden />
          {Math.abs(cursor.lat).toFixed(5)}° {cursor.lat >= 0 ? "N" : "S"}, {Math.abs(cursor.lng).toFixed(5)}° {cursor.lng >= 0 ? "E" : "W"}
          <span className="text-white/40">|</span>Z{cursor.zoom.toFixed(1)}
        </span>
      </div>
    </div>
  );
}
