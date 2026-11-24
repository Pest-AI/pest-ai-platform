import type { Position } from "../geo";
import {
  type Fix,
  acceptFix,
  accuracyTone,
  closingGapM,
  medianAccuracy,
  perimeterM,
  ringAreaM2,
  toPolygon,
} from "../gps-track";

const fix = (position: Position, accuracy = 4): Fix => ({ position, accuracy, at: 0 });
// Carré d'environ 100 m × 100 m près de Podor.
const SQUARE: Position[] = [
  [-14.96, 16.65],
  [-14.959063, 16.65],
  [-14.959063, 16.650904],
  [-14.96, 16.650904],
];

describe("relevé GPS", () => {
  it("ignore les positions imprécises et, en marchant, les pas trop courts", () => {
    let pts: Fix[] = [];
    pts = acceptFix(pts, fix([-14.96, 16.65], 40), "walk");
    expect(pts).toHaveLength(0);
    pts = acceptFix(pts, fix([-14.96, 16.65]), "walk");
    pts = acceptFix(pts, fix([-14.96001, 16.65]), "walk"); // ~1 m
    expect(pts).toHaveLength(1);
    pts = acceptFix(pts, fix([-14.96005, 16.65]), "walk"); // ~5 m
    expect(pts).toHaveLength(2);
    expect(acceptFix(pts, fix([-14.96005, 16.65]), "corners")).toHaveLength(3);
  });

  it("mesure surface, périmètre et fermeture", () => {
    expect(ringAreaM2(SQUARE)).toBeGreaterThan(9500);
    expect(ringAreaM2(SQUARE)).toBeLessThan(10500);
    expect(perimeterM(SQUARE)).toBeGreaterThan(390);
    expect(closingGapM(SQUARE)).toBeGreaterThan(95);
    expect(closingGapM(SQUARE.slice(0, 2))).toBeNull();
  });

  it("ferme le polygone et calcule la précision médiane", () => {
    const pts = SQUARE.map((p, i) => fix(p, [3, 4, 12, 5][i]));
    const poly = toPolygon(pts);
    expect(poly.coordinates[0]).toHaveLength(5);
    expect(poly.coordinates[0]?.[4]).toEqual(SQUARE[0]);
    expect(medianAccuracy(pts)).toBe(4.5);
    expect(accuracyTone(4)).toBe("good");
    expect(accuracyTone(12)).toBe("poor");
  });
});
