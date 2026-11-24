import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { isSameOrigin } from "@/lib/http";

function post(headers: Record<string, string>) {
  return new NextRequest("http://localhost:3000/api/session/login", {
    method: "POST",
    headers: { host: "app.pestai.africa", "x-forwarded-proto": "https", ...headers },
  });
}

describe("isSameOrigin", () => {
  it("accepte une requête du site", () => {
    expect(isSameOrigin(post({ origin: "https://app.pestai.africa" }))).toBe(true);
    expect(isSameOrigin(post({ "sec-fetch-site": "same-origin" }))).toBe(true);
  });
  it("refuse une requête d'un autre site", () => {
    expect(isSameOrigin(post({ origin: "https://attaquant.example" }))).toBe(false);
    expect(isSameOrigin(post({ origin: "null" }))).toBe(false);
    expect(isSameOrigin(post({ "sec-fetch-site": "cross-site" }))).toBe(false);
  });
});
