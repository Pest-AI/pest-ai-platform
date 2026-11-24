import { expect, test } from "@playwright/test";

import { E2E, localPhone, requireAccount } from "./env";

/** Connexion propre à ce test : la déconnexion révoque le jeton, sans toucher la session des autres tests. */
test.use({ storageState: { cookies: [], origins: [] } });

test("déconnexion avec confirmation", async ({ page }) => {
  requireAccount();
  await page.goto("/connexion");
  await page.locator("#phone_number").fill(localPhone(E2E.phone));
  await page.locator("#password").fill(E2E.password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.waitForURL("**/espaces");

  await page.getByRole("button", { name: "Se déconnecter" }).first().click();
  await expect(page.getByText("Se déconnecter ?")).toBeVisible();
  await page.getByRole("button", { name: "Annuler" }).click();
  await expect(page).toHaveURL(/\/espaces/);

  await page.getByRole("button", { name: "Se déconnecter" }).first().click();
  await page.getByRole("dialog").getByRole("button", { name: "Se déconnecter" }).click();
  await expect(page).toHaveURL(/\/connexion/);
  await page.goto("/tableau-de-bord");
  await expect(page).toHaveURL(/\/connexion/);
});
