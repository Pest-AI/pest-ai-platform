/**
 * GET /api/session/refus : session ouverte sans accès au Web OS (agent terrain, producteur,
 * ou rôle retiré depuis) — la session est invalidée et effacée, retour à la connexion.
 */
import type { NextRequest } from "next/server";

import { API_BASE_URL } from "@/lib/config";
import { seeOther } from "@/lib/http";
import { ACCESS_COOKIE, REFRESH_COOKIE, WORKSPACE_COOKIE } from "@/lib/session";

export async function GET(request: NextRequest) {
  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;
  if (refresh) {
    try {
      await fetch(`${API_BASE_URL}/api/v1/auth/logout/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh }),
        cache: "no-store",
      });
    } catch {
      // L'API injoignable n'empêche pas d'effacer la session locale.
    }
  }
  const response = seeOther(request, "/connexion?erreur=terrain");
  for (const name of [ACCESS_COOKIE, REFRESH_COOKIE, WORKSPACE_COOKIE]) response.cookies.delete(name);
  return response;
}
