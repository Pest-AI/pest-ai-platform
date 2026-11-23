import { describe, expect, it } from "vitest";

import { isValidWorkspace, needsRefresh, tokenExpiry } from "@/lib/session";

function jwt(payload: object) {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "HS256" })}.${b64(payload)}.signature`;
}

describe("tokenExpiry", () => {
  it("lit l'expiration d'un JWT", () => {
    expect(tokenExpiry(jwt({ exp: 1_900_000_000 }))).toBe(1_900_000_000);
  });

  it("renvoie null pour un jeton absent ou illisible", () => {
    expect(tokenExpiry(undefined)).toBeNull();
    expect(tokenExpiry("pas-un-jwt")).toBeNull();
    expect(tokenExpiry("a.%%%.c")).toBeNull();
  });
});

describe("needsRefresh", () => {
  const now = 1_800_000_000;

  it("faux si le jeton est encore valide longtemps", () => {
    expect(needsRefresh(jwt({ exp: now + 600 }), now)).toBe(false);
  });

  it("vrai si le jeton expire dans moins d'une minute", () => {
    expect(needsRefresh(jwt({ exp: now + 30 }), now)).toBe(true);
  });

  it("vrai si le jeton est absent", () => {
    expect(needsRefresh(undefined, now)).toBe(true);
  });
});

describe("isValidWorkspace", () => {
  it("accepte org:<uuid>", () => {
    expect(isValidWorkspace("org:fabc6323-4881-44a6-933a-fcd38de7c875")).toBe(true);
  });

  it("refuse les autres formats", () => {
    expect(isValidWorkspace("personal")).toBe(false);
    expect(isValidWorkspace("org:123")).toBe(false);
    expect(isValidWorkspace(undefined)).toBe(false);
  });
});
