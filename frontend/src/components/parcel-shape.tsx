"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import type { Map as MapLibreMap } from "maplibre-gl";
import { useEffect, useRef } from "react";

/**
 * Contour d'une parcelle sur fond satellite (fiche parcelle) : version courante en couleur,
 * versions précédentes en pointillé si fournies.
 */

const SATELLITE = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

type Geometry = { type: string; coordinates: unknown };

function bounds(geometries: Geometry[]): [[number, number], [number, number]] | null {
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
  geometries.forEach((g) => walk(g.coordinates));
  return Number.isFinite(minX) ? [[minX, minY], [maxX, maxY]] : null;
}

export function ParcelShape({ current, previous = [], color }: { current: Geometry; previous?: Geometry[]; color: string }) {
  const container = useRef<HTMLDivElement>(null);
  const key = JSON.stringify([current, previous.length]);

  useEffect(() => {
    let cancelled = false;
    let map: MapLibreMap | null = null;
    const box = bounds([current, ...previous]);
    import("maplibre-gl").then(({ Map, ScaleControl, AttributionControl }) => {
      if (cancelled || !container.current || !box) return;
      map = new Map({
        container: container.current,
        bounds: box,
        fitBoundsOptions: { padding: 40, maxZoom: 18 },
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
            current: { type: "geojson", data: { type: "Feature", properties: {}, geometry: current as never } },
            previous: {
              type: "geojson",
              data: {
                type: "FeatureCollection",
                features: previous.map((g) => ({ type: "Feature", properties: {}, geometry: g as never })),
              },
            },
          },
          layers: [
            { id: "fond", type: "background", paint: { "background-color": "#16301f" } },
            { id: "satellite", type: "raster", source: "satellite" },
            {
              id: "previous",
              type: "line",
              source: "previous",
              paint: { "line-color": "#ffffff", "line-width": 1.5, "line-opacity": 0.7, "line-dasharray": [2, 2] },
            },
            { id: "surface", type: "fill", source: "current", paint: { "fill-color": color, "fill-opacity": 0.3 } },
            { id: "contour", type: "line", source: "current", paint: { "line-color": color, "line-width": 2.5 } },
          ],
        },
      });
      map.addControl(new ScaleControl({ unit: "metric", maxWidth: 100 }), "bottom-right");
      map.addControl(new AttributionControl({ compact: true }), "bottom-right");
      // Crédits repliés derrière le bouton « i » (ils masqueraient la légende).
      map.getContainer().querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show");
    });
    return () => {
      cancelled = true;
      map?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- redessiner seulement si le contour change
  }, [key]);

  return (
    <div
      ref={container}
      role="img"
      aria-label="Contour de la parcelle sur image satellite"
      className="h-[320px] overflow-hidden rounded-2xl bg-[#16301f] sm:h-[380px]"
    />
  );
}
