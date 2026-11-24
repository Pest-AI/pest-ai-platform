/**
 * Import de parcelles par fichier (J15b) : libellés, droits affichés, rapport CSV.
 * L'API revérifie tout (permission parcels.manage, fichier, lignes).
 */
import type { Tone } from "@/lib/parcels";

export const IMPORT_MAX_BYTES = 10 * 1024 * 1024;
export const IMPORT_ACCEPT = ".kml,.kmz,.zip,.geojson,.json,.csv,.txt";

export const IMPORT_FORMATS: Record<string, string> = {
  kml: "KML",
  kmz: "KMZ",
  shapefile: "Shapefile",
  geojson: "GeoJSON",
  csv: "CSV",
};

const IMPORT_STATUS_LABELS: Record<string, { label: string; tone: Tone }> = {
  previewed: { label: "Aperçu à confirmer", tone: "warning" },
  committed: { label: "Importé", tone: "success" },
  discarded: { label: "Abandonné", tone: "neutral" },
};

export function importStatus(status: string): { label: string; tone: Tone } {
  return IMPORT_STATUS_LABELS[status] ?? { label: status, tone: "neutral" };
}

export type LineStatus = "ok" | "flagged" | "refused";

export const LINE_STATUS: Record<LineStatus, { label: string; tone: Tone; color: string }> = {
  ok: { label: "Prête", tone: "success", color: "#3a9442" },
  flagged: { label: "À vérifier", tone: "warning", color: "#e8aa17" },
  refused: { label: "Refusée", tone: "danger", color: "#d4483b" },
};

export const OPERATOR_KEYS: [string, string][] = [
  ["membership_number", "N° d'adhérent"],
  ["phone", "Téléphone"],
];

export function formatBytes(size: number): string {
  if (size < 1024) return `${size} o`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} Ko`;
  return `${(size / (1024 * 1024)).toFixed(1).replace(".", ",")} Mo`;
}

/** Erreur à afficher avant envoi, ou null si le fichier peut partir. */
export function checkFile(file: { name: string; size: number } | null): string | null {
  if (!file || !file.name) return "Choisissez un fichier.";
  if (file.size === 0) return "Le fichier est vide.";
  if (file.size > IMPORT_MAX_BYTES) return "Fichier trop lourd : 10 Mo au plus. Découpez-le.";
  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  if (!IMPORT_ACCEPT.split(",").includes(`.${ext}`)) {
    return "Format non reconnu. Formats acceptés : KML, KMZ, Shapefile (.zip), GeoJSON, CSV.";
  }
  return null;
}

export type ReportLine = {
  index: number;
  label: string;
  status: LineStatus;
  messages: string[];
  operator?: string | null;
  agroid?: string | null;
  area_m2?: string | null;
};

/** Rapport CSV (séparateur « ; », BOM UTF-8) : s'ouvre directement dans Excel en français. */
export function reportCsv(lines: ReportLine[], committed: boolean): string {
  const cell = (v: unknown) => {
    const text = v === null || v === undefined ? "" : String(v);
    // Neutralise les formules (=, +, -, @) : le fichier vient d'un tiers.
    const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
    return /[";\n\r]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
  };
  const header = ["Ligne", "Nom", "Statut", committed ? "AgroID" : "Surface (m²)", "Exploitant", "Motifs"];
  const rows = lines.map((l) =>
    [
      l.index,
      l.label,
      LINE_STATUS[l.status]?.label ?? l.status,
      committed ? (l.agroid ?? "Non créée") : (l.area_m2 ?? ""),
      l.operator ?? "",
      l.messages.join(" | "),
    ]
      .map(cell)
      .join(";"),
  );
  return `﻿${[header.join(";"), ...rows].join("\r\n")}\r\n`;
}
