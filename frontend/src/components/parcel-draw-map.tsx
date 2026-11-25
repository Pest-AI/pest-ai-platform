"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";

import type { LonLat } from "@/lib/coordinates";
import { type Bbox, bboxParam } from "@/lib/parcels";

/**
 * Carte de saisie d'une parcelle (J15c) sur fond satellite.
 * - `trace` : chaque clic ajoute un sommet du contour ;
 * - `position` : un clic place la parcelle (contour à relever) ;
 * - autres modes : la carte montre seulement les points saisis.
 * Les parcelles déjà enregistrées de la zone sont dessinées en blanc, pour éviter les doublons.
 */

const SATELLITE = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const DEFAULT_CENTER: LonLat = [-15.2, 16.3]; // vallée du fleuve Sénégal
const EMPTY = { type: "FeatureCollection" as const, features: [] };
/** En dessous, un clic couvrirait des centaines de mètres : on demande de zoomer. */
const MIN_DRAW_ZOOM = 14;

export type DrawMode = "trace" | "coordonnees" | "position" | "aucune";

function shapeData(points: LonLat[], mode: DrawMode) {
  const features: unknown[] = points.map((p, i) => ({
    type: "Feature",
    properties: { first: i === 0 },
    geometry: { type: "Point", coordinates: p },
  }));
  if (mode !== "position" && points.length >= 2) {
    const ring = points.length >= 3 ? [...points, points[0]] : points;
    features.push({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: ring } });
    if (points.length >= 3) {
      features.push({ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [ring] } });
    }
  }
  return { type: "FeatureCollection" as const, features: features as never[] };
}

