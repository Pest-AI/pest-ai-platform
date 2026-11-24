/**
 * Coordonnées recopiées d'un papier ou d'un GPS : une position par ligne, latitude d'abord
 * (comme l'affichent les GPS). Formats acceptés :
 *   16.6512, -14.9634        16,6512 ; -14,9634        16.6512 -14.9634
 *   16°39'04.3"N 14°57'48.2"W        N16 39.072 W14 57.803
 * Sortie en [longitude, latitude] (ordre GeoJSON).
 */

export type LonLat = [number, number];
export type ParsedLine = { line: number; point?: LonLat; error?: string };

function num(text: string): number {
  return Number(text.replace(",", "."));
}

/** Degrés-minutes-secondes avec lettres N/S/E/W (O = ouest), avant ou après les nombres. */
function parseDms(text: string): LonLat | null {
  const tokens = text.match(/[NSEWO]|\d+(?:[.,]\d+)?/gi);
  if (!tokens || !/^[NSEWO]$/i.test(tokens.find((t) => /^[NSEWO]$/i.test(t)) ?? "")) return null;
  const prefix = /^[NSEWO]$/i.test(tokens[0]);
  const groups: { letter: string; nums: number[] }[] = [];
  let current = { letter: "", nums: [] as number[] };
  for (const token of tokens) {
    if (/^[NSEWO]$/i.test(token)) {
      if (prefix) {
        if (current.nums.length) groups.push(current);
        current = { letter: token.toUpperCase(), nums: [] };
      } else {
        groups.push({ letter: token.toUpperCase(), nums: current.nums });
        current = { letter: "", nums: [] };
      }
    } else current.nums.push(num(token));
  }
  if (prefix && current.nums.length) groups.push(current);
  let lat: number | null = null;
  let lon: number | null = null;
  for (const { letter, nums } of groups) {
    if (!nums.length || nums.length > 3) return null;
    const [d = 0, m = 0, sec = 0] = nums;
    const value = d + m / 60 + sec / 3600;
    if (letter === "N" || letter === "S") lat = letter === "S" ? -value : value;
    else lon = letter === "W" || letter === "O" ? -value : value;
  }
  return lat !== null && lon !== null ? [lon, lat] : null;
}

/** Deux nombres décimaux, latitude puis longitude. */
function parseDecimal(text: string): LonLat | null {
  const t = text.trim();
  let parts: string[];
  if (/[;\t]/.test(t)) parts = t.split(/[;\t]+/);
  else if (/\s/.test(t.replace(/\s*,\s+/g, " "))) parts = t.replace(/\s*,\s+/g, " ").split(/\s+/);
  else parts = t.split(",");
  const values = parts.map((p) => p.trim()).filter(Boolean);
  if (values.length !== 2 || !values.every((v) => /^-?\d+(?:[.,]\d+)?$/.test(v))) return null;
  const [lat, lon] = values.map(num) as [number, number];
  return [lon, lat];
}

export function parseCoordinates(text: string): ParsedLine[] {
  const out: ParsedLine[] = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    const point = parseDms(line) ?? parseDecimal(line);
    if (!point) {
      out.push({ line: i + 1, error: "illisible : écrivez « latitude, longitude »" });
      return;
    }
    const [lon, lat] = point;
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      out.push({ line: i + 1, error: "hors limites (latitude d'abord, puis longitude)" });
      return;
    }
    out.push({ line: i + 1, point });
  });
  return out;
}

/** Surface approchée d'un anneau en m² (projection locale) : affichage seulement. */
export function ringAreaM2(points: LonLat[]): number {
  if (points.length < 3) return 0;
  const lat0 = (points.reduce((s, p) => s + p[1], 0) / points.length) * (Math.PI / 180);
  const mx = 111_320 * Math.cos(lat0);
  const my = 110_540;
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i] as LonLat;
    const [x2, y2] = points[(i + 1) % points.length] as LonLat;
    sum += x1 * mx * (y2 * my) - x2 * mx * (y1 * my);
  }
  return Math.abs(sum) / 2;
}

/** Anneau fermé GeoJSON à partir des sommets (le premier point est répété à la fin). */
export function polygonFrom(points: LonLat[]): { type: "Polygon"; coordinates: LonLat[][] } {
  const ring = [...points];
  const [first, last] = [ring[0], ring[ring.length - 1]];
  if (first && last && (first[0] !== last[0] || first[1] !== last[1])) ring.push(first);
  return { type: "Polygon", coordinates: [ring] };
}
