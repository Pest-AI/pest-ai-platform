import { describe, expect, it } from "vitest";

import { COUNTRIES, FIRST_COUNTRIES } from "@/lib/countries";
import { findCountry, flag, formatPhone, lengthHint, splitPhone, toInternationalPhone } from "@/lib/phone";

describe("toInternationalPhone", () => {
  it("complète un numéro local avec l'indicatif du pays choisi (Sénégal par défaut)", () => {
    expect(toInternationalPhone("78 436 35 37")).toBe("+221784363537");
    expect(toInternationalPhone("33-823-45-67")).toBe("+221338234567");
    expect(toInternationalPhone("76 12 34 56", "ML")).toBe("+22376123456");
  });

  it("retire le 0 national initial", () => {
    expect(toInternationalPhone("06 12 34 56 78", "FR")).toBe("+33612345678");
  });

  it("conserve un numéro déjà international, quel que soit le pays choisi", () => {
    expect(toInternationalPhone("+221 78 436 35 37", "FR")).toBe("+221784363537");
    expect(toInternationalPhone("0033612345678")).toBe("+33612345678");
    expect(toInternationalPhone("221784363537")).toBe("+221784363537");
  });

  it("laisse l'API refuser un numéro incomplet", () => {
    expect(toInternationalPhone("7843")).toBe("+2217843");
    expect(toInternationalPhone("   ")).toBe("");
  });
});

describe("pays", () => {
  it("met le Sénégal puis l'Afrique de l'Ouest en tête", () => {
    expect(COUNTRIES[0]?.iso).toBe("SN");
    expect(COUNTRIES.slice(0, FIRST_COUNTRIES).map((c) => c.iso)).toContain("ML");
    expect(COUNTRIES.length).toBeGreaterThan(200);
  });

  it("affiche un drapeau et retrouve le pays d'un numéro", () => {
    expect(flag("SN")).toBe("🇸🇳");
    expect(splitPhone("+22376123456").country.iso).toBe("ML");
    expect(splitPhone("+33612345678").national).toBe("612345678");
  });

  it("indique la longueur attendue", () => {
    expect(lengthHint(findCountry("SN"), "78 436 35")).toBe("9 chiffres attendus pour Sénégal");
    expect(lengthHint(findCountry("SN"), "78 436 35 37")).toBeNull();
  });
});

describe("formatPhone", () => {
  it("espace un numéro sénégalais, sépare l'indicatif des autres", () => {
    expect(formatPhone("+221784363537")).toBe("+221 78 436 35 37");
    expect(formatPhone("+33612345678")).toBe("+33 612345678");
  });
});
