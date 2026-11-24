import { expect, test } from "@playwright/test";

/** Contrôles de sécurité visibles de l'extérieur (sans compte). */
test.describe("Sécurité", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("en-têtes de sécurité présents", async ({ request }) => {
    const res = await request.get("/connexion");
    expect(res.ok()).toBeTruthy();
    const h = res.headers();
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["referrer-policy"]).toBeTruthy();
    expect(h["x-powered-by"]).toBeUndefined();
    if (res.url().startsWith("https://")) expect(h["strict-transport-security"]).toContain("max-age=");
  });

  test("pages protégées : redirection vers la connexion", async ({ page }) => {
    for (const path of ["/tableau-de-bord", "/producteurs", "/equipe", "/espaces"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/connexion/);
    }
  });

  test("routes de session refusées depuis un autre site", async ({ request }) => {
    for (const route of ["/api/session/login", "/api/session/logout", "/api/session/workspace"]) {
      const res = await request.post(route, {
        headers: { Origin: "https://site-malveillant.example", "Sec-Fetch-Site": "cross-site" },
        form: { x: "1" },
        maxRedirects: 0,
      });
      expect(res.status(), route).toBe(403);
    }
  });

  test("identifiants faux : message clair, pas de session", async ({ page }) => {
    await page.goto("/connexion");
    await page.locator("#phone_number").fill("700000009");
    await page.locator("#password").fill("mauvais-mot-de-passe-e2e");
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page.getByText("Numéro de téléphone ou mot de passe incorrect.")).toBeVisible();
    await page.goto("/tableau-de-bord");
    await expect(page).toHaveURL(/\/connexion/);
  });

  test("activation : code invalide refusé", async ({ page }) => {
    await page.goto("/activer");
    await page.locator("#phone_number").fill("700000009");
    await page.locator("#code").fill("000000");
    await page.locator("#password").fill("Un-mot-de-passe-e2e-2026");
    await page.locator("#password_confirm").fill("Un-mot-de-passe-e2e-2026");
    await page.getByRole("button", { name: /Activer/ }).click();
    await expect(page.getByRole("alert").filter({ hasText: /code/i })).toBeVisible();
    await expect(page).toHaveURL(/\/activer/);
  });
});
