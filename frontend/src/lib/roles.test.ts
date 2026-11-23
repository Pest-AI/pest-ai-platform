import { describe, expect, it } from "vitest";

import { teamRights } from "@/lib/roles";

describe("teamRights", () => {
  it("donne la gestion à l'administrateur et au gérant", () => {
    expect(teamRights(["organization_admin"])).toEqual({ isAdmin: true, canManage: true });
    expect(teamRights(["cooperative_manager"])).toEqual({ isAdmin: false, canManage: true });
    expect(teamRights(["field_agent", "agronomist"])).toEqual({ isAdmin: false, canManage: false });
  });
});
