import { colors } from "@/theme";

export const PARCEL_STATUS_LABELS: Record<string, string> = {
  active: "Active",
  pending_validation: "À vérifier",
  draft: "Brouillon",
  retired: "Retirée",
};

export const STATUS_COLORS: Record<string, string> = {
  active: colors.leaf,
  pending_validation: colors.gold,
  draft: "#9AA8A1",
  retired: "#6B7A72",
};

export const STATUS_TONES: Record<string, "success" | "warning" | "neutral"> = {
  active: "success",
  pending_validation: "warning",
  draft: "neutral",
  retired: "neutral",
};

export const VALIDATION_LABELS: Record<string, string> = {
  valid: "Contour valide",
  flagged: "Contour signalé",
  pending: "Contrôle en cours",
  rejected: "Contour refusé",
};

export const CAPTURE_LABELS: Record<string, string> = {
  gps_walk: "Contour marché au GPS",
  gps_points: "Points GPS",
  manual_drawing: "Tracé sur la carte",
  import_geojson: "Import GeoJSON",
  import_kml: "Import KML",
};
