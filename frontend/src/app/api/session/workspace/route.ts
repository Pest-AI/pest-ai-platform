/** POST /api/session/workspace : mémorise l'espace de travail choisi (X-Workspace). */
import type { NextRequest } from "next/server";

import { isSameOrigin, seeOther } from "@/lib/http";

import { REFRESH_COOKIE, REFRESH_MAX_AGE, WORKSPACE_COOKIE, cookieOptions, isValidWorkspace } from "@/lib/session";

export async function POST(request: NextRequest) {
  // Formulaire envoyé depuis un autre site : refusé (protection CSRF).
  if (!isSameOrigin(request)) return new Response("Origine refusée.", { status: 403 });
  if (!request.cookies.get(REFRESH_COOKIE)) {
    return seeOther(request, "/connexion");
  }
  const workspace = String((await request.formData()).get("workspace") ?? "");
  if (!isValidWorkspace(workspace)) {
    return seeOther(request, "/espaces?erreur=espace");
  }
  // L'API revérifie l'adhésion à chaque requête : ce cookie n'accorde aucun droit en soi.
  const response = seeOther(request, "/tableau-de-bord");
  response.cookies.set(WORKSPACE_COOKIE, workspace, cookieOptions(REFRESH_MAX_AGE));
  return response;
}
