/**
 * Session du Web OS.
 *
 * Les jetons JWT de l'API sont conservés dans des cookies httpOnly : le code du navigateur
 * ne peut pas les lire (protection contre le vol de jetons par script). Seul le serveur
 * Next.js les envoie à l'API.
 */
import { IS_PRODUCTION } from "@/lib/config";

export const ACCESS_COOKIE = "pestai_access";
export const REFRESH_COOKIE = "pestai_refresh";
export const WORKSPACE_COOKIE = "pestai_workspace";

/** Marge avant expiration : le jeton d'accès est renouvelé 60 s avant de périmer. */
export const REFRESH_MARGIN_SECONDS = 60;

const WORKSPACE_PATTERN = /^org:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidWorkspace(value: string | null | undefined): value is string {
  return typeof value === "string" && WORKSPACE_PATTERN.test(value);
}

/** Date d'expiration (secondes epoch) lue dans un JWT, sans vérifier la signature (rôle de l'API). */
export function tokenExpiry(token: string | undefined): number | null {
  if (!token) return null;
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    const json = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { exp?: unknown };
    return typeof json.exp === "number" ? json.exp : null;
  } catch {
    return null;
  }
}

/** Vrai si le jeton est absent, illisible ou expire dans moins de REFRESH_MARGIN_SECONDS. */
export function needsRefresh(token: string | undefined, nowSeconds = Date.now() / 1000): boolean {
  const exp = tokenExpiry(token);
  return exp === null || exp - nowSeconds < REFRESH_MARGIN_SECONDS;
}

export function cookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

export const ACCESS_MAX_AGE = 15 * 60;
export const REFRESH_MAX_AGE = 7 * 24 * 60 * 60;
