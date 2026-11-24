import { test } from "@playwright/test";

export const E2E = {
  phone: process.env.E2E_PHONE ?? "",
  password: process.env.E2E_PASSWORD ?? "",
  org: process.env.E2E_ORG ?? "",
  writes: process.env.E2E_ALLOW_WRITES === "1",
};

/** Saute le test si le compte de test n'est pas fourni (sans jamais afficher les valeurs). */
export function requireAccount() {
  test.skip(!E2E.phone || !E2E.password, "E2E_PHONE et E2E_PASSWORD non définis");
}

/** Numéro local (9 chiffres) attendu par le champ précédé de +221. */
export function localPhone(phone: string) {
  return phone.replace(/\D/g, "").replace(/^221(?=\d{9}$)/, "");
}
