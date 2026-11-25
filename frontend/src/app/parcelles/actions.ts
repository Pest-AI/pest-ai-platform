"use server";

/**
 * Actions serveur de la fiche parcelle. L'API revérifie l'espace, la permission
 * (parcels.validate_geometry) et l'état du contour.
 */
import { revalidatePath } from "next/cache";

import { currentWorkspace, getApi } from "@/lib/api/client";
import { apiErrorMessage } from "@/lib/api/errors";

export type ReviewState = { status: "idle" | "error" | "done"; message?: string };

export async function reviewGeometry(_prev: ReviewState, form: FormData): Promise<ReviewState> {
  const workspace = await currentWorkspace();
  if (!workspace) return { status: "error", message: "Aucun espace de travail sélectionné." };
  const parcelId = String(form.get("parcel_id") ?? "");
  const geometryId = String(form.get("geometry_id") ?? "");
  const decision = form.get("decision") === "rejected" ? "rejected" : "valid";
  const note = String(form.get("note") ?? "").trim();
  if (decision === "rejected" && !note) {
    return { status: "error", message: "Expliquez pourquoi le contour est refusé." };
  }
  const api = await getApi();
  const { error, response } = await api.POST("/api/v1/parcels/{id}/geometries/{geometry_id}/review/", {
    params: { header: { "X-Workspace": workspace }, path: { id: parcelId, geometry_id: geometryId } },
    body: { decision, note },
  });
  if (!response.ok) return { status: "error", message: apiErrorMessage(error) };
  revalidatePath(`/parcelles/${parcelId}`);
  return { status: "done" };
}

export type SiteState = { status: "idle" | "error" | "done"; message?: string };

const SITE_KEYS = [
  "water_regime",
  "water_source",
  "irrigation_method",
  "scheme_type",
  "pump_access",
  "water_availability",
  "soil_local_type",
  "soil_texture",
  "salinity",
  "flooding",
  "slope",
  "perceived_fertility",
  "road_access",
  "scheme_name",
  "other_detail",
  "notes",
  "evidence",
] as const;

/** Nouvelle version du profil de site (sol, eau, accès) ; la précédente reste dans l'historique. */
export async function recordSite(_prev: SiteState, form: FormData): Promise<SiteState> {
  const workspace = await currentWorkspace();
  if (!workspace) return { status: "error", message: "Aucun espace de travail sélectionné." };
  const parcelId = String(form.get("parcel_id") ?? "");
  const body: Record<string, unknown> = {};
  for (const key of SITE_KEYS) {
    const value = String(form.get(key) ?? "").trim();
    if (value) body[key] = value;
  }
  const distance = String(form.get("distance_to_village_km") ?? "").trim().replace(",", ".");
  if (distance) {
    const n = Number(distance);
    if (!Number.isFinite(n) || n < 0 || n > 500) return { status: "error", message: "Distance invalide (0 à 500 km)." };
    body.distance_to_village_km = n.toFixed(1);
  }
  const api = await getApi();
  const { error, response } = await api.POST("/api/v1/parcels/{id}/site/", {
    params: { header: { "X-Workspace": workspace }, path: { id: parcelId } },
    // Valeurs issues des listes de l'API, revérifiées par le serveur.
    body: body as never,
  });
  if (!response.ok) return { status: "error", message: apiErrorMessage(error) };
  revalidatePath(`/parcelles/${parcelId}`);
  return { status: "done" };
}
