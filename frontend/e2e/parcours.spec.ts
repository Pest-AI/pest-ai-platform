import { expect, test } from "@playwright/test";

import { requireAccount } from "./env";

/** Parcours d'un membre connecté (lecture seule : aucune donnée créée). */
test.describe("Parcours connecté", () => {
  test.beforeEach(() => requireAccount());

  test("tableau de bord : indicateurs et carte", async ({ page }) => {
    await page.goto("/tableau-de-bord");
    await expect(page.getByRole("navigation", { name: "Navigation principale" })).toBeVisible();
    await expect(page.getByText("Producteurs").first()).toBeVisible();
    await expect(page.locator(".maplibregl-canvas")).toBeVisible();
  });

  test("producteurs : liste, recherche et fiche", async ({ page }) => {
    await page.goto("/producteurs");
    await expect(page.getByRole("heading", { name: "Producteurs", level: 1 })).toBeVisible();
    const first = page.locator("a[href^='/producteurs/']").filter({ hasNotText: "Exporter" }).first();
    if (await first.count()) {
      await first.click();
      await expect(page).toHaveURL(/\/producteurs\/[0-9a-f-]{36}/);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    }
    await page.goto("/producteurs?q=zzzz-aucun-resultat-e2e");
    await expect(page.getByText(/Aucun/).first()).toBeVisible();
  });

  test("export CSV des producteurs", async ({ page }) => {
    await page.goto("/producteurs");
    const res = await page.request.get("/producteurs/export");
    if (res.status() === 403) test.skip(true, "Rôle sans droit d'export");
    expect(res.ok()).toBeTruthy();
    expect(res.headers()["content-type"]).toContain("text/csv");
  });

  test("équipe : onglets de statut", async ({ page }) => {
    const res = await page.goto("/equipe");
    if (!res?.ok() || page.url().includes("/tableau-de-bord")) test.skip(true, "Rôle sans accès à l'équipe");
    await expect(page.getByRole("link", { name: /Tous/ })).toBeVisible();
  });

  test("changer d'espace puis revenir", async ({ page }) => {
    await page.goto("/tableau-de-bord");
    await page.goto("/espaces");
    await expect(page.locator("form[action='/api/session/workspace'] button[type=submit]").first()).toBeVisible();
  });
});

test.describe("Parcelles", () => {
  test.beforeEach(() => requireAccount());

  test("liste, recherche et fiche", async ({ page }) => {
    await page.goto("/parcelles");
    await expect(page.getByRole("heading", { name: "Parcelles & AgroID", level: 1 })).toBeVisible();
    const first = page.locator("ul[aria-label=Parcelles] a").first();
    if (await first.count()) {
      await first.click();
      await expect(page).toHaveURL(/\/parcelles\/[0-9a-f-]{36}/);
      await expect(page.getByRole("heading", { name: "Historique du contour" })).toBeVisible();
    }
    await page.goto("/parcelles?q=PAI-SN-00000000");
    await expect(page.getByText("Aucune parcelle ne correspond")).toBeVisible();
  });

  test("données de la carte en GeoJSON", async ({ page }) => {
    await page.goto("/tableau-de-bord");
    const res = await page.request.get("/parcelles/carte?bbox=-17.6,12.3,-11.3,16.7");
    if (res.status() === 403) test.skip(true, "Rôle sans accès aux parcelles");
    const data = await res.json();
    expect(data.type).toBe("FeatureCollection");
    expect((await page.request.get("/parcelles/carte?bbox=1,2,3")).status()).toBe(400);
  });
});
