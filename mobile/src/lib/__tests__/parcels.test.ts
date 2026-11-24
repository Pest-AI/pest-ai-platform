import { createApiClient } from "../api";
import { matchesParcel, normalizeAgroid } from "../agroid";
import { bboxOf, distanceM, formatArea, projector, svgPath, type MultiPolygon } from "../geo";
import { clearParcelCache, freshness, isStale, loadSnapshot, memoryStore, syncParcels, setParcelStore } from "../parcel-cache";
import type { KeyValueStore } from "../storage";

const square = (lon: number, lat: number, d = 0.001): MultiPolygon => ({
  type: "MultiPolygon",
  coordinates: [[[[lon, lat], [lon + d, lat], [lon + d, lat + d], [lon, lat + d], [lon, lat]]]],
});

function tokens(): KeyValueStore {
  const m = new Map<string, string>([["pestai.access", "A"]]);
  return { get: async (k) => m.get(k) ?? null, set: async (k, v) => void m.set(k, v), remove: async (k) => void m.delete(k) };
}

describe("AgroID", () => {
  it("normalise la saisie comme le serveur", () => {
    expect(normalizeAgroid("pai sn 7k4m 9x2q")).toBe("PAI-SN-7K4M9X2Q");
    expect(normalizeAgroid("PAI-SN-7K4M9X2O")).toBe("PAI-SN-7K4M9X20");
    expect(normalizeAgroid("PAI-SN-7K4M9X2U")).toBeNull();
    expect(normalizeAgroid("champ")).toBeNull();
  });

  it("cherche par AgroID, nom ou exploitant, sans accents", () => {
    const p = { agroid: "PAI-SN-7K4M9X2Q", local_name: "Casier riz Nord", operator_name: "Aïssatou Sow" };
    expect(matchesParcel("pai-sn-7k4m9x2q", p)).toBe(true);
    expect(matchesParcel("PAI-SN-00000000", p)).toBe(false);
    expect(matchesParcel("7k4m", p)).toBe(true);
    expect(matchesParcel("riz", p)).toBe(true);
    expect(matchesParcel("aissatou", p)).toBe(true);
    expect(matchesParcel("", p)).toBe(true);
  });
});

describe("dessin des contours", () => {
  it("fait tenir les parcelles dans le cadre", () => {
    const geoms = [square(-14.96, 16.65), square(-14.95, 16.66)];
    const bbox = bboxOf(geoms)!;
    const proj = projector(bbox, 300, 200, 10);
    for (const g of geoms) {
      for (const [x, y] of g.coordinates[0]![0]!.map(proj.project)) {
        expect(x).toBeGreaterThanOrEqual(9.9);
        expect(x).toBeLessThanOrEqual(290.1);
        expect(y).toBeGreaterThanOrEqual(9.9);
        expect(y).toBeLessThanOrEqual(190.1);
      }
    }
    expect(svgPath(geoms[0]!, proj)).toMatch(/^M[\d.]+ [\d.]+ L.* Z$/);
  });

  it("mesure distances et surfaces", () => {
    expect(distanceM([-14.96, 16.65], [-14.96, 16.66])).toBeCloseTo(1112, -1);
    expect(formatArea("9987.4")).toBe("1 ha");
    expect(formatArea(640)).toBe("640 m²");
  });
});

describe("cache hors ligne", () => {
  beforeEach(() => setParcelStore(memoryStore()));

  it("synchronise contours et liste, puis relit sans réseau", async () => {
    const calls: string[] = [];
    const fetchImpl = (async (url: string) => {
      calls.push(url);
      const body = url.includes("/summary/")
        ? { count: 2, bbox: [-14.96, 16.65, -14.95, 16.66] }
        : url.includes("/map/")
          ? {
              features: [
                {
                  id: "p1",
                  geometry: square(-14.96, 16.65),
                  properties: { agroid: "PAI-SN-AAAAAAAA", local_name: "Casier", status: "active", area_m2: "9987.00", validation_status: "valid" },
                },
              ],
            }
          : {
              count: 2,
              next: null,
              results: [
                { id: "p1", agroid: "PAI-SN-AAAAAAAA", local_name: "Casier", status: "active", current_area_m2: "9987.00", centroid: [-14.9595, 16.6505], primary_operator: { name: "Moussa Sow" } },
                { id: "p2", agroid: null, local_name: "Brouillon", status: "draft", current_area_m2: null, centroid: null, primary_operator: null },
              ],
            };
      return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
    }) as unknown as typeof fetch;
    const api = createApiClient({ baseUrl: "https://api.test", store: tokens(), fetchImpl });
    const snap = await syncParcels(api, "org:1", new Date("2026-11-24T14:05:00Z"));
    expect(snap.parcels).toHaveLength(2);
    const p1 = snap.parcels.find((p) => p.id === "p1")!;
    expect(p1.geometry?.type).toBe("MultiPolygon");
    expect(p1.operator_name).toBe("Moussa Sow");
    expect(p1.validation_status).toBe("valid");
    expect(calls.some((u) => u.includes("bbox="))).toBe(true);
    const again = await loadSnapshot("org:1");
    expect(again?.synced_at).toBe("2026-11-24T14:05:00.000Z");
    expect(await loadSnapshot("org:2")).toBeNull(); // un cache par espace
    await clearParcelCache();
    expect(await loadSnapshot("org:1")).toBeNull();
  });

  it("dit l'âge des données", () => {
    const now = new Date("2026-11-24T14:30:00");
    expect(freshness("2026-11-24T14:29:50", now)).toBe("à l'instant");
    expect(freshness("2026-11-24T14:18:00", now)).toBe("il y a 12 min");
    expect(freshness("2026-11-24T11:00:00", now)).toBe("il y a 3 h");
    expect(freshness("2026-11-20T08:05:00", now)).toBe("le 20/11 à 08:05");
    expect(isStale("2026-11-24T14:25:00", now)).toBe(false);
    expect(isStale("2026-11-24T14:00:00", now)).toBe(true);
  });
});
