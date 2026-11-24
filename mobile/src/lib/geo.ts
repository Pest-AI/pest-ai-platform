/**
 * Dessin des contours sans fond de carte (fonctionne hors ligne) : projection Web Mercator
 * vers un repère SVG, emprise, chemin SVG d'un MultiPolygon GeoJSON.
 */
export type Position = [number, number];
export type MultiPolygon = { type: "MultiPolygon"; coordinates: Position[][][] };
export type Bbox = [number, number, number, number];

const R = 6378137;

export function mercator([lon, lat]: Position): Position {
  const clamped = Math.max(-85, Math.min(85, lat));
  return [(R * lon * Math.PI) / 180, R * Math.log(Math.tan(Math.PI / 4 + (clamped * Math.PI) / 360))];
}

export function bboxOf(geometries: MultiPolygon[]): Bbox | null {
  let b: Bbox | null = null;
  for (const g of geometries) {
    for (const polygon of g.coordinates) {
      for (const ring of polygon) {
        for (const [x, y] of ring) {
          b = b ? [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)] : [x, y, x, y];
        }
      }
    }
  }
  return b;
}

export type Projector = { width: number; height: number; project: (p: Position) => Position };

/** Repère qui fait tenir l'emprise dans width × height (marge en pixels), sans déformation. */
export function projector(bbox: Bbox, width: number, height: number, margin = 16): Projector {
  const [x0, y0] = mercator([bbox[0], bbox[1]]);
  const [x1, y1] = mercator([bbox[2], bbox[3]]);
  const spanX = Math.max(x1 - x0, 20); // 20 m au moins : une parcelle isolée reste lisible
  const spanY = Math.max(y1 - y0, 20);
  const scale = Math.min((width - 2 * margin) / spanX, (height - 2 * margin) / spanY);
  const offX = (width - spanX * scale) / 2 - (x0 - (spanX - (x1 - x0)) / 2) * scale;
  const offY = (height - spanY * scale) / 2 + (y1 + (spanY - (y1 - y0)) / 2) * scale;
  return {
    width,
    height,
    project: (p) => {
      const [x, y] = mercator(p);
      return [x * scale + offX, offY - y * scale];
    },
  };
}

/** Chemin SVG (anneaux fermés, trous compris : règle evenodd). */
export function svgPath(geometry: MultiPolygon, proj: Projector): string {
  return geometry.coordinates
    .flatMap((polygon) =>
      polygon.map(
        (ring) =>
          ring
            .map((p, i) => {
              const [x, y] = proj.project(p);
              return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
            })
            .join(" ") + " Z",
      ),
    )
    .join(" ");
}

/** Distance en mètres entre deux points (formule de haversine). */
export function distanceM(a: Position, b: Position): number {
  const rad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * rad;
  const dLon = (b[0] - a[0]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

export function formatDistance(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} km`;
}

export function formatArea(m2: number | string | null | undefined): string {
  const v = Number(m2);
  if (m2 === null || m2 === undefined || m2 === "" || !Number.isFinite(v)) return "—";
  if (v >= 1000) return `${(v / 10_000).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} ha`;
  return `${Math.round(v).toLocaleString("fr-FR")} m²`;
}
