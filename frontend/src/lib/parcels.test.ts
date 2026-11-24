import { describe, expect, it } from "vitest";

import { bboxParam, formatArea, hectares, padBbox, parcelStatus, parseBbox } from "@/lib/parcels";

describe("parcelles", () => {
  it("formate les surfaces", () => {
    expect(formatArea(640)).toBe("640 m²");
    expect(formatArea("9987.42")).toBe("1 ha");
    expect(formatArea(25_000)).toBe("2,5 ha");
    expect(formatArea(null)).toBe("—");
    expect(hectares("0")).toBe("0");
    expect(hectares(123_456)).toBe("12,3");
  });

  it("lit et écrit les emprises", () => {
    expect(parseBbox("-15.1,16.5,-14.8,16.8")).toEqual([-15.1, 16.5, -14.8, 16.8]);
    expect(parseBbox("1,2,3")).toBeNull();
    expect(parseBbox("10,10,5,5")).toBeNull();
    expect(parseBbox("a,b,c,d")).toBeNull();
    expect(bboxParam([-15.1, 16.5, -14.8, 16.8])).toBe("-15.100000,16.500000,-14.800000,16.800000");
  });

  it("élargit le cadrage d'une parcelle seule", () => {
    const [a, b, c, d] = padBbox([-14.96, 16.65, -14.96, 16.65]);
    expect(c - a).toBeCloseTo(0.01);
    expect(d - b).toBeCloseTo(0.01);
  });

  it("donne un libellé à chaque statut", () => {
    expect(parcelStatus("pending_validation").label).toBe("À vérifier");
    expect(parcelStatus("inconnu").label).toBe("inconnu");
  });
});
