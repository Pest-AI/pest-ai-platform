"use server";

/**
 * Unité de culture depuis le Web OS (J19, D-16). L'API revérifie l'espace, la permission
 * (parcels.create), mesure le contour et contrôle l'inclusion dans la parcelle (signalée).
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { currentWorkspace, getApi } from "@/lib/api/client";
import { apiErrorMessage } from "@/lib/api/errors";

export type UnitState = { status: "idle" | "error"; message?: string };

export async function createUnit(_prev: UnitState, form: FormData): Promise<UnitState> {
  const workspace = await currentWorkspace();
  if (!workspace) return { status: "error", message: "Aucun espace de travail sélectionné." };
  const parcelId = String(form.get("parcel_id") ?? "");
  if (!/^[0-9a-f-]{36}$/.test(parcelId)) return { status: "error", message: "Parcelle introuvable." };
  const name = String(form.get("name") ?? "").trim().slice(0, 100);
  const code = String(form.get("code") ?? "").trim().slice(0, 16);
  let points: [number, number][] = [];
  try {
    const raw: unknown = JSON.parse(String(form.get("points") ?? "[]"));
    if (Array.isArray(raw)) points = raw.filter((p): p is [number, number] => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite));
  } catch {
    return { status: "error", message: "Points illisibles : recommencez le tracé." };
  }
  const areaRaw = String(form.get("area_m2") ?? "").trim().replace(",", ".");
  const body: Record<string, unknown> = { name, code };
  if (points.length >= 3) {
    body.geometry = { type: "Polygon", coordinates: [[...points, points[0]]] };
    body.capture_method = "manual_drawing";
  } else if (points.length > 0) {
    return { status: "error", message: "Un contour demande au moins 3 points." };
  } else if (areaRaw) {
    const area = Number(areaRaw);
    if (!Number.isFinite(area) || area <= 0) return { status: "error", message: "Surface invalide." };
    body.area_m2 = area.toFixed(2);
  }
  const api = await getApi();
  const { error, response } = await api.POST("/api/v1/parcels/{id}/units/", {
    params: { header: { "X-Workspace": workspace }, path: { id: parcelId } },
    body: body as never,
  });
  if (!response.ok) {
    if (response.status === 403) return { status: "error", message: "Votre rôle ne permet pas d'ajouter une unité sur cette parcelle." };
    return { status: "error", message: apiErrorMessage(error) };
  }
  revalidatePath(`/parcelles/${parcelId}`);
  redirect(`/parcelles/${parcelId}?unite=1`);
}
