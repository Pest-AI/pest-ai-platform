/** POST /api/session/logout : invalide le jeton côté API puis efface la session. */
import type { NextRequest } from "next/server";

import { isSameOrigin, seeOther } from "@/lib/http";

import { API_BASE_URL } from "@/lib/config";
import { ACCESS_COOKIE, REFRESH_COOKIE, WORKSPACE_COOKIE } from "@/lib/session";

export async function POST(request: NextRequest) {
  // Formulaire envoyé depuis un autre site : refusé (protection CSRF).
  if (!isSameOrigin(request)) return new Response("Origine refusée.", { status: 403 });
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
  const response = seeOther(request, "/connexion?deconnecte=1");
  for (const name of [ACCESS_COOKIE, REFRESH_COOKIE, WORKSPACE_COOKIE]) response.cookies.delete(name);
  return response;
}
