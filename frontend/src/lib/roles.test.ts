import { describe, expect, it } from "vitest";

import { ASSIGNABLE_ROLES, managedByPestAi, teamRights } from "@/lib/roles";
import { canUseWebOS, isWebWorkspace, webMemberships } from "@/lib/spaces";

describe("teamRights", () => {
  it("donne la gestion à l'administrateur et au gérant", () => {
    expect(teamRights(["organization_admin"])).toEqual({ isAdmin: true, canManage: true });
    expect(teamRights(["cooperative_manager"])).toEqual({ isAdmin: false, canManage: true });
    expect(teamRights(["field_agent", "agronomist"])).toEqual({ isAdmin: false, canManage: false });
  });
});

describe("agents terrain gérés par PEST AI", () => {
  it("ne sont pas proposés à la coopérative", () => {
    expect(ASSIGNABLE_ROLES.map((r) => r.code)).not.toContain("field_agent");
    expect(managedByPestAi(["field_agent"])).toBe(true);
    expect(managedByPestAi(["agronomist"])).toBe(false);
  });
});

describe("accès au Web OS", () => {
  const m = (roles: string[], status = "active", workspace = "org:a") => ({ roles, status, workspace });

  it("refuse l'agent terrain et le producteur, accepte les rôles de gestion", () => {
    expect(canUseWebOS({ memberships: [m(["field_agent"])] })).toBe(false);
    expect(canUseWebOS({ memberships: [m(["producer"])] })).toBe(false);
    expect(canUseWebOS({ memberships: [m(["field_agent"], "invited")] })).toBe(false);
    for (const role of ["organization_admin", "cooperative_manager", "agronomist", "program_manager"]) {
      expect(canUseWebOS({ memberships: [m([role])] })).toBe(true);
    }
    expect(canUseWebOS({ memberships: [m(["cooperative_manager"], "invited")] })).toBe(true);
    expect(canUseWebOS({ memberships: [m(["cooperative_manager"], "suspended")] })).toBe(false);
    expect(canUseWebOS({ is_platform_admin: true, memberships: [] })).toBe(true);
  });

  it("ne garde que les espaces ouverts dans le Web OS", () => {
    const me = { memberships: [m(["field_agent"], "active", "org:a"), m(["agronomist"], "active", "org:b")] };
    expect(webMemberships(me.memberships).map((x) => x.workspace)).toEqual(["org:b"]);
    expect(isWebWorkspace(me, "org:a")).toBe(false);
    expect(isWebWorkspace(me, "org:b")).toBe(true);
  });
});
