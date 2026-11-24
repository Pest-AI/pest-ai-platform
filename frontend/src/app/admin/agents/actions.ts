"use server";

/**
 * Agents terrain : créés, affectés et gérés par PEST AI uniquement (décision du 24/11/2026).
 * L'API revérifie le rôle plateforme à chaque appel.
 */
import { revalidatePath } from "next/cache";

import { getApi } from "@/lib/api/client";
import { apiErrorMessage } from "@/lib/api/errors";
import { toInternationalPhone } from "@/lib/phone";

export type CreatedAgent = { name: string; firstName: string; phone: string; organization: string; code: string | null };

export type AgentFormState =
  | { status: "idle" }
  | { status: "error"; message: string; values: Record<string, string> }
  | { status: "done"; agent: CreatedAgent };

const FIELDS = ["organization", "phone_number", "phone_country", "first_name", "last_name"];

export async function createAgent(_prev: AgentFormState, form: FormData): Promise<AgentFormState> {
  const v = Object.fromEntries(FIELDS.map((k) => [k, String(form.get(k) ?? "")]));
  if (!v.organization) return { status: "error", message: "Choisissez la coopérative d'affectation.", values: v };
  if (!v.phone_number?.trim()) return { status: "error", message: "Indiquez le numéro de téléphone.", values: v };
  const api = await getApi();
  const { data, error } = await api.POST("/api/v1/platform/agents/", {
    body: {
      organization: v.organization,
      phone_number: toInternationalPhone(v.phone_number, v.phone_country || "SN"),
      first_name: (v.first_name ?? "").trim(),
      last_name: (v.last_name ?? "").trim(),
    },
  });
  if (!data) return { status: "error", message: apiErrorMessage(error), values: v };
  revalidatePath("/admin/agents");
  return {
    status: "done",
    agent: {
      name: `${data.user.first_name} ${data.user.last_name}`,
      firstName: data.user.first_name,
      phone: data.user.phone_number,
      organization: data.organization.short_name || data.organization.name,
      code: data.activation_code ?? null,
    },
  };
}

export type AgentActionState = { status: "idle" } | { status: "error"; message: string } | { status: "code"; code: string };

/** Suspendre, réactiver, retirer l'agent de la coopérative, ou émettre un nouveau code. */
export async function agentAction(_prev: AgentActionState, form: FormData): Promise<AgentActionState> {
  const id = String(form.get("membership_id") ?? "");
  const op = String(form.get("op") ?? "");
  const api = await getApi();
  const params = { params: { path: { id } } };
  if (op === "code") {
    const { data, error } = await api.POST("/api/v1/platform/agents/{id}/activation-code/", params);
    if (!data) return { status: "error", message: apiErrorMessage(error) };
    return { status: "code", code: data.activation_code };
  }
  const routes = {
    suspend: "/api/v1/platform/agents/{id}/suspend/",
    reactivate: "/api/v1/platform/agents/{id}/reactivate/",
    revoke: "/api/v1/platform/agents/{id}/revoke/",
  } as const;
  const route = routes[op as keyof typeof routes];
  if (!route) return { status: "error", message: "Action inconnue." };
  const { error, response } = await api.POST(route, params);
  if (!response.ok) return { status: "error", message: apiErrorMessage(error) };
  revalidatePath("/admin/agents");
  return { status: "idle" };
}
