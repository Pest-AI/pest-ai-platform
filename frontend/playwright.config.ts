import { defineConfig, devices } from "@playwright/test";

/**
 * Tests de bout en bout du Web OS, joués contre un environnement déployé (staging) ou local.
 *
 * Variables (jamais commitées, jamais affichées) :
 *   E2E_BASE_URL     adresse du Web OS (obligatoire), ex. https://<staging>.vercel.app
 *   E2E_PHONE        numéro du compte de test (9 chiffres ou +221…)
 *   E2E_PASSWORD     mot de passe du compte de test
 *   E2E_ORG          nom de l'organisation à choisir (facultatif : sinon la première)
 *   E2E_ALLOW_WRITES "1" pour autoriser les tests qui créent des données (désactivé par défaut)
 *   E2E_CHROME_PATH  navigateur Chrome local à utiliser (facultatif)
 *
 * Les traces et vidéos sont désactivées : elles enregistreraient les champs saisis (mot de passe).
 */
const baseURL = process.env.E2E_BASE_URL;
const executablePath = process.env.E2E_CHROME_PATH || undefined;

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./e2e/.resultats",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 45_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [["list"], ["html", { open: "never", outputFolder: "e2e/.rapport" }]] : "list",
  use: {
    baseURL,
    locale: "fr-FR",
    trace: "off",
    video: "off",
    screenshot: "only-on-failure",
    launchOptions: { executablePath },
  },
  projects: [
    { name: "connexion", testMatch: /auth\.setup\.ts/ },
    {
      name: "bureau",
      use: { ...devices["Desktop Chrome"], storageState: "e2e/.auth/session.json" },
      dependencies: ["connexion"],
      testIgnore: /auth\.setup\.ts/,
    },
  ],
});
