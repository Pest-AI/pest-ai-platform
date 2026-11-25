/**
 * Mesures du sol au kit de terrain (J20c). Paramètres, unités et plages servis par l'API
 * (`/parcels/site-referentials/`, clé `soil_parameters`) : on ajuste la liste au kit des agents
 * sans nouvelle version de l'app.
 */
import { localStore } from "./local-db";
import type { components } from "./schema";

type S = components["schemas"];
export type SoilParameter = S["SoilParameter"];
export type SoilTest = S["SoilTest"];

/** Saisie en cours : valeurs en texte (virgule ou point), profondeur, modèle du kit. */
export type SoilDraft = { values: Record<string, string>; depth: string; device: string };
export const EMPTY_SOIL: SoilDraft = { values: {}, depth: "", device: "" };

export const DEPTHS: [string, string][] = [
  ["10", "0–10 cm"],
  ["20", "10–20 cm"],
  ["30", "20–30 cm"],
];

export function parseNumber(text: string): number | null {
  const t = text.trim().replace(/\s/g, "").replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

export type SoilCheck = { errors: Record<string, string>; unusual: Record<string, string>; filled: number };

/** Contrôles avant envoi : nombre invalide ou impossible (bloquant), inhabituel (signalé). */
export function checkSoil(params: SoilParameter[], draft: SoilDraft): SoilCheck {
  const errors: Record<string, string> = {};
  const unusual: Record<string, string> = {};
  let filled = 0;
  for (const p of params) {
    const raw = draft.values[p.code];
    if (raw === undefined || raw.trim() === "") continue;
    const n = parseNumber(raw);
    if (n === null) continue;
    filled += 1;
    const unit = p.unit ? ` ${p.unit}` : "";
    if (Number.isNaN(n)) errors[p.code] = "Nombre invalide.";
    else if (n < Number(p.min) || n > Number(p.max)) errors[p.code] = `Impossible : entre ${p.min} et ${p.max}${unit}.`;
    else if (n < Number(p.usual_min) || n > Number(p.usual_max))
      unusual[p.code] = `Inhabituel (souvent ${p.usual_min}–${p.usual_max}${unit}) : vérifiez la lecture.`;
  }
  return { errors, unusual, filled };
}

/** Corps d'envoi d'une mesure (null si rien n'est saisi). */
export function soilBody(params: SoilParameter[], draft: SoilDraft, position?: [number, number] | null) {
  const values: Record<string, string> = {};
  for (const p of params) {
    const n = parseNumber(draft.values[p.code] ?? "");
    if (n !== null && !Number.isNaN(n)) values[p.code] = n.toFixed(Math.min(p.decimals, 3));
  }
  if (!Object.keys(values).length) return null;
  return {
    values,
    method: "field_kit",
    device_model: draft.device.trim(),
    depth_cm: draft.depth ? Number(draft.depth) : null,
    measured_at: new Date().toISOString(),
    ...(position ? { position } : {}),
  };
}

/** « 6,8 » ; unité accolée sauf pour le pH. */
export function formatSoilValue(value: string, unit: string): string {
  const v = value.replace(".", ",");
  return unit ? `${v} ${unit}` : v;
}

// Dernier modèle de kit utilisé sur ce téléphone (prérempli à la mesure suivante).
const kitStore = localStore("pestai-brouillons");
export const lastKitModel = () => kitStore.get("kit-model").catch(() => null);
export const rememberKitModel = (model: string) =>
  model.trim() ? kitStore.set("kit-model", model.trim()).catch(() => undefined) : Promise.resolve();
