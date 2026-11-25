import { EMPTY_LAND, landBody } from "../../components/enrolment/land-step";
import { clearDraft, loadDraft, saveDraft, setDraftStore } from "../enrolment-draft";
import { memoryStore } from "../local-db";

describe("enrôlement en étapes", () => {
  it("garde le brouillon par espace, avec l'étape, puis l'efface", async () => {
    setDraftStore(memoryStore());
    await saveDraft("org:1", { name: "Champ", points: [1, 2, 3] }, { step: 2, saved_at: "2026-11-25T08:00:00Z", label: "Champ" });
    const draft = await loadDraft<{ name: string; points: number[] }>("org:1");
    expect(draft?.points).toHaveLength(3);
    expect(draft?.meta.step).toBe(2);
    expect(await loadDraft("org:2")).toBeNull();
    await clearDraft("org:1");
    expect(await loadDraft("org:1")).toBeNull();
  });

  it("foncier : rien si inconnu, location en argent avec montant arrondi", () => {
    expect(landBody(EMPTY_LAND, true)).toEqual({});
    const body = landBody(
      { ...EMPTY_LAND, owner: "other", ownerName: " Famille Diallo ", tenure: "customary_right", arrangement: "rental", rent: "cash", rentAmount: "75 000" },
      true,
    );
    expect(body).toEqual({
      ownership: { owner: "other", owner_name: "Famille Diallo", tenure_type: "customary_right" },
      arrangement_type: "rental",
      lease: { rent_type: "cash", rent_amount_xof: 75000, harvest_share_percent: null },
    });
  });
});

import { checkSoil, soilBody } from "../soil";

const PARAMS = [
  { code: "ph", label: "pH", unit: "", min: "0", max: "14", usual_min: "4.5", usual_max: "9", decimals: 1, kit: true },
  { code: "ec", label: "Conductivité", unit: "µS/cm", min: "0", max: "20000", usual_min: "0", usual_max: "4000", decimals: 0, kit: true },
];

describe("mesures du kit de sol", () => {
  it("valeur impossible bloquante, inhabituelle signalée, virgule acceptée", () => {
    const c = checkSoil(PARAMS, { values: { ph: "15", ec: "6 000" }, depth: "", device: "" });
    expect(Object.keys(c.errors)).toEqual(["ph"]);
    expect(Object.keys(c.unusual)).toEqual(["ec"]);
    expect(checkSoil(PARAMS, { values: { ph: "6,8" }, depth: "", device: "" })).toMatchObject({ errors: {}, unusual: {}, filled: 1 });
  });

  it("corps d'envoi : champs vides omis, rien si aucune valeur", () => {
    expect(soilBody(PARAMS, { values: { ph: " " }, depth: "", device: "" })).toBeNull();
    const body = soilBody(PARAMS, { values: { ph: "6,84", ec: "" }, depth: "20", device: " Testeur 7 en 1 " });
    expect(body).toMatchObject({ values: { ph: "6.8" }, method: "field_kit", device_model: "Testeur 7 en 1", depth_cm: 20 });
  });
});
