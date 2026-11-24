import { expect, test as setup } from "@playwright/test";

import { E2E, localPhone, requireAccount } from "./env";

const SESSION = "e2e/.auth/session.json";

/** Connexion unique, puis choix de l'organisation : la session (cookies httpOnly) sert aux autres tests. */
setup("se connecter et choisir son espace", async ({ page }) => {
  if (!E2E.phone || !E2E.password) {
    // Session vide : les tests publics tournent quand même, les autres sont sautés.
    await page.context().storageState({ path: SESSION });
  }
  requireAccount();
  await page.goto("/connexion");
  await page.locator("#phone_number").fill(localPhone(E2E.phone));
  await page.locator("#password").fill(E2E.password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.waitForURL("**/espaces");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  // Chaque organisation est un bouton de formulaire (POST /api/session/workspace).
  const spaces = page.locator("form[action='/api/session/workspace'] button[type=submit]");
  await (E2E.org ? spaces.filter({ hasText: E2E.org }) : spaces).first().click();
  await page.waitForURL("**/tableau-de-bord");
  await page.context().storageState({ path: SESSION });
});
