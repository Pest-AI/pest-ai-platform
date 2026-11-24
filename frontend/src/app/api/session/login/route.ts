/** POST /api/session/login : connexion (formulaire), jetons stockés en cookies httpOnly. */
import type { NextRequest } from "next/server";

import { isSameOrigin, seeOther } from "@/lib/http";

import { API_BASE_URL } from "@/lib/config";
import { toInternationalPhone } from "@/lib/phone";
import { ACCESS_COOKIE, ACCESS_MAX_AGE, REFRESH_COOKIE, REFRESH_MAX_AGE, cookieOptions } from "@/lib/session";

export async function POST(request: NextRequest) {
  // Formulaire envoyé depuis un autre site : refusé (protection CSRF).
  if (!isSameOrigin(request)) return new Response("Origine refusée.", { status: 403 });
  const form = await request.formData();
  const phone = toInternationalPhone(String(form.get("phone_number") ?? ""), String(form.get("phone_country") ?? "SN"));
  const password = String(form.get("password") ?? "");
  const back = (reason: string) =>
    seeOther(request, `/connexion?erreur=${reason}`);

  if (!phone || !password) return back("champs");

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/v1/auth/token/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone_number: phone, password }),
      cache: "no-store",
    });
  } catch {
    return back("serveur");
  }
  if (res.status === 401 || res.status === 400) return back("identifiants");
  if (res.status === 429) return back("tentatives");
  if (!res.ok) return back("serveur");

  const tokens = (await res.json()) as { access: string; refresh: string };
  const response = seeOther(request, "/espaces");
  response.cookies.set(ACCESS_COOKIE, tokens.access, cookieOptions(ACCESS_MAX_AGE));
  response.cookies.set(REFRESH_COOKIE, tokens.refresh, cookieOptions(REFRESH_MAX_AGE));
  return response;
}
