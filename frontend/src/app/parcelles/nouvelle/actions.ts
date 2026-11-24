"use server";

/**
 * Création d'une parcelle depuis le Web OS (J15c). L'API revérifie l'espace, la permission
 * parcels.create, le contour (D-19, relevé terrain à confirmer) et l'exploitant.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { currentWorkspace, getApi } from "@/lib/api/client";
import { apiErrorMessage } from "@/lib/api/errors";

export type CreateState = { status: "idle" | "error"; message?: string };

const MODES = { trace: "manual_drawing", coordonnees: "manual_coordinates" } as const;
const UUID = /^[0-9a-f-]{36}$/;

function readPoints(raw: string): [number, number][] | null {
  try {
    const value: unknown = JSON.parse(raw || "[]");
    if (!Array.isArray(value)) return null;
    const ok = value.every(
      (p) => Array.isArray(p) && p.length === 2 && p.every((n) => typeof n === "number" && Number.isFinite(n)),
    );
    return ok ? (value as [number, number][]) : null;
  } catch {
    return null;
  }
}

export async function createParcel(_prev: CreateState, form: FormData): Promise<CreateState> {
  const workspace = await currentWorkspace();
  if (!workspace) return { status: "error", message: "Aucun espace de travail sélectionné." };
  const mode = String(form.get("mode") ?? "");
  const points = readPoints(String(form.get("points") ?? ""));
  if (!points) return { status: "error", message: "Points illisibles : recommencez la saisie." };
  const localName = String(form.get("local_name") ?? "").trim().slice(0, 150);
  const operator = String(form.get("operator") ?? "");

  const body: {
    local_name: string;
    operator?: string;
    geometry?: { type: "Polygon"; coordinates: [number, number][][] };
    position?: number[];
    capture_method: "manual_drawing" | "manual_coordinates";
  } = { local_name: localName, capture_method: "manual_drawing" };
  if (UUID.test(operator)) body.operator = operator;
  if (mode === "trace" || mode === "coordonnees") {
    if (points.length < 3) return { status: "error", message: "Un contour demande au moins 3 points." };
    body.geometry = { type: "Polygon", coordinates: [[...points, points[0] as [number, number]]] };
    body.capture_method = MODES[mode];
  } else if (mode === "position") {
    if (points.length !== 1) return { status: "error", message: "Placez la parcelle sur la carte." };
    body.position = points[0];
  } else if (mode !== "aucune") {
    return { status: "error", message: "Choisissez comment situer la parcelle." };
  }

  const api = await getApi();
  const { data, error, response } = await api.POST("/api/v1/parcels/", {
    params: { header: { "X-Workspace": workspace } },
    body,
  });
  if (!response.ok || !data) {
    if (response.status === 403) return { status: "error", message: "Votre rôle ne permet pas d'enregistrer une parcelle." };
    return { status: "error", message: apiErrorMessage(error, "La parcelle n'a pas pu être enregistrée.") };
  }
  revalidatePath("/parcelles");
  redirect(`/parcelles/${data.id}?nouvelle=1`);
}
