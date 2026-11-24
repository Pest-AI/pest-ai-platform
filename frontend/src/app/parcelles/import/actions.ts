"use server";

/**
 * Actions serveur de l'import de parcelles (J15b). Le fichier passe par le serveur Next.js
 * (ADR-0008 : le navigateur n'appelle jamais l'API). L'API revérifie l'espace, la
 * permission parcels.manage, le fichier et chaque ligne.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { currentWorkspace, getApi } from "@/lib/api/client";
import { apiErrorMessage } from "@/lib/api/errors";
import { checkFile } from "@/lib/parcel-imports";

export type ImportState = { status: "idle" | "error" | "done"; message?: string };

const UUID = /^[0-9a-f-]{36}$/;

export async function uploadParcelFile(_prev: ImportState, form: FormData): Promise<ImportState> {
  const workspace = await currentWorkspace();
  if (!workspace) return { status: "error", message: "Aucun espace de travail sélectionné." };
  const file = form.get("file");
  const problem = checkFile(file instanceof File ? file : null);
  if (problem) return { status: "error", message: problem };
  const body = new FormData();
  body.append("file", file as File, (file as File).name);
  const api = await getApi();
  const { data, error, response } = await api.POST("/api/v1/parcel-imports/", {
    params: { header: { "X-Workspace": workspace } },
    body: body as unknown as { file: string },
    bodySerializer: (b) => b as unknown as FormData,
  });
  if (!response.ok || !data) {
    if (response.status === 403) return { status: "error", message: "Votre rôle ne permet pas d'importer des parcelles." };
    if (response.status === 413) return { status: "error", message: "Fichier trop lourd : 10 Mo au plus." };
    return { status: "error", message: apiErrorMessage(error, "Le fichier n'a pas pu être lu.") };
  }
  redirect(`/parcelles/import/${data.id}`);
}

export async function changeMapping(_prev: ImportState, form: FormData): Promise<ImportState> {
  const workspace = await currentWorkspace();
  const id = String(form.get("import_id") ?? "");
  if (!workspace || !UUID.test(id)) return { status: "error", message: "Import introuvable." };
  const operatorColumn = String(form.get("operator_column") ?? "");
  const operatorKey = String(form.get("operator_key") ?? "membership_number");
  const api = await getApi();
  const { error, response } = await api.POST("/api/v1/parcel-imports/{id}/preview/", {
    params: { header: { "X-Workspace": workspace }, path: { id } },
    body: {
      name_column: String(form.get("name_column") ?? "") || null,
      operator_column: operatorColumn || null,
      operator_key: operatorColumn ? (operatorKey === "phone" ? "phone" : "membership_number") : "none",
    },
  });
  if (!response.ok) return { status: "error", message: apiErrorMessage(error) };
  revalidatePath(`/parcelles/import/${id}`);
  return { status: "done" };
}

export async function commitImport(_prev: ImportState, form: FormData): Promise<ImportState> {
  const workspace = await currentWorkspace();
  const id = String(form.get("import_id") ?? "");
  if (!workspace || !UUID.test(id)) return { status: "error", message: "Import introuvable." };
  const api = await getApi();
  const { error, response } = await api.POST("/api/v1/parcel-imports/{id}/commit/", {
    params: { header: { "X-Workspace": workspace }, path: { id } },
    body: { include_flagged: form.get("include_flagged") === "on" },
  });
  if (!response.ok) return { status: "error", message: apiErrorMessage(error) };
  revalidatePath(`/parcelles/import/${id}`);
  revalidatePath("/parcelles");
  return { status: "done" };
}

export async function discardImport(form: FormData): Promise<void> {
  const workspace = await currentWorkspace();
  const id = String(form.get("import_id") ?? "");
  if (!workspace || !UUID.test(id)) redirect("/parcelles/import");
  const api = await getApi();
  await api.POST("/api/v1/parcel-imports/{id}/discard/", {
    params: { header: { "X-Workspace": workspace }, path: { id } },
  });
  redirect("/parcelles/import");
}
