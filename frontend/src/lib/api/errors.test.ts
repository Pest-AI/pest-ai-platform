import { describe, expect, it } from "vitest";

import { apiErrorMessage } from "@/lib/api/errors";

describe("apiErrorMessage", () => {
  it("lit les formes d'erreur de l'API", () => {
    expect(apiErrorMessage({ detail: "Accès refusé." })).toBe("Accès refusé.");
    expect(apiErrorMessage({ detail: ["Code invalide."] })).toBe("Code invalide.");
    expect(apiErrorMessage({ first_name: ["Prénom requis."] })).toBe("Prénom requis.");
    expect(apiErrorMessage(["Transition impossible."])).toBe("Transition impossible.");
  });

  it("utilise le message par défaut sinon", () => {
    expect(apiErrorMessage(undefined, "Oups")).toBe("Oups");
    expect(apiErrorMessage({})).toBe("Une erreur est survenue. Réessayez.");
  });
});
