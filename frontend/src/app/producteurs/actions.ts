"use server";

/**
 * Actions serveur du registre des producteurs. L'API revérifie toujours l'organisation
 * (X-Workspace) et les permissions (producers.create / producers.manage).
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { currentWorkspace, getApi } from "@/lib/api/client";
import { apiErrorMessage } from "@/lib/api/errors";
import type { components } from "@/lib/api/schema";
import { toInternationalPhone } from "@/lib/phone";
import { parseBirthYear } from "@/lib/producers";

type Candidate = components["schemas"]["DuplicateCandidate"];
type Sex = components["schemas"]["SexEnum"];
type Language = components["schemas"]["PreferredLanguageEnum"];
type Relationship = components["schemas"]["RelationshipTypeEnum"];

export type ProducerValues = {
  firstName: string;
  lastName: string;
  sex: string;
  birthYear: string;
  locality: string;
  phone: string;
  language: string;
  relationship: string;
  membershipNumber: string;
};

export type CreateState =
  | { status: "idle" }
  | { status: "error"; message: string; values: ProducerValues }
  | { status: "duplicates"; candidates: Candidate[]; values: ProducerValues };

export type SimpleState = { status: "idle" | "error"; message?: string };

async function context() {
  const workspace = await currentWorkspace();
  if (!workspace) throw new Error("Aucun espace de travail sélectionné.");
  return { api: await getApi(), header: { "X-Workspace": workspace } };
}

function readValues(form: FormData): ProducerValues {
  const get = (key: string) => String(form.get(key) ?? "").trim();
  return {
    firstName: get("first_name"),
    lastName: get("last_name"),
    sex: get("sex"),
    birthYear: get("birth_year"),
    locality: get("locality_text"),
    phone: get("phone_number") ? toInternationalPhone(get("phone_number"), get("phone_country") || "SN") : "",
    language: get("preferred_language") || "fr",
    relationship: get("relationship_type") || "member",
    membershipNumber: get("membership_number"),
  };
}

function profileBody(values: ProducerValues) {
  return {
    first_name: values.firstName,
    last_name: values.lastName,
    sex: (values.sex || "") as Sex | "",
    birth_year: parseBirthYear(values.birthYear),
    locality_text: values.locality,
    preferred_language: values.language as Language,
    phone_number: values.phone,
  };
}

export async function createProducer(_prev: CreateState, form: FormData): Promise<CreateState> {
  const values = readValues(form);
  if (!values.firstName || !values.lastName) {
    return { status: "error", message: "Indiquez le prénom et le nom.", values };
  }
  if (values.birthYear && parseBirthYear(values.birthYear) === null) {
    return { status: "error", message: "Année de naissance invalide (ex. 1985).", values };
  }
  const { api, header } = await context();
  const { data, error, response } = await api.POST("/api/v1/producers/", {
    params: { header },
    body: {
      ...profileBody(values),
      relationship_type: values.relationship as Relationship,
      membership_number: values.membershipNumber,
      confirm_new: form.get("confirm_new") === "1",
    },
  });
  if (response.status === 409) {
    const body = error as unknown as { candidates?: Candidate[] };
    return { status: "duplicates", candidates: body.candidates ?? [], values };
  }
  if (!data) return { status: "error", message: apiErrorMessage(error), values };
  revalidatePath("/producteurs");
  redirect(`/producteurs/${data.id}?nouveau=1`);
}

export async function attachProducer(_prev: SimpleState, form: FormData): Promise<SimpleState> {
  const id = String(form.get("producer_id") ?? "");
  const { api, header } = await context();
  const { data, error } = await api.POST("/api/v1/producers/attach/", {
    params: { header },
    body: {
      producer_id: id,
      relationship_type: (String(form.get("relationship_type") ?? "") || "member") as Relationship,
      membership_number: String(form.get("membership_number") ?? "").trim(),
    },
  });
  if (!data) return { status: "error", message: apiErrorMessage(error) };
  revalidatePath("/producteurs");
  redirect(`/producteurs/${data.id}?rattache=1`);
}

export async function updateProducer(_prev: CreateState, form: FormData): Promise<CreateState> {
  const id = String(form.get("producer_id") ?? "");
  const values = readValues(form);
  if (!values.firstName || !values.lastName) {
    return { status: "error", message: "Indiquez le prénom et le nom.", values };
  }
  if (values.birthYear && parseBirthYear(values.birthYear) === null) {
    return { status: "error", message: "Année de naissance invalide (ex. 1985).", values };
  }
  const { api, header } = await context();
  const { data, error } = await api.PATCH("/api/v1/producers/{id}/", {
    params: { header, path: { id } },
    body: {
      ...profileBody(values),
      relationship_type: values.relationship as Relationship,
      membership_number: values.membershipNumber,
    },
  });
  if (!data) return { status: "error", message: apiErrorMessage(error), values };
  revalidatePath(`/producteurs/${id}`);
  revalidatePath("/producteurs");
  return { status: "idle" };
}

export async function detachProducer(_prev: SimpleState, form: FormData): Promise<SimpleState> {
  const id = String(form.get("producer_id") ?? "");
  const { api, header } = await context();
  const { response, error } = await api.POST("/api/v1/producers/{id}/detach/", {
    params: { header, path: { id } },
    body: {},
  });
  if (!response.ok) return { status: "error", message: apiErrorMessage(error) };
  revalidatePath("/producteurs");
  redirect("/producteurs?retire=1");
}
