"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { API_BASE_URL } from "@/lib/config";
import { apiErrorMessage } from "@/lib/api/errors";
import { toInternationalPhone } from "@/lib/phone";

export type ActivationState = { message: string | null; phone?: string; code?: string };

/** Active un compte créé par invitation (route publique de l'API, sans session). */
export async function activateAccount(_prev: ActivationState, form: FormData): Promise<ActivationState> {
  const phone = toInternationalPhone(String(form.get("phone_number") ?? ""));
  const code = String(form.get("code") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("password_confirm") ?? "");
  // Les champs saisis sont renvoyés pour rester remplis après une erreur (sauf les mots de passe).
  const keep = { phone: String(form.get("phone_number") ?? ""), code };
  if (!phone || !code || !password) return { ...keep, message: "Renseignez votre numéro, le code et un mot de passe." };
  if (password !== confirm) return { ...keep, message: "Les deux mots de passe ne sont pas identiques." };

  // L'adresse du navigateur est transmise à l'API pour la limitation de fréquence.
  const forwarded = (await headers()).get("x-forwarded-for") ?? "";
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/v1/auth/activate/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(forwarded ? { "X-Forwarded-For": forwarded } : {}) },
      body: JSON.stringify({ phone_number: phone, code, new_password: password }),
      cache: "no-store",
    });
  } catch {
    return { ...keep, message: "Le serveur ne répond pas. Réessayez dans un instant." };
  }
  if (res.status === 429) return { ...keep, message: "Trop de tentatives. Réessayez dans une heure." };
  if (res.status !== 204) return { ...keep, message: apiErrorMessage(await res.json().catch(() => null)) };
  redirect("/connexion?active=1");
}
