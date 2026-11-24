"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import { ArrowRight, Crosshair, Expand, Layers, Loader2, Minus, Pentagon, Plus, Ruler, Search, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { GeoJSONSource, Map as MapLibreMap, MapLayerMouseEvent } from "maplibre-gl";
import { useCallback, useEffect, useRef, useState } from "react";

import { AgroIdBadge } from "@/components/agroid-badge";
import { StatusPill } from "@/components/list-toolbar";
import { type Bbox, PARCEL_STATUS, bboxParam, formatArea, parcelStatus } from "@/lib/parcels";
import { cn } from "@/lib/utils";

/**
 * Carte des parcelles (vue d'ensemble, maquette AI Studio).
 *
 * - Fond satellite ou plan ; contours chargés pour la zone affichée (`/parcelles/carte`),
 *   à chaque déplacement, avec les filtres de la page (statut, exploitant, campagne, culture).
 * - Couleur selon le statut ; clic sur une parcelle : carte d'identité et lien vers sa fiche.
 * - Recherche par AgroID (saisie tolérée) ou par nom : la carte se centre sur la parcelle.
 */

const SATELLITE = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const PLAN = "https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png";
const EMPTY = { type: "FeatureCollection" as const, features: [] };

export type MapView = { center: [number, number]; zoom: number };
export type MapFilters = { status?: string; producer?: string; campaign?: string; crop?: string };

type Props = {
  view: MapView;
  /** Emprise des parcelles de l'espace : la carte s'y cadre au chargement. */
  fitBbox?: Bbox | null;
  filters?: MapFilters;
  /** Nombre total de parcelles de l'espace (0 : message d'invitation). */
  total: number;
  emptyLabel: string;
  heightClass?: string;
};

type Selected = { id: string; agroid: string | null; local_name: string; status: string; area_m2: string; validation_status: string };
type Found = { id: string; agroid: string | null; local_name: string; status: string; centroid: [number, number] | null };

const STATUS_COLOR = [
  "match",
  ["get", "status"],
  "active",
  PARCEL_STATUS.active.color,
  "pending_validation",
  PARCEL_STATUS.pending_validation.color,
  "retired",
  PARCEL_STATUS.retired.color,
  PARCEL_STATUS.draft.color,
] as unknown as string;

const LEGEND: [string, string][] = [
  [PARCEL_STATUS.active.color, "Active"],
  [PARCEL_STATUS.pending_validation.color, "À vérifier"],
  [PARCEL_STATUS.draft.color, "Brouillon"],
];

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

