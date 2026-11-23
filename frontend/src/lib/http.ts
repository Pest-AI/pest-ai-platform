import { type NextRequest, NextResponse } from "next/server";

/**
 * Origine réellement utilisée par le navigateur (ex. http://127.0.0.1:3000,
 * https://app.pestai.africa), d'après les en-têtes Host / X-Forwarded-*.
 *
 * Next.js résout les redirections sur son nom d'hôte interne (« localhost ») : rediriger
 * vers une autre origine que celle du navigateur ferait perdre les cookies de session.
 */
export function requestOrigin(request: NextRequest): string {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto =
    request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(/:$/, "");
  return host ? `${proto}://${host}` : request.nextUrl.origin;
}

/** Redirection 303 (après un formulaire) vers un chemin du même site, sur la même origine. */
export function seeOther(request: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, requestOrigin(request)), 303);
}
