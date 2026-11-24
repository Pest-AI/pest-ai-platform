/**
 * Client de l'API PEST AI OS pour les composants serveur.
 *
 * Typé à partir du schéma OpenAPI (schema.d.ts, généré par `pnpm gen:api`) :
 * une route ou un champ qui n'existe pas dans l'API est une erreur de compilation.
 */
import "server-only";

import { cookies } from "next/headers";
import createClient from "openapi-fetch";
import { cache } from "react";

import type { paths } from "@/lib/api/schema";
import { API_BASE_URL } from "@/lib/config";
import { ACCESS_COOKIE, WORKSPACE_COOKIE, isValidWorkspace } from "@/lib/session";
import { isWebWorkspace } from "@/lib/spaces";

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
  return createClient<paths>({ baseUrl: API_BASE_URL, headers, cache: "no-store", fetch: bufferedFetch });
}

/**
 * Envoie le corps des requêtes en un bloc (avec Content-Length) au lieu d'un flux
 * « chunked » : le serveur de développement Django (`make serveur`) ne lit pas les
 * corps envoyés en flux.
 */
async function bufferedFetch(request: Request): Promise<Response> {
  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  return fetch(request.url, {
    method: request.method,
    headers: request.headers,
    body: hasBody ? await request.arrayBuffer() : undefined,
    cache: "no-store",
  });
}

/** Profil de l'utilisateur connecté, lu une fois par requête. */
export const getMe = cache(async () => {
  const api = await getApi();
  const { data } = await api.GET("/api/v1/me/");
  return data ?? null;
});

/**
 * Espace de travail choisi, seulement s'il est ouvert dans le Web OS pour cet utilisateur
 * (adhésion active avec un rôle du Web OS) ; sinon null, et la page renvoie vers /espaces.
 */
export async function currentWorkspace(): Promise<string | null> {
  const value = (await cookies()).get(WORKSPACE_COOKIE)?.value;
  if (!isValidWorkspace(value)) return null;
  const me = await getMe();
  return me && isWebWorkspace(me, value) ? value : null;
}
