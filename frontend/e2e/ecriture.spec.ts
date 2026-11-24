import { expect, test } from "@playwright/test";

import { E2E, requireAccount } from "./env";

/**
 * Tests qui CRÉENT des données sur l'environnement visé : désactivés par défaut.
 * À lancer avec E2E_ALLOW_WRITES=1, sur staging uniquement. Les fiches créées portent le nom « E2E … ».
 */
test.describe("Écriture (staging)", () => {
  test.beforeEach(() => {
    requireAccount();
    test.skip(!E2E.writes, "E2E_ALLOW_WRITES≠1 : aucune donnée créée");
  });

  test("enregistrer un producteur", async ({ page }) => {
    const stamp = Date.now().toString().slice(-6);
    await page.goto("/producteurs");
    const open = page.getByRole("button", { name: /Enregistrer (un|le premier) producteur/ });
    if (!(await open.count())) test.skip(true, "Rôle sans droit de création");
    await open.first().click();
    const dialog = page.getByRole("dialog");
    await dialog.locator("input[name=first_name]").fill("E2E");
    await dialog.locator("input[name=last_name]").fill(`Test ${stamp}`);
    await dialog.locator("input[name=locality_text]").fill("Village E2E");
    await dialog.getByRole("button", { name: "Enregistrer", exact: true }).click();
    await page.waitForURL(/\/producteurs\/[0-9a-f-]{36}/);
    await expect(page.getByRole("heading", { name: `E2E Test ${stamp}` })).toBeVisible();
  });
});
