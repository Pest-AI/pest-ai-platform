import { describe, expect, it } from "vitest";

import { CYCLE_NEXT, campaignPeriod, formatKg, shortDate, todayIso, yieldTHa } from "@/lib/agriculture";

describe("agriculture", () => {
  it("formate les dates courtes", () => {
    expect(shortDate("2026-11-12")).toBe("12 nov. 2026");
    expect(shortDate(null)).toBe("—");
    expect(campaignPeriod("2026-06-15", null)).toBe("depuis le 15 juin 2026");
  });

  it("formate les quantités", () => {
    expect(formatKg("3200")).toBe("3 200 kg");
    expect(formatKg(12500)).toBe("12,5 t");
    expect(formatKg(null)).toBe("—");
  });

  it("calcule le rendement", () => {
    expect(yieldTHa(3200, 5000)).toBe("6,4 t/ha");
    expect(yieldTHa(0, 5000)).toBeNull();
    expect(yieldTHa(100, null)).toBeNull();
  });

  it("ne propose aucun passage après récolte", () => {
    expect(CYCLE_NEXT.harvested).toEqual([]);
    expect(CYCLE_NEXT.planned?.map((n) => n.status)).toEqual(["in_progress", "abandoned"]);
    expect(todayIso(new Date("2026-11-24T23:30:00Z"))).toBe("2026-11-24");
  });
});
