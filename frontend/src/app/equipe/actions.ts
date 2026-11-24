"use server";

/**
 * Actions serveur de la page Équipe. Elles s'exécutent sur le serveur Next.js avec la
 * session de l'utilisateur ; l'API revérifie toujours l'organisation et les droits.
 */
import { revalidatePath } from "next/cache";

import { currentWorkspace, getApi } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";
import { apiErrorMessage } from "@/lib/api/errors";
import { toInternationalPhone } from "@/lib/phone";

export type InviteValues = { phone: string; firstName: string; lastName: string; roles: string[] };

export type InviteState =
  | { status: "idle" }
  | { status: "error"; message: string; values?: InviteValues }
  | { status: "done"; name: string; phone: string; code: string | null };

type InviteRole = components["schemas"]["RolesEnum"];
type AnyRole = components["schemas"]["RoleEnum"];

export type ActionState = { status: "idle" | "ok" | "error"; message?: string; code?: string };

async function context() {
  const workspace = await currentWorkspace();
  if (!workspace) throw new Error("Aucun espace de travail sélectionné.");
  return { api: await getApi(), header: { "X-Workspace": workspace } };
}

export async function inviteMember(_prev: InviteState, form: FormData): Promise<InviteState> {
  const phone = toInternationalPhone(String(form.get("phone_number") ?? ""), String(form.get("phone_country") ?? "SN"));
  const roles = form.getAll("roles").map(String);
  // Renvoyées en cas d'erreur pour que le formulaire reste rempli.
  const values: InviteValues = {
    phone,
    firstName: String(form.get("first_name") ?? ""),
    lastName: String(form.get("last_name") ?? ""),
    roles,
  };
  if (!phone) return { status: "error", message: "Indiquez le numéro de téléphone.", values };
  if (roles.length === 0) return { status: "error", message: "Choisissez au moins un rôle.", values };

  const { api, header } = await context();
  const { data, error } = await api.POST("/api/v1/memberships/", {
    params: { header },
    body: {
      phone_number: phone,
      first_name: String(form.get("first_name") ?? "").trim(),
      last_name: String(form.get("last_name") ?? "").trim(),
      roles: roles as InviteRole[],
    },
  });
  if (!data) return { status: "error", message: apiErrorMessage(error), values };
  revalidatePath("/equipe");
  return {
    status: "done",
    name: `${data.user.first_name} ${data.user.last_name}`,
    phone: data.user.phone_number,
    code: data.activation_code ?? null,
  };
}

export async function memberStatus(_prev: ActionState, form: FormData): Promise<ActionState> {
  const id = String(form.get("membership_id"));
  const action = String(form.get("action"));
  const { api, header } = await context();
  const params = { header, path: { id } };
  const result =
    action === "suspend"
      ? await api.POST("/api/v1/memberships/{id}/suspend/", { params })
      : action === "reactivate"
        ? await api.POST("/api/v1/memberships/{id}/reactivate/", { params })
        : action === "revoke"
          ? await api.POST("/api/v1/memberships/{id}/revoke/", { params })
          : null;
  if (!result) return { status: "error", message: "Action inconnue." };
  if (!result.response.ok) return { status: "error", message: apiErrorMessage(result.error) };
  revalidatePath("/equipe");
  return { status: "ok" };
}

export async function toggleRole(_prev: ActionState, form: FormData): Promise<ActionState> {
  const id = String(form.get("membership_id"));
  const role = String(form.get("role"));
  const add = form.get("add") === "1";
  const { api, header } = await context();
  const result = add
    ? await api.POST("/api/v1/memberships/{id}/roles/", {
        params: { header, path: { id } },
        body: { role: role as AnyRole },
      })
    : await api.POST("/api/v1/memberships/{id}/roles/{role_code}/revoke/", {
        params: { header, path: { id, role_code: role } },
      });
  if (!result.response.ok) return { status: "error", message: apiErrorMessage(result.error) };
  revalidatePath("/equipe");
  return { status: "ok" };
}

export async function newActivationCode(_prev: ActionState, form: FormData): Promise<ActionState> {
  const id = String(form.get("membership_id"));
  const { api, header } = await context();
  const { data, error } = await api.POST("/api/v1/memberships/{id}/activation-code/", {
    params: { header, path: { id } },
  });
  if (!data) return { status: "error", message: apiErrorMessage(error) };
  return { status: "ok", code: data.activation_code };
}
