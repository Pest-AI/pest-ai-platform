import { describe, expect, it } from "vitest";

import { approximateAge, parseBirthYear, producerInitials } from "@/lib/producers";

describe("producteurs", () => {
  it("calcule les initiales", () => {
    expect(producerInitials("aïssatou", "Diallo")).toBe("AD");
  });
  it("donne un âge approximatif", () => {
    const today = new Date("2026-11-23");
    expect(approximateAge(1985, today)).toBe(41);
    expect(approximateAge(null, today)).toBeNull();
  });
  it("valide l'année de naissance", () => {
    const today = new Date("2026-11-23");
    expect(parseBirthYear("1985", today)).toBe(1985);
    expect(parseBirthYear("2030", today)).toBeNull();
    expect(parseBirthYear("abc", today)).toBeNull();
    expect(parseBirthYear("", today)).toBeNull();
  });
});
