/**
 * Client de l'API PEST AI OS pour les composants serveur.
 *
 * Typé à partir du schéma OpenAPI (schema.d.ts, généré par `pnpm gen:api`) :
 * une route ou un champ qui n'existe pas dans l'API est une erreur de compilation.
 */
import "server-only";

import { cookies } from "next/headers";
import createClient from "openapi-fetch";

import type { paths } from "@/lib/api/schema";
import { API_BASE_URL } from "@/lib/config";
import { ACCESS_COOKIE, WORKSPACE_COOKIE, isValidWorkspace } from "@/lib/session";

export type { paths };

/**
 * Client authentifié (jeton d'accès de la session).
 *
 * L'en-tête X-Workspace n'est jamais ajouté implicitement : les routes d'organisation
 * l'exigent dans leur type, il faut donc le passer explicitement :
 *   api.GET("/api/v1/organization/", { params: { header: { "X-Workspace": workspace } } })
 */
export async function getApi() {
  const access = (await cookies()).get(ACCESS_COOKIE)?.value;
  const headers: Record<string, string> = access ? { Authorization: `Bearer ${access}` } : {};
  return createClient<paths>({ baseUrl: API_BASE_URL, headers, cache: "no-store" });
}

export async function currentWorkspace(): Promise<string | null> {
  const value = (await cookies()).get(WORKSPACE_COOKIE)?.value;
  return isValidWorkspace(value) ? value : null;
}