export function ParcelDrawMap({
  mode,
  points,
  onAdd,
  bbox,
  reference,
  label = "Carte de saisie de la parcelle",
  maxZoom = 16,
}: {
  mode: DrawMode;
  points: LonLat[];
  onAdd: (point: LonLat) => void;
  bbox: Bbox | null;
  /** Repères fixes (J19) : contour de la parcelle et unités existantes, en GeoJSON. */
  reference?: { type: "FeatureCollection"; features: unknown[] };
  label?: string;
  /** Zoom maximal du cadrage initial (une unité se trace de plus près qu'une parcelle). */
  maxZoom?: number;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const onAddRef = useRef(onAdd);
  const modeRef = useRef(mode);
  const pointsRef = useRef(points);
  const [zoom, setZoom] = useState(0);
  useEffect(() => {
    onAddRef.current = onAdd;
    modeRef.current = mode;
    pointsRef.current = points;
  }, [onAdd, mode, points]);

  useEffect(() => {
    let cancelled = false;
    import("maplibre-gl").then(({ Map, NavigationControl, ScaleControl, AttributionControl }) => {
      if (cancelled || !container.current) return;
      const m = new Map({
        container: container.current,
        ...(bbox
          ? { bounds: [[bbox[0], bbox[1]], [bbox[2], bbox[3]]] as [[number, number], [number, number]], fitBoundsOptions: { padding: 30, maxZoom } }
          : { center: DEFAULT_CENTER, zoom: 8 }),
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
            existing: { type: "geojson", data: EMPTY },
            reference: { type: "geojson", data: (reference ?? EMPTY) as never },
            shape: { type: "geojson", data: EMPTY },
          },
          layers: [
            { id: "fond", type: "background", paint: { "background-color": "#16301f" } },
            { id: "satellite", type: "raster", source: "satellite" },
            {
              id: "existing",
              type: "line",
              source: "existing",
              paint: { "line-color": "#ffffff", "line-width": 1.5, "line-opacity": 0.8, "line-dasharray": [3, 2] },
            },
            {
              id: "reference-fill",
              type: "fill",
              source: "reference",
              filter: ["==", ["get", "kind"], "unit"],
              paint: { "fill-color": "#7fc58f", "fill-opacity": 0.25 },
            },
            {
              id: "reference-line",
              type: "line",
              source: "reference",
              paint: {
                "line-color": ["case", ["==", ["get", "kind"], "parcel"], "#ffffff", "#7fc58f"],
                "line-width": ["case", ["==", ["get", "kind"], "parcel"], 3, 1.5],
              },
            },
            {
              id: "shape-fill",
              type: "fill",
              source: "shape",
              filter: ["==", ["geometry-type"], "Polygon"],
              paint: { "fill-color": "#e8aa17", "fill-opacity": 0.25 },
            },
            {
              id: "shape-line",
              type: "line",
              source: "shape",
              filter: ["==", ["geometry-type"], "LineString"],
              paint: { "line-color": "#e8aa17", "line-width": 2.5 },
            },
            {
              id: "shape-points",
              type: "circle",
              source: "shape",
              filter: ["==", ["geometry-type"], "Point"],
              paint: {
                "circle-radius": ["case", ["get", "first"], 7, 5],
                "circle-color": "#e8aa17",
                "circle-stroke-color": "#ffffff",
                "circle-stroke-width": 2,
              },
            },
          ],
        },
      });
      m.addControl(new NavigationControl({ showCompass: false }), "top-right");
      m.addControl(new ScaleControl({ unit: "metric", maxWidth: 100 }), "bottom-right");
      m.addControl(new AttributionControl({ compact: true }), "bottom-right");
      m.getContainer().querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show");
      m.doubleClickZoom.disable();
      m.on("click", (e) => {
        if (m.getZoom() < MIN_DRAW_ZOOM) return;
        if (modeRef.current === "trace" || modeRef.current === "position") onAddRef.current([e.lngLat.lng, e.lngLat.lat]);
      });
      m.on("zoomend", () => setZoom(m.getZoom()));
      m.on("load", () => {
        setZoom(m.getZoom());
        (m.getSource("shape") as GeoJSONSource | undefined)?.setData(shapeData(pointsRef.current, modeRef.current));
      });
      const loadExisting = async () => {
        if (m.getZoom() < 12) return void (m.getSource("existing") as GeoJSONSource | undefined)?.setData(EMPTY);
        const b = m.getBounds();
        try {
          const res = await fetch(`/parcelles/carte?bbox=${bboxParam([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()])}`);
          if (res.ok) (m.getSource("existing") as GeoJSONSource | undefined)?.setData(await res.json());
        } catch {
          /* les parcelles voisines sont un repère : leur absence ne bloque pas la saisie */
        }
      };
      m.on("load", loadExisting);
      m.on("moveend", loadExisting);
      map.current = m;
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- carte créée une seule fois
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    // La source existe dès que le style est chargé, même si les tuiles satellite ne le sont pas
    // (isStyleLoaded() attend aussi les tuiles) ; sinon l'événement « load » s'en charge.
    (m.getSource("shape") as GeoJSONSource | undefined)?.setData(shapeData(points, mode));
    m.getCanvas().style.cursor = mode === "trace" || mode === "position" ? "crosshair" : "";
  }, [points, mode]);

  /** Recadre sur les coordonnées saisies au clavier. */
  useEffect(() => {
    const m = map.current;
    if (!m || mode !== "coordonnees" || points.length === 0) return;
    const xs = points.map((p) => p[0]);
    const ys = points.map((p) => p[1]);
    m.fitBounds(
      [
        [Math.min(...xs), Math.min(...ys)],
        [Math.max(...xs), Math.max(...ys)],
      ],
      { padding: 60, maxZoom: 17, duration: 400 },
    );
  }, [points, mode]);

  const tooFar = (mode === "trace" || mode === "position") && zoom > 0 && zoom < MIN_DRAW_ZOOM;
  return (
    <div className="relative">
      <div
        ref={container}
        role="application"
        aria-label={label}
        style={{ position: "relative" }}
        className="h-[360px] overflow-hidden rounded-2xl bg-[#16301f] sm:h-[480px]"
      />
      {tooFar ? (
        <p
          role="status"
          className="pointer-events-none absolute bottom-10 left-1/2 -translate-x-1/2 rounded-full bg-night/85 px-4 py-2 text-[13px] font-medium text-white"
        >
          Zoomez sur le champ pour placer les points
        </p>
      ) : null}
    </div>
  );
}
