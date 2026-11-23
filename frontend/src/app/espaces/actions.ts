"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getApi } from "@/lib/api/client";

/** L'invité accepte son invitation ; l'organisation apparaît alors dans ses espaces. */
export async function acceptInvitation(form: FormData) {
  const id = String(form.get("membership_id") ?? "");
  const api = await getApi();
  const { response } = await api.POST("/api/v1/me/memberships/{membership_id}/accept/", {
    params: { path: { membership_id: id } },
  });
  if (!response.ok) redirect("/espaces?erreur=invitation");
  revalidatePath("/espaces");
  redirect("/espaces?bienvenue=1");
}
