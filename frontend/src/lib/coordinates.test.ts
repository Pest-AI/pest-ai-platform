import { describe, expect, it } from "vitest";

import { parseCoordinates, polygonFrom, ringAreaM2 } from "@/lib/coordinates";

const points = (text: string) => parseCoordinates(text).map((l) => l.point ?? l.error);

describe("coordonnées saisies", () => {
  it("lit les décimaux, latitude d'abord", () => {
    expect(points("16.6512, -14.9634")).toEqual([[-14.9634, 16.6512]]);
    expect(points("16.6512,-14.9634")).toEqual([[-14.9634, 16.6512]]);
    expect(points("16,6512 ; -14,9634")).toEqual([[-14.9634, 16.6512]]);
    expect(points("16,6512 -14,9634")).toEqual([[-14.9634, 16.6512]]);
    expect(points("16.6512\t-14.9634")).toEqual([[-14.9634, 16.6512]]);
  });

  it("lit les degrés, minutes, secondes", () => {
    const [[lon, lat]] = points(`16°39'04.3"N 14°57'48.2"W`) as [[number, number]];
    expect(lat).toBeCloseTo(16.65119, 4);
    expect(lon).toBeCloseTo(-14.96339, 4);
    const [[lon2, lat2]] = points("N16 39.072 O14 57.803") as [[number, number]];
    expect(lat2).toBeCloseTo(16.6512, 4);
    expect(lon2).toBeCloseTo(-14.96338, 4);
  });

  it("signale les lignes illisibles ou hors limites, ignore les vides", () => {
    const parsed = parseCoordinates("16.65, -14.96\n\nbonjour\n-14.96, 200");
    expect(parsed.map((l) => l.line)).toEqual([1, 3, 4]);
    expect(parsed[1]?.error).toMatch("illisible");
    expect(parsed[2]?.error).toMatch("hors limites");
  });

  it("ferme l'anneau et estime la surface", () => {
    const square: [number, number][] = [
      [-14.96, 16.65],
      [-14.959063, 16.65],
      [-14.959063, 16.650904],
      [-14.96, 16.650904],
    ];
    expect(polygonFrom(square).coordinates[0]).toHaveLength(5);
    expect(ringAreaM2(square)).toBeGreaterThan(9500);
    expect(ringAreaM2(square)).toBeLessThan(10500);
  });
});
