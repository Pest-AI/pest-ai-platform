import { describe, expect, it } from "vitest";

import { agroidFromText, agroidUrl, qrMatrix, qrPath } from "@/lib/qr";

describe("QR code AgroID", () => {
  it("encode le lien terrain de la parcelle", () => {
    const m = qrMatrix(agroidUrl("PAI-SN-71QJ9WV7"));
    expect(m.length).toBeGreaterThanOrEqual(25);
    expect(m[0]?.slice(0, 7).every(Boolean)).toBe(true); // repère de position
    expect(qrPath(m).size).toBe(m.length + 8);
  });

  it("retrouve l'AgroID dans un lien, un AgroID seul ou une saisie libre", () => {
    expect(agroidFromText("https://terrain.pestai.africa/a/PAI-SN-71QJ9WV7")).toBe("PAI-SN-71QJ9WV7");
    expect(agroidFromText("pai sn 71qj9wv7")).toBe("PAI-SN-71QJ9WV7");
    expect(agroidFromText("PRD-SN-71QJ9WV7")).toBeNull();
  });
});
