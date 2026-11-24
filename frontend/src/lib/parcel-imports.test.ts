import { describe, expect, it } from "vitest";

import { checkFile, formatBytes, producerOutcome, reportCsv } from "@/lib/parcel-imports";

describe("import de parcelles", () => {
  it("contrôle le fichier avant envoi", () => {
    expect(checkFile(null)).toMatch("Choisissez");
    expect(checkFile({ name: "a.kml", size: 0 })).toMatch("vide");
    expect(checkFile({ name: "a.kml", size: 11 * 1024 * 1024 })).toMatch("10 Mo");
    expect(checkFile({ name: "a.docx", size: 10 })).toMatch("Format non reconnu");
    expect(checkFile({ name: "cooperative.xlsx", size: 10 })).toBeNull();
    expect(checkFile({ name: "releve.gpx", size: 10 })).toBeNull();
    expect(checkFile({ name: "Champs.KMZ", size: 10 })).toBeNull();
    expect(checkFile({ name: "export.zip", size: 10 })).toBeNull();
  });

  it("formate les tailles", () => {
    expect(formatBytes(512)).toBe("512 o");
    expect(formatBytes(2048)).toBe("2 Ko");
    expect(formatBytes(1.5 * 1024 * 1024)).toBe("1,5 Mo");
  });

  it("écrit un rapport CSV lisible par Excel, sans formule", () => {
    const csv = reportCsv(
      [
        { index: 1, label: "Champ; nord", status: "ok", messages: [], agroid: "PAI-SN-7K4M9X2Q", operator: "Awa Sow" },
        { index: 2, label: "=HYPERLINK(1)", status: "refused", messages: ["Doublon de la ligne 1."] },
      ],
      true,
    );
    const lines = csv.replace("﻿", "").trim().split("\r\n");
    expect(csv.startsWith("﻿")).toBe(true);
    expect(lines[0]).toBe("Ligne;Nom;Statut;AgroID;Exploitant;Motifs");
    expect(lines[1]).toBe('1;"Champ; nord";Prête;PAI-SN-7K4M9X2Q;Awa Sow;');
    expect(lines[2]).toBe("2;'=HYPERLINK(1);Refusée;Non créée;;Doublon de la ligne 1.");
  });

  it("ajoute l'onglet Producteurs au rapport", () => {
    const producer = {
      index: 2,
      name: "Moussa Diallo",
      phone: "+221770002233",
      membership_number: "ADH-002",
      locality: "Guédé",
      status: "ok" as const,
      action: "create" as const,
      messages: [],
      created: true,
    };
    expect(producerOutcome(producer, false)).toBe("Nouvelle fiche");
    expect(producerOutcome({ ...producer, status: "flagged" }, false)).toBe("Doublon probable");
    expect(producerOutcome({ ...producer, action: "existing" }, true)).toBe("Déjà dans le registre");
    const lines = reportCsv([], true, [producer]).replace("\uFEFF", "").split("\r\n");
    expect(lines[0]).toBe("Producteur (ligne);Nom;Résultat;Téléphone;N° d'adhérent;Motifs");
    expect(lines[1]).toBe("2;Moussa Diallo;Créé;'+221770002233;ADH-002;");
    expect(lines[3]).toBe("Ligne;Nom;Statut;AgroID;Exploitant;Motifs");
  });
});
