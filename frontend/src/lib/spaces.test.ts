import { describe, expect, it } from "vitest";

import { countSince, organizationInitials, primaryRoleLabel, spacesForRoles } from "@/lib/spaces";

describe("espaces", () => {
  it("déduit les espaces des rôles, sans doublon", () => {
    expect(spacesForRoles(["cooperative_manager", "organization_admin", "agronomist"])).toEqual([
      "cooperative",
      "agronome",
    ]);
    expect(spacesForRoles(["field_agent"])).toEqual([]);
  });

  it("affiche le rôle le plus élevé", () => {
    expect(primaryRoleLabel(["field_agent", "cooperative_manager"])).toBe("Gérant de coopérative");
    expect(primaryRoleLabel([])).toBe("Membre");
  });

  it("calcule les initiales d'une organisation", () => {
    expect(organizationInitials("Coopérative agricole de Ross Béthio")).toBe("RB");
    expect(organizationInitials("Union des maraîchers des Niayes")).toBe("MN");
    expect(organizationInitials("PEST AI")).toBe("PA");
  });
});

describe("countSince", () => {
  it("compte les dates des 7 derniers jours", () => {
    const now = Date.parse("2026-11-23T12:00:00Z");
    expect(countSince(["2026-11-22T10:00:00Z", "2026-11-10T10:00:00Z", null, "2026-11-17T12:00:00Z"], 7, now)).toBe(2);
  });
});
