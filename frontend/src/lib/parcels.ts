/**
 * Parcelles : libellés, couleurs de la carte, formats (surface, emprise).
 * Partagé entre la carte (client) et les pages (serveur).
 */

export type ParcelStatus = "draft" | "pending_validation" | "active" | "retired";
export type Tone = "success" | "warning" | "danger" | "neutral";

export const PARCEL_STATUS: Record<ParcelStatus, { label: string; tone: Tone; color: string }> = {
  active: { label: "Active", tone: "success", color: "#3a9442" },
  pending_validation: { label: "À vérifier", tone: "warning", color: "#e8aa17" },
  draft: { label: "Brouillon", tone: "neutral", color: "#9aa8a1" },
  retired: { label: "Retirée", tone: "neutral", color: "#6b7a72" },
};

/** Statuts proposés dans le filtre de la carte et de la liste (« retirée » à part). */
export const PARCEL_STATUS_FILTER: [string, string][] = [
  ["", "Tous"],
  ["active", "Actives"],
  ["pending_validation", "À vérifier"],
  ["draft", "Brouillons"],
  ["retired", "Retirées"],
];

export const VALIDATION_STATUS: Record<string, { label: string; tone: Tone }> = {
  valid: { label: "Contour valide", tone: "success" },
  flagged: { label: "Contour signalé", tone: "warning" },
  pending: { label: "Contrôle en cours", tone: "neutral" },
  rejected: { label: "Contour refusé", tone: "danger" },
};

export const CAPTURE_METHODS: Record<string, string> = {
  gps_walk: "Contour marché au GPS",
  gps_points: "Points GPS",
  manual_drawing: "Tracé sur la carte",
  import_geojson: "Import GeoJSON",
  import_kml: "Import KML",
};

export const TENURE_LABELS: Record<string, string> = {
  titled_property: "Titre foncier",
  customary_right: "Droit coutumier",
  family_land: "Terre familiale",
  lease: "Bail",
  communal: "Terre communautaire",
  other: "Autre",
  unknown: "Inconnu",
};

export const VERIFICATION_LABELS: Record<string, string> = {
  declared: "Déclarée",
  documented: "Justifiée",
  disputed: "Contestée",
  confirmed_by_organization: "Confirmée",
};

export const OPERATOR_ROLE_LABELS: Record<string, string> = {
  primary: "Exploitant principal",
  co_operator: "Co-exploitant",
};

export function parcelStatus(status: string) {
  return PARCEL_STATUS[status as ParcelStatus] ?? { label: status, tone: "neutral" as Tone, color: "#9aa8a1" };
}

/** Surface lisible : « 0,25 ha » au-delà de 1 000 m², sinon « 640 m² ». */
export function formatArea(m2: number | string | null | undefined): string {
  const value = Number(m2);
  if (m2 === null || m2 === undefined || m2 === "" || !Number.isFinite(value)) return "—";
  if (value >= 1000) {
    const ha = value / 10_000;
    return `${ha.toLocaleString("fr-FR", { maximumFractionDigits: ha >= 100 ? 0 : 2 })} ha`;
  }
  return `${Math.round(value).toLocaleString("fr-FR")} m²`;
}

/** Hectares pour un indicateur (chiffre seul). */
export function hectares(m2: number | string | null | undefined): string {
  const value = Number(m2 ?? 0);
  if (!Number.isFinite(value) || value <= 0) return "0";
  const ha = value / 10_000;
  return ha.toLocaleString("fr-FR", { maximumFractionDigits: ha >= 100 ? 0 : 1 });
}

export type Bbox = [number, number, number, number];

/** Emprise « minLon,minLat,maxLon,maxLat » pour l'API, arrondie (6 décimales ≈ 10 cm). */
export function bboxParam(b: Bbox): string {
  return b.map((v) => v.toFixed(6)).join(",");
}

/** Valide une emprise venue de l'URL ; null si incohérente. */
export function parseBbox(raw: string | null | undefined): Bbox | null {
  if (!raw) return null;
  const parts = raw.split(",").map(Number);
  if (parts.length !== 4 || parts.some((v) => !Number.isFinite(v))) return null;
  const [a, b, c, d] = parts as Bbox;
  if (!(-180 <= a && a < c && c <= 180 && -90 <= b && b < d && d <= 90)) return null;
  return [a, b, c, d];
}

/** Cadrage initial : emprise des parcelles élargie (une parcelle seule : un peu de marge). */
export function padBbox(b: Bbox, minSpan = 0.01): Bbox {
  const [a, bb, c, d] = b;
  const padLon = Math.max((c - a) * 0.15, minSpan / 2);
  const padLat = Math.max((d - bb) * 0.15, minSpan / 2);
  return [a - padLon, bb - padLat, c + padLon, d + padLat];
}