export function ParcelMap({ view, fitBbox, filters, total, emptyLabel, heightClass }: Props) {
  const router = useRouter();
  const container = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const request = useRef<AbortController | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const filtersRef = useRef(filters);
  const [base, setBase] = useState<"satellite" | "plan">("satellite");
  const [cursor, setCursor] = useState({ lat: view.center[1], lng: view.center[0], zoom: view.zoom });
  const [shown, setShown] = useState<{ count: number; truncated: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<Selected | null>(null);
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<Found[] | null>(null);
  const [searching, setSearching] = useState(false);

  const selectedId = useRef<string | null>(null);
  const select = useCallback((props: Selected | null) => {
    selectedId.current = props?.id ?? null;
    setSelected(props);
    const m = map.current;
    if (m?.getLayer("parcelles-selection")) {
      m.setFilter("parcelles-selection", ["==", ["get", "id"], props?.id ?? ""]);
    }
  }, []);

  /** Charge les contours de la zone affichée (la requête précédente est annulée). */
  const load = useCallback(() => {
    const m = map.current;
    if (!m) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const b = m.getBounds();
      const bbox: Bbox = [
        Math.max(-180, b.getWest()),
        Math.max(-90, b.getSouth()),
        Math.min(180, b.getEast()),
        Math.min(90, b.getNorth()),
      ];
      const params = new URLSearchParams({ bbox: bboxParam(bbox) });
      const f = filtersRef.current;
      if (f?.status) params.set("statut", f.status);
      if (f?.producer) params.set("producteur", f.producer);
      if (f?.campaign) params.set("campagne", f.campaign);
      if (f?.crop) params.set("culture", f.crop);
      request.current?.abort();
      const controller = new AbortController();
      request.current = controller;
      setLoading(true);
      try {
        const res = await fetch(`/parcelles/carte?${params}`, { signal: controller.signal, cache: "no-store" });
        if (res.redirected || res.status === 401) {
          router.push("/connexion?erreur=session");
          return;
        }
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        (m.getSource("parcelles") as GeoJSONSource | undefined)?.setData(data);
        // Parcelle sélectionnée (par la recherche) : compléter sa carte avec les données chargées.
        const match = data.features.find((f: { properties: Selected }) => f.properties.id === selectedId.current);
        if (match) setSelected(match.properties as Selected);
        setShown({ count: data.features.length, truncated: Boolean(data.truncated) });
        setFailed(false);
      } catch (error) {
        if ((error as Error).name !== "AbortError") setFailed(true);
      } finally {
        if (request.current === controller) setLoading(false);
      }
    }, 250);
  }, [router]);

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
            plan: { type: "raster", tiles: [PLAN], tileSize: 256, attribution: "© OpenStreetMap, © CARTO" },
            parcelles: { type: "geojson", data: EMPTY },
          },
          layers: [
            { id: "fond", type: "background", paint: { "background-color": "#16301f" } },
            { id: "satellite", type: "raster", source: "satellite" },
            { id: "plan", type: "raster", source: "plan", layout: { visibility: "none" } },
            {
              id: "parcelles-surface",
              type: "fill",
              source: "parcelles",
              paint: { "fill-color": STATUS_COLOR, "fill-opacity": 0.28 },
            },
            {
              id: "parcelles-contour",
              type: "line",
              source: "parcelles",
              paint: { "line-color": STATUS_COLOR, "line-width": ["interpolate", ["linear"], ["zoom"], 10, 1, 16, 2.5] },
            },
            {
              id: "parcelles-selection",
              type: "line",
              source: "parcelles",
              filter: ["==", ["get", "id"], ""],
              paint: { "line-color": "#ffffff", "line-width": 3.5 },
            },
          ],
        },
      });
      instance.addControl(new ScaleControl({ unit: "metric", maxWidth: 110 }), "bottom-right");
      instance.addControl(new AttributionControl({ compact: true }), "bottom-right");
      // Crédits repliés derrière le bouton « i » (ils masqueraient la légende).
      instance.getContainer().querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show");
      if (fitBbox) {
        instance.fitBounds(
          [
            [fitBbox[0], fitBbox[1]],
            [fitBbox[2], fitBbox[3]],
          ],
          { padding: 48, maxZoom: 16, duration: 0 },
        );
      }
      const update = (lng: number, lat: number) => setCursor({ lng, lat, zoom: instance?.getZoom() ?? view.zoom });
      instance.on("mousemove", (e) => update(e.lngLat.lng, e.lngLat.lat));
      instance.on("zoomend", () => setCursor((c) => ({ ...c, zoom: instance?.getZoom() ?? c.zoom })));
      instance.on("load", load);
      instance.on("moveend", load);
      instance.on("click", "parcelles-surface", (e: MapLayerMouseEvent) => {
        const props = e.features?.[0]?.properties as Selected | undefined;
        if (props) select(props);
      });
      instance.on("click", (e) => {
        if (!instance?.queryRenderedFeatures(e.point, { layers: ["parcelles-surface"] }).length) select(null);
      });
      instance.on("mouseenter", "parcelles-surface", () => {
        if (instance) instance.getCanvas().style.cursor = "pointer";
      });
      instance.on("mouseleave", "parcelles-surface", () => {
        if (instance) instance.getCanvas().style.cursor = "";
      });
      map.current = instance;
    });
    return () => {
      cancelled = true;
      request.current?.abort();
      if (timer.current) clearTimeout(timer.current);
      instance?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recréer la carte seulement si le cadrage change
  }, [view.center[0], view.center[1], view.zoom]);

  // Nouveaux filtres (URL) : recharger la zone affichée.
  const status = filters?.status;
  const producer = filters?.producer;
  const campaign = filters?.campaign;
  const crop = filters?.crop;
  useEffect(() => {
    filtersRef.current = { status, producer, campaign, crop };
    if (map.current?.loaded()) load();
  }, [status, producer, campaign, crop, load]);

  const switchBase = (next: "satellite" | "plan") => {
    setBase(next);
    const m = map.current;
    if (!m) return;
    m.setLayoutProperty("satellite", "visibility", next === "satellite" ? "visible" : "none");
    m.setLayoutProperty("plan", "visibility", next === "plan" ? "visible" : "none");
  };

  const goTo = (item: Found) => {
    setFound(null);
    // Sélection immédiate ; la surface s'ajoute quand la zone est chargée (voir load).
    select({ id: item.id, agroid: item.agroid, local_name: item.local_name, status: item.status, area_m2: "", validation_status: "" });
    if (item.centroid) map.current?.flyTo({ center: item.centroid, zoom: Math.max(map.current.getZoom(), 16) });
  };

  const search = async (event: React.FormEvent) => {
    event.preventDefault();
    const q = query.trim();
    if (q.length < 2) return;
    setSearching(true);
    try {
      const res = await fetch(`/parcelles/localiser?q=${encodeURIComponent(q)}`, { cache: "no-store" });
      const data = res.ok ? ((await res.json()) as { results: Found[] }) : { results: [] };
      if (data.results.length === 1 && data.results[0]) goTo(data.results[0]);
      else setFound(data.results);
    } finally {
      setSearching(false);
    }
  };

  const selectedStatus = selected ? parcelStatus(selected.status) : null;
  const centerChip =
    total === 0
      ? emptyLabel
      : failed
        ? "Impossible de charger les parcelles. Réessayez en déplaçant la carte."
        : shown && shown.count === 0 && !loading
          ? status || producer || campaign || crop
            ? "Aucune parcelle ne correspond aux filtres dans cette zone"
            : "Aucune parcelle dans cette zone"
          : null;

  return (
    <div
      ref={frame}
      className={cn(
        "relative overflow-hidden rounded-2xl bg-[#16301f] shadow-[0_8px_24px_-12px_rgb(11_25_41/0.35)]",
        heightClass ?? "h-[460px] sm:h-[560px] lg:h-[620px]",
      )}
    >
      {/* Position en style direct : la feuille de MapLibre (.maplibregl-map { position: relative })
          n'est pas dans une couche CSS et l'emporterait sur les classes Tailwind. */}
      <div ref={container} style={{ position: "absolute", inset: 0 }} aria-label="Carte des parcelles" role="region" />

      {/* Barre d'outils flottante */}
      <div className="absolute top-3 right-3 left-3 flex flex-wrap items-start gap-2 sm:right-auto">
        <div className="flex flex-wrap items-center gap-1 rounded-xl border border-white/10 bg-night/80 p-1 shadow-pop backdrop-blur-md">
          <form onSubmit={search} role="search" className="relative">
            <label htmlFor="map-search" className="sr-only">
              Localiser une parcelle par son AgroID ou son nom
            </label>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-white/45" aria-hidden />
            <input
              id="map-search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setFound(null);
              }}
              disabled={total === 0}
              placeholder="Localiser un AgroID, une parcelle…"
              className="h-9 w-48 rounded-lg border border-white/10 bg-white/5 pr-8 pl-9 text-[13px] text-white placeholder:text-white/45 focus:border-gold/60 focus:outline-none disabled:cursor-default sm:w-60"
            />
            {searching ? (
              <Loader2 className="absolute top-1/2 right-2.5 size-4 -translate-y-1/2 animate-spin text-white/60" aria-hidden />
            ) : null}
            {found !== null ? (
              <div className="absolute top-11 left-0 z-10 w-72 overflow-hidden rounded-xl border border-line bg-canvas text-ink shadow-pop">
                {found.length === 0 ? (
                  <p className="px-4 py-3 text-[13px] text-muted">Aucune parcelle trouvée.</p>
                ) : (
                  <ul>
                    {found.map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => goTo(item)}
                          className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-surface"
                        >
                          <AgroIdBadge code={item.agroid} tone="light" />
                          <span className="min-w-0 flex-1 truncate text-[13px]">{item.local_name || "Sans nom"}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </form>
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
          <ToolButton
            label="Recentrer"
            onClick={() =>
              fitBbox
                ? map.current?.fitBounds(
                    [
                      [fitBbox[0], fitBbox[1]],
                      [fitBbox[2], fitBbox[3]],
                    ],
                    { padding: 48, maxZoom: 16 },
                  )
                : map.current?.flyTo({ center: view.center, zoom: view.zoom })
            }
          >
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

      {/* Compteur de la zone affichée */}
      {total > 0 ? (
        <div className="absolute top-3 right-3 max-sm:hidden" aria-live="polite">
          <span className="tabular inline-flex h-9 items-center gap-2 rounded-xl border border-white/10 bg-night/80 px-3 font-mono text-[12px] text-white/90 backdrop-blur-md">
            {loading ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
            {shown ? `${shown.count} / ${total} parcelle${total > 1 ? "s" : ""}` : `${total} parcelle${total > 1 ? "s" : ""}`}
            {shown?.truncated ? <span className="text-gold">· zoomez</span> : null}
          </span>
        </div>
      ) : null}

      {centerChip ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center px-6">
          <span className="rounded-xl border border-white/15 bg-night/75 px-4 py-2.5 text-center text-[13px] font-medium text-white shadow-pop backdrop-blur-md">
            {centerChip}
          </span>
        </div>
      ) : null}

      {/* Parcelle sélectionnée */}
      {selected && selectedStatus ? (
        <div className="absolute right-3 bottom-14 left-3 sm:top-16 sm:bottom-auto sm:left-auto sm:w-80">
          <div className="rounded-2xl border border-line bg-canvas p-4 shadow-pop">
            <div className="flex items-start justify-between gap-2">
              <AgroIdBadge code={selected.agroid} />
              <button
                type="button"
                onClick={() => select(null)}
                aria-label="Fermer"
                className="-m-1 rounded-md p-1 text-muted hover:bg-surface hover:text-ink"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
            <p className="mt-2 truncate text-[16px] font-semibold">{selected.local_name || "Parcelle sans nom"}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusPill tone={selectedStatus.tone}>{selectedStatus.label}</StatusPill>
              {selected.area_m2 ? (
                <span className="tabular font-mono text-[13px] text-muted">{formatArea(selected.area_m2)}</span>
              ) : null}
            </div>
            <Link
              href={`/parcelles/${selected.id}`}
              className="mt-3 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-forest text-[13px] font-semibold text-white hover:bg-forest/90"
            >
              Ouvrir la fiche
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </div>
      ) : null}

      {/* Légende et coordonnées */}
      <div className="absolute bottom-3 left-3 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-3 rounded-xl border border-white/10 bg-night/80 px-3 py-2 text-[12px] text-white/90 backdrop-blur-md">
          {LEGEND.map(([color, label]) => (
            <span key={label} className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm" style={{ backgroundColor: color }} aria-hidden />
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
