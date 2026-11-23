import { describe, expect, it } from "vitest";

import { organizationInitials, primaryRoleLabel, spacesForRoles } from "@/lib/spaces";

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
