"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import type { Map as MapLibreMap, Popup as MapLibrePopup } from "maplibre-gl";
import { useEffect, useRef } from "react";

import { LINE_STATUS, type LineStatus } from "@/lib/parcel-imports";

/**
 * Aperçu d'un import sur fond satellite : contours et points colorés selon le statut de la
 * ligne (prête, à vérifier, refusée). Un clic affiche le numéro de ligne et le nom.
 */

const SATELLITE = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

export type ImportMapRow = {
  index: number;
  label: string;
  status: LineStatus;
  geometry: { type: string; coordinates: unknown } | null;
};

function bounds(rows: ImportMapRow[]): [[number, number], [number, number]] | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const walk = (c: unknown) => {
    if (Array.isArray(c) && typeof c[0] === "number") {
      const [x, y] = c as [number, number];
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    } else if (Array.isArray(c)) c.forEach(walk);
  };
  rows.forEach((r) => r.geometry && walk(r.geometry.coordinates));
  return Number.isFinite(minX) ? [[minX, minY], [maxX, maxY]] : null;
}

const COLOR = [
  "match",
  ["get", "status"],
  "ok",
  LINE_STATUS.ok.color,
  "flagged",
  LINE_STATUS.flagged.color,
  LINE_STATUS.refused.color,
] as const;

// « geometry-type » distingue Polygon et MultiPolygon selon la version de MapLibre.
const POLYGONS = ["in", ["geometry-type"], ["literal", ["Polygon", "MultiPolygon"]]] as never;
const POINTS = ["in", ["geometry-type"], ["literal", ["Point", "MultiPoint"]]] as never;

export function ImportMap({ rows }: { rows: ImportMapRow[] }) {
  const container = useRef<HTMLDivElement>(null);
  const key = JSON.stringify(rows.map((r) => [r.index, r.status]));

  useEffect(() => {
    let cancelled = false;
    let map: MapLibreMap | null = null;
    let popup: MapLibrePopup | null = null;
    const box = bounds(rows);
    const data = {
      type: "FeatureCollection" as const,
      features: rows
        .filter((r) => r.geometry)
        .map((r) => ({
          type: "Feature" as const,
          properties: { index: r.index, label: r.label, status: r.status },
          geometry: r.geometry as never,
        })),
    };
    import("maplibre-gl").then(({ Map, Popup, ScaleControl, AttributionControl, NavigationControl }) => {
      if (cancelled || !container.current || !box) return;
      map = new Map({
        container: container.current,
        bounds: box,
        fitBoundsOptions: { padding: 40, maxZoom: 17 },
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
            lines: { type: "geojson", data },
          },
          layers: [
            { id: "fond", type: "background", paint: { "background-color": "#16301f" } },
            { id: "satellite", type: "raster", source: "satellite" },
            {
              id: "surface",
              type: "fill",
              source: "lines",
              filter: POLYGONS,
              paint: { "fill-color": COLOR as never, "fill-opacity": 0.3 },
            },
            {
              id: "contour",
              type: "line",
              source: "lines",
              filter: POLYGONS,
              paint: { "line-color": COLOR as never, "line-width": 2 },
            },
            {
              id: "points",
              type: "circle",
              source: "lines",
              filter: POINTS,
              paint: {
                "circle-color": COLOR as never,
                "circle-radius": 6,
                "circle-stroke-color": "#ffffff",
                "circle-stroke-width": 2,
              },
            },
          ],
        },
      });
      map.addControl(new NavigationControl({ showCompass: false }), "top-right");
      map.addControl(new ScaleControl({ unit: "metric", maxWidth: 100 }), "bottom-right");
      map.addControl(new AttributionControl({ compact: true }), "bottom-right");
      map.getContainer().querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show");
      for (const layer of ["surface", "points"]) {
        map.on("mouseenter", layer, () => map && (map.getCanvas().style.cursor = "pointer"));
        map.on("mouseleave", layer, () => map && (map.getCanvas().style.cursor = ""));
        map.on("click", layer, (e) => {
          const f = e.features?.[0];
          if (!f || !map) return;
          const { index, label, status } = f.properties as { index: number; label: string; status: LineStatus };
          const node = document.createElement("div");
          node.className = "text-[13px] leading-5";
          const title = document.createElement("strong");
          title.textContent = `Ligne ${index}`;
          const name = document.createElement("div");
          name.textContent = label || "Sans nom";
          const state = document.createElement("div");
          state.textContent = LINE_STATUS[status]?.label ?? status;
          state.style.color = LINE_STATUS[status]?.color ?? "inherit";
          node.append(title, name, state);
          popup?.remove();
          popup = new Popup({ closeButton: false, offset: 8 }).setLngLat(e.lngLat).setDOMContent(node).addTo(map);
        });
      }
    });
    return () => {
      cancelled = true;
      popup?.remove();
      map?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- redessiner seulement si les lignes changent
  }, [key]);

  if (!bounds(rows)) {
    return (
      <div className="grid h-[320px] place-items-center rounded-2xl bg-surface text-[13px] text-muted">
        Aucune géométrie lisible dans ce fichier.
      </div>
    );
  }
  return (
    <div
      ref={container}
      role="img"
      aria-label="Aperçu des parcelles du fichier sur image satellite"
      style={{ position: "relative" }}
      className="h-[320px] overflow-hidden rounded-2xl bg-[#16301f] sm:h-[420px]"
    />
  );
}
