import { View } from "react-native";

import { Chips } from "@/components/chips";
import { Card, Input, T } from "@/components/ui";
import { colors } from "@/theme";

export type Owner = "operator" | "other" | "unknown";
export const OWNERS: { value: Owner; label: string; personalLabel?: string }[] = [
  { value: "operator", label: "L'exploitant", personalLabel: "Moi-même" },
  { value: "other", label: "Une autre personne" },
  { value: "unknown", label: "Ne sait pas" },
];
export const TENURES = [
  ["communal_allocation", "Affectation communale"],
  ["customary_right", "Droit coutumier"],
  ["family_land", "Terre familiale"],
  ["titled_property", "Titre foncier"],
  ["lease", "Bail"],
  ["communal", "Terre communautaire"],
  ["other", "Autre"],
  ["unknown", "Inconnu"],
] as const;
export const ARRANGEMENTS = [
  ["rental", "Location"],
  ["sharecropping", "Métayage"],
  ["loan", "Prêt"],
  ["other", "Autre"],
] as const;
export const RENTS = [
  ["cash", "En argent"],
  ["harvest_share", "Part de récolte"],
  ["in_kind", "En nature"],
  ["free", "Gratuit"],
  ["unknown", "Ne sait pas"],
] as const;

export type Tenure = (typeof TENURES)[number][0];
export type Arrangement = (typeof ARRANGEMENTS)[number][0];
export type Rent = (typeof RENTS)[number][0];

export type Land = {
  owner: Owner;
  ownerName: string;
  tenure: Tenure;
  arrangement: Arrangement;
  rent: Rent | "";
  rentAmount: string;
  rentShare: string;
};

export const EMPTY_LAND: Land = { owner: "unknown", ownerName: "", tenure: "unknown", arrangement: "rental", rent: "", rentAmount: "", rentShare: "" };

/** Étape « Foncier » : propriétaire déclaré, type de droit, mode d'exploitation et contrepartie. */
export function LandStep({ value, onChange, personal }: { value: Land; onChange: (v: Land) => void; personal: boolean }) {
  const set = <K extends keyof Land>(k: K) => (v: Land[K]) => onChange({ ...value, [k]: v });
  return (
    <>
      <Card style={{ gap: 8 }}>
        <T style={{ fontSize: 14, fontWeight: "700" }}>Propriétaire de la parcelle</T>
        <Chips
          label="Propriétaire de la parcelle"
          options={OWNERS.map((o) => [o.value, personal && o.personalLabel ? o.personalLabel : o.label] as const)}
          value={value.owner}
          onChange={(v) => v && set("owner")(v)}
        />
        {value.owner === "other" ? (
          <View style={{ gap: 6, marginTop: 4 }}>
            <T style={{ fontSize: 14, fontWeight: "700" }}>Nom du propriétaire</T>
            <Input accessibilityLabel="Nom du propriétaire" placeholder="ex. Famille Diallo" value={value.ownerName} onChangeText={set("ownerName")} autoCapitalize="words" />
          </View>
        ) : null}
      </Card>

      {value.owner !== "unknown" ? (
        <Card style={{ gap: 8 }}>
          <T style={{ fontSize: 14, fontWeight: "700" }}>Type de droit</T>
          <Chips label="Type de droit" options={TENURES} value={value.tenure} onChange={(v) => v && set("tenure")(v)} />
        </Card>
      ) : null}

      {value.owner === "other" ? (
        <Card style={{ gap: 8 }}>
          <T style={{ fontSize: 14, fontWeight: "700" }}>L&apos;exploitant la cultive en</T>
          <Chips label="Mode d'exploitation" options={ARRANGEMENTS} value={value.arrangement} onChange={(v) => v && set("arrangement")(v)} />
          {value.arrangement !== "other" ? (
            <View style={{ gap: 8, marginTop: 4 }}>
              <T style={{ fontSize: 14, fontWeight: "700" }}>Contrepartie</T>
              <Chips label="Contrepartie" options={RENTS} value={value.rent} onChange={set("rent")} clearable />
              {value.rent === "cash" ? (
                <Input accessibilityLabel="Montant du loyer en FCFA par campagne" keyboardType="number-pad" placeholder="Loyer en FCFA par campagne" value={value.rentAmount} onChangeText={set("rentAmount")} maxLength={10} />
              ) : null}
              {value.rent === "harvest_share" ? (
                <Input accessibilityLabel="Part de la récolte en pourcentage" keyboardType="decimal-pad" placeholder="Part de la récolte (%) — ex. 33" value={value.rentShare} onChangeText={set("rentShare")} maxLength={5} />
              ) : null}
            </View>
          ) : null}
        </Card>
      ) : null}

      <T style={{ color: colors.muted, fontSize: 13 }}>Déclaration du producteur : un document pourra la confirmer plus tard.</T>
    </>
  );
}

/** Corps foncier de l'envoi (même règles que l'écran d'origine). */
export function landBody(land: Land, hasOperator: boolean): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (land.owner === "unknown") return body;
  body.ownership = { owner: land.owner, owner_name: land.owner === "other" ? land.ownerName.trim() : "", tenure_type: land.tenure };
  if (land.owner === "other" && hasOperator) {
    body.arrangement_type = land.arrangement;
    if (land.rent) {
      const amount = Number(land.rentAmount.replace(/\s/g, ""));
      const share = Number(land.rentShare.replace(",", "."));
      body.lease = {
        rent_type: land.rent,
        rent_amount_xof: land.rent === "cash" && land.rentAmount.trim() && Number.isFinite(amount) ? Math.round(amount) : null,
        harvest_share_percent: land.rent === "harvest_share" && land.rentShare.trim() && share > 0 && share <= 100 ? share.toFixed(2) : null,
      };
    }
  }
  return body;
}
