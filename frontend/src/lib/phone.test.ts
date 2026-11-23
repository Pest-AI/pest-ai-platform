import { describe, expect, it } from "vitest";

import { formatPhone, toInternationalPhone } from "@/lib/phone";

describe("toInternationalPhone", () => {
  it("complète un numéro sénégalais local avec +221", () => {
    expect(toInternationalPhone("78 436 35 37")).toBe("+221784363537");
    expect(toInternationalPhone("33-823-45-67")).toBe("+221338234567");
  });

  it("conserve un numéro déjà international", () => {
    expect(toInternationalPhone("+221 78 436 35 37")).toBe("+221784363537");
    expect(toInternationalPhone("+33 6 12 34 56 78")).toBe("+33612345678");
  });

  it("convertit 00 et 221 sans + en format international", () => {
    expect(toInternationalPhone("00221784363537")).toBe("+221784363537");
    expect(toInternationalPhone("221784363537")).toBe("+221784363537");
  });

  it("laisse l'API refuser un numéro incomplet", () => {
    expect(toInternationalPhone("7843")).toBe("7843");
  });
});

describe("formatPhone", () => {
  it("espace un numéro sénégalais", () => {
    expect(formatPhone("+221784363537")).toBe("+221 78 436 35 37");
    expect(formatPhone("+33612345678")).toBe("+33612345678");
  });
});
