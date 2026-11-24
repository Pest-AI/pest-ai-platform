import { describe, expect, it } from "vitest";

import { COUNTRIES } from "@/lib/countries";
import { findCountry, flag, formatPhone, lengthHint, splitPhone, toInternationalPhone } from "@/lib/phone";

describe("toInternationalPhone", () => {
  it("complète un numéro local avec l'indicatif du pays choisi (Sénégal par défaut)", () => {
    expect(toInternationalPhone("78 436 35 37")).toBe("+221784363537");
    expect(toInternationalPhone("33-823-45-67")).toBe("+221338234567");
    expect(toInternationalPhone("76 12 34 56", "ML")).toBe("+22376123456");
  });

  it("retire le 0 national, sauf en Côte d'Ivoire et au Bénin où il fait partie du numéro", () => {
    expect(toInternationalPhone("0802 123 4567", "NG")).toBe("+2348021234567");
    expect(toInternationalPhone("07 07 12 34 56", "CI")).toBe("+2250707123456");
    expect(toInternationalPhone("01 97 12 34 56", "BJ")).toBe("+2290197123456");
  });

  it("conserve un numéro déjà international, quel que soit le pays choisi", () => {
    expect(toInternationalPhone("+221 78 436 35 37", "ML")).toBe("+221784363537");
    expect(toInternationalPhone("0033612345678")).toBe("+33612345678");
    expect(toInternationalPhone("221784363537")).toBe("+221784363537");
  });

  it("laisse l'API refuser un numéro incomplet", () => {
    expect(toInternationalPhone("7843")).toBe("+2217843");
    expect(toInternationalPhone("   ")).toBe("");
  });
});

describe("pays", () => {
  it("propose l'Afrique de l'Ouest seulement, Sénégal en tête, Mauritanie comprise", () => {
    const codes = COUNTRIES.map((c) => c.iso);
    expect(codes[0]).toBe("SN");
    expect(codes).toHaveLength(16);
    expect(codes).toEqual(expect.arrayContaining(["ML", "MR", "CI", "NG", "CV"]));
    expect(codes).not.toContain("FR");
  });

  it("affiche un drapeau et retrouve le pays d'un numéro", () => {
    expect(flag("SN")).toBe("🇸🇳");
    expect(splitPhone("+22376123456").country.iso).toBe("ML");
    expect(splitPhone("+2250707123456").national).toBe("0707123456");
  });

  it("garde tel quel un numéro étranger déjà enregistré", () => {
    expect(splitPhone("+33612345678").national).toBe("+33612345678");
    expect(toInternationalPhone(splitPhone("+33612345678").national, "SN")).toBe("+33612345678");
  });

  it("indique la longueur attendue", () => {
    expect(lengthHint(findCountry("SN"), "78 436 35")).toBe("9 chiffres attendus pour Sénégal");
    expect(lengthHint(findCountry("SN"), "78 436 35 37")).toBeNull();
    expect(lengthHint(findCountry("CI"), "07 07 12 34 56")).toBeNull();
  });
});

describe("formatPhone", () => {
  it("espace un numéro sénégalais, sépare l'indicatif des autres", () => {
    expect(formatPhone("+221784363537")).toBe("+221 78 436 35 37");
    expect(formatPhone("+22376123456")).toBe("+223 76123456");
    expect(formatPhone("+33612345678")).toBe("+33612345678");
  });
});
