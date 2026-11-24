"use server";

/** Actions serveur de la Console Admin (super-admin). L'API revérifie le rôle plateforme. */
import { revalidatePath } from "next/cache";

import { getApi } from "@/lib/api/client";
import { apiErrorMessage } from "@/lib/api/errors";
import type { components } from "@/lib/api/schema";
import { toInternationalPhone } from "@/lib/phone";

type OrgType = components["schemas"]["OrganizationTypeEnum"];
type OrgStatus = components["schemas"]["OrganizationStatusEnum"];

export type AdminResult = { name: string; phone: string; code: string | null };

export type OrgFormState =
  | { status: "idle" }
  | { status: "error"; message: string; values: Record<string, string> }
  | { status: "done"; organization: string; admin: AdminResult | null; adminError?: string };

function values(form: FormData) {
  return Object.fromEntries(
    [
      "name",
      "short_name",
      "organization_type",
      "status",
      "admin_phone",
      "admin_phone_country",
      "admin_first_name",
      "admin_last_name",
    ].map(
      (k) => [k, String(form.get(k) ?? "")],
    ),
  );
}

async function designate(organizationId: string, v: Record<string, string>) {
  const api = await getApi();
  const { data, error } = await api.POST("/api/v1/platform/organizations/{id}/admins/", {
    params: { path: { id: organizationId } },
    body: {
      phone_number: toInternationalPhone(v.admin_phone ?? "", v.admin_phone_country || "SN"),
      first_name: (v.admin_first_name ?? "").trim(),
      last_name: (v.admin_last_name ?? "").trim(),
    },
  });
  if (!data) return { error: apiErrorMessage(error) };
  return {
    admin: {
      name: `${data.user.first_name} ${data.user.last_name}`,
      phone: data.user.phone_number,
      code: data.activation_code ?? null,
    },
  };
}

/** Crée une organisation et, si un numéro est donné, désigne son administrateur. */
export async function createOrganization(_prev: OrgFormState, form: FormData): Promise<OrgFormState> {
  const v = values(form);
  if (!v.name?.trim()) return { status: "error", message: "Indiquez le nom de l'organisation.", values: v };

  const api = await getApi();
  const { data, error } = await api.POST("/api/v1/platform/organizations/", {
    body: {
      name: v.name.trim(),
      short_name: v.short_name?.trim() ?? "",
      organization_type: (v.organization_type || "cooperative") as OrgType,
      status: (v.status || "active") as OrgStatus,
      country_code: "SN",
    },
  });
  if (!data) return { status: "error", message: apiErrorMessage(error), values: v };
  revalidatePath("/admin/organisations");

  if (!v.admin_phone?.trim()) return { status: "done", organization: data.name, admin: null };
  const result = await designate(data.id, v);
  return "error" in result
    ? { status: "done", organization: data.name, admin: null, adminError: result.error }
    : { status: "done", organization: data.name, admin: result.admin };
}

export type DesignateState =
  | { status: "idle" }
  | { status: "error"; message: string; values: Record<string, string> }
  | { status: "done"; admin: AdminResult };

/** Désigne un administrateur pour une organisation existante. */
export async function designateAdmin(_prev: DesignateState, form: FormData): Promise<DesignateState> {
  const v = values(form);
  const id = String(form.get("organization_id") ?? "");
  if (!v.admin_phone?.trim()) return { status: "error", message: "Indiquez le numéro de téléphone.", values: v };
  const result = await designate(id, v);
  if ("error" in result) return { status: "error", message: result.error ?? "Erreur.", values: v };
  revalidatePath("/admin/organisations");
  return { status: "done", admin: result.admin };
}
