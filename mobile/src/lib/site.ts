/**
 * Profil de site d'une parcelle (J18d) : sol, eau et irrigation, accès. Les listes viennent de
 * l'API (`/api/v1/parcels/site-referentials/`) : l'agronome les fait évoluer sans nouvelle
 * version de l'app. Gardées en mémoire pour la session.
 */
import { useEffect, useState } from "react";

import { api } from "./client";
import { cachedGet } from "./offline-cache";
import type { components } from "./schema";

type S = components["schemas"];
export type SiteReferentials = S["SiteReferentials"];
export type SiteProfile = S["SiteProfile"];
export type SiteValues = Record<string, string>;

export const WATER_FIELDS = ["water_regime", "water_source", "irrigation_method", "scheme_type", "pump_access", "water_availability"] as const;
export const SOIL_FIELDS = ["soil_local_type", "soil_texture", "salinity", "flooding", "slope", "perceived_fertility"] as const;
export const ACCESS_FIELDS = ["road_access"] as const;

export const FIELD_LABELS: Record<string, string> = {
  water_regime: "Régime hydrique",
  water_source: "Source d'eau",
  irrigation_method: "Mode d'irrigation",
  scheme_type: "Aménagement",
  pump_access: "Motopompe",
  water_availability: "Eau disponible",
  soil_local_type: "Type de sol (nom local)",
  soil_texture: "Texture",
  salinity: "Salinité constatée",
  flooding: "Inondation",
  slope: "Pente",
  perceived_fertility: "Fertilité perçue",
  road_access: "Accès à la parcelle",
};

let cache: SiteReferentials | null = null;

export function useSiteReferentials(workspace: string | null) {
  const [refs, setRefs] = useState<SiteReferentials | null>(cache);
  useEffect(() => {
    if (cache || !workspace) return;
    cachedGet<SiteReferentials>(api, "/api/v1/parcels/site-referentials/", { workspace })
      .then(({ data, offline }) => {
        if (!offline) cache = data;
        setRefs(data);
      })
      .catch(() => undefined);
  }, [workspace]);
  return refs;
}

export function options(refs: SiteReferentials | null, field: string): [string, string][] {
  return (refs?.fields[field] ?? []).map((i) => [i.value, i.label]);
}

export function labelOf(refs: SiteReferentials | null, field: string, value: string | null | undefined): string {
  if (!value) return "";
  return refs?.fields[field]?.find((i) => i.value === value)?.label ?? value;
}

/** Au moins une information de sol, d'eau ou d'accès choisie. */
export function hasSiteData(values: SiteValues): boolean {
  return [...WATER_FIELDS, ...SOIL_FIELDS, ...ACCESS_FIELDS].some((f) => Boolean(values[f]));
}

/** Corps d'envoi : champs vides omis, distance en nombre. */
export function siteBody(values: SiteValues): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(values)) {
    if (v === "" || v === undefined) continue;
    body[k] = k === "distance_to_village_km" ? Number(v.replace(",", ".")) : v;
  }
  return body;
}

/** Valeurs de départ depuis le profil courant (une mise à jour envoie une version complète). */
export function fromProfile(profile: SiteProfile | null | undefined): SiteValues {
  if (!profile) return { evidence: "declared" };
  const values: SiteValues = { evidence: profile.evidence };
  for (const f of [...WATER_FIELDS, ...SOIL_FIELDS, ...ACCESS_FIELDS]) values[f] = (profile as Record<string, unknown>)[f] as string;
  values.scheme_name = profile.scheme_name ?? "";
  values.other_detail = profile.other_detail ?? "";
  values.distance_to_village_km = profile.distance_to_village_km ?? "";
  return values;
}
