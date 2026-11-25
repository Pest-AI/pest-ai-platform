import { agroidFromText, agroidUrl, qrMatrix, qrPath } from "../qr";

describe("QR code AgroID", () => {
  it("encode le lien terrain et retrouve l'AgroID dans une lecture", () => {
    const m = qrMatrix(agroidUrl("PAI-SN-71QJ9WV7"));
    expect(qrPath(m).size).toBe(m.length + 8);
    expect(agroidFromText("https://terrain.pestai.africa/a/PAI-SN-71QJ9WV7")).toBe("PAI-SN-71QJ9WV7");
    expect(agroidFromText("pai-sn 71qj9wv7")).toBe("PAI-SN-71QJ9WV7");
    expect(agroidFromText("bonjour")).toBeNull();
  });
});
