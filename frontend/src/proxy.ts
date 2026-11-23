/**
 * Contrôle d'accès des pages du Web OS (proxy Next.js, exécuté avant chaque page).
 *
 * - Pages protégées sans session : redirection vers /connexion.
 * - Jeton d'accès expiré ou proche de l'expiration : renouvelé auprès de l'API avec le
 *   jeton de rafraîchissement, de façon transparente pour l'utilisateur.
 * - Renouvellement impossible : session effacée, retour à /connexion.
 */
import { type NextRequest, NextResponse } from "next/server";

import { API_BASE_URL } from "@/lib/config";
import { requestOrigin } from "@/lib/http";
import {
  ACCESS_COOKIE,
  ACCESS_MAX_AGE,
  REFRESH_COOKIE,
  REFRESH_MAX_AGE,
  WORKSPACE_COOKIE,
  cookieOptions,
  needsRefresh,
} from "@/lib/session";

const PUBLIC_PATHS = ["/connexion"];

function toLogin(request: NextRequest, reason?: string) {
  const url = new URL("/connexion", requestOrigin(request));
  if (reason) url.searchParams.set("erreur", reason);
  const response = NextResponse.redirect(url);
  for (const name of [ACCESS_COOKIE, REFRESH_COOKIE, WORKSPACE_COOKIE]) response.cookies.delete(name);
  return response;
}

async function refreshTokens(refresh: string) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/auth/token/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as { access: string; refresh?: string };
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const access = request.cookies.get(ACCESS_COOKIE)?.value;
  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;
  const isPublic = PUBLIC_PATHS.includes(pathname);

  if (isPublic) {
    // Déjà connecté : inutile de revoir la page de connexion.
    return refresh
      ? NextResponse.redirect(new URL("/espaces", requestOrigin(request)))
      : NextResponse.next();
  }

  if (!refresh) return toLogin(request);
  if (!needsRefresh(access)) return NextResponse.next();

  const tokens = await refreshTokens(refresh);
  if (!tokens) return toLogin(request, "session");

  // Les nouveaux jetons sont transmis à la page en cours ET enregistrés dans le navigateur.
  request.cookies.set(ACCESS_COOKIE, tokens.access);
  if (tokens.refresh) request.cookies.set(REFRESH_COOKIE, tokens.refresh);
  const response = NextResponse.next({ request });
  response.cookies.set(ACCESS_COOKIE, tokens.access, cookieOptions(ACCESS_MAX_AGE));
  if (tokens.refresh) response.cookies.set(REFRESH_COOKIE, tokens.refresh, cookieOptions(REFRESH_MAX_AGE));
  return response;
}

export const config = {
  // Toutes les pages, sauf les fichiers techniques et les routes de session.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|ico)$).*)"],
};
