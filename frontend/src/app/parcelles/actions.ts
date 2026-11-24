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
