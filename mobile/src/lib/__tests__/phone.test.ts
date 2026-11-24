import { formatPhone, toInternationalPhone } from "../phone";

describe("téléphone", () => {
  it("ajoute +221 aux numéros sénégalais", () => {
    expect(toInternationalPhone("77 123 45 67")).toBe("+221771234567");
    expect(toInternationalPhone("00221771234567")).toBe("+221771234567");
    expect(toInternationalPhone("+33612345678")).toBe("+33612345678");
  });
  it("formate pour l'affichage", () => {
    expect(formatPhone("+221771234567")).toBe("+221 77 123 45 67");
  });
});
