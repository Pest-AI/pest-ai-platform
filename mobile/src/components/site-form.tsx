import { ChevronDown, ChevronUp, Droplets, Layers, Route } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Chips } from "@/components/chips";
import { Card, Input, T } from "@/components/ui";
import {
  ACCESS_FIELDS,
  FIELD_LABELS,
  SOIL_FIELDS,
  type SiteReferentials,
  type SiteValues,
  WATER_FIELDS,
  options,
} from "@/lib/site";
import { colors } from "@/theme";

const SCHEMES_WITH_NAME = ["saed_large", "piv", "private"];

function Section({
  title,
  icon,
  filled,
  children,
  defaultOpen,
}: {
  title: string;
  icon: React.ReactNode;
  filled: number;
  children: React.ReactNode;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card style={{ gap: 12 }}>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
      >
        {icon}
        <T style={{ flex: 1, fontSize: 16, fontWeight: "700" }} accessibilityRole="header">
          {title}
        </T>
        <T style={{ color: filled ? colors.success : colors.muted, fontSize: 13 }}>{filled ? `${filled} renseigné${filled > 1 ? "s" : ""}` : "Facultatif"}</T>
        {open ? <ChevronUp size={18} color={colors.muted} /> : <ChevronDown size={18} color={colors.muted} />}
      </Pressable>
      {open ? children : null}
    </Card>
  );
}

/**
 * Sol, eau et irrigation, accès (J18d). Tout est facultatif ; « Ne sait pas » est une réponse.
 * Toucher une valeur choisie la retire.
 */
export function SiteForm({
  refs,
  values,
  onChange,
  defaultOpen = false,
  showEvidence = true,
}: {
  refs: SiteReferentials | null;
  values: SiteValues;
  onChange: (v: SiteValues) => void;
  defaultOpen?: boolean;
  showEvidence?: boolean;
}) {
  const set = (field: string) => (v: string) => onChange({ ...values, [field]: v });
  const count = (fields: readonly string[]) => fields.filter((f) => values[f]).length;
  const anyOther = Object.values(values).includes("other");

  if (!refs) {
    return <T style={{ color: colors.muted }}>Chargement des listes sol et eau… (réseau requis)</T>;
  }

  const fieldBlock = (field: string) => (
    <View key={field} style={{ gap: 6 }}>
      <T style={styles.label}>{FIELD_LABELS[field] ?? field}</T>
      <Chips label={FIELD_LABELS[field] ?? field} options={options(refs, field)} value={values[field] ?? ""} onChange={set(field)} clearable />
      {field === "scheme_type" && SCHEMES_WITH_NAME.includes(values.scheme_type ?? "") ? (
        <Input
          accessibilityLabel="Nom du périmètre"
          placeholder="Périmètre, casier ou maille (ex. PIV de Guédé, casier 3)"
          value={values.scheme_name ?? ""}
          onChangeText={set("scheme_name")}
        />
      ) : null}
    </View>
  );

  return (
    <View style={{ gap: 12 }}>
      <Section title="Eau et irrigation" icon={<Droplets size={18} color={colors.forest} />} filled={count(WATER_FIELDS)} defaultOpen={defaultOpen}>
        {WATER_FIELDS.map(fieldBlock)}
      </Section>
      <Section title="Sol" icon={<Layers size={18} color={colors.forest} />} filled={count(SOIL_FIELDS)} defaultOpen={defaultOpen}>
        {SOIL_FIELDS.map(fieldBlock)}
      </Section>
      <Section title="Accès" icon={<Route size={18} color={colors.forest} />} filled={count(ACCESS_FIELDS) + (values.distance_to_village_km ? 1 : 0)} defaultOpen={false}>
        {ACCESS_FIELDS.map(fieldBlock)}
        <View style={{ gap: 6 }}>
          <T style={styles.label}>Distance au village (km)</T>
          <Input
            accessibilityLabel="Distance au village en kilomètres"
            keyboardType="decimal-pad"
            placeholder="ex. 2,5"
            value={values.distance_to_village_km ?? ""}
            onChangeText={set("distance_to_village_km")}
            maxLength={5}
          />
        </View>
      </Section>
      {anyOther ? (
        <View style={{ gap: 6 }}>
          <T style={styles.label}>Précisez « Autre »</T>
          <Input accessibilityLabel="Précision pour Autre" value={values.other_detail ?? ""} onChangeText={set("other_detail")} />
        </View>
      ) : null}
      {showEvidence ? (
        <View style={{ gap: 6 }}>
          <T style={styles.label}>Ces informations sont</T>
          <Chips
            label="Niveau de preuve"
            options={(refs.evidence ?? []).filter((e) => e.value !== "measured").map((e) => [e.value, e.label] as const)}
            value={values.evidence ?? "declared"}
            onChange={(v) => onChange({ ...values, evidence: v || "declared" })}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 14, fontWeight: "700" },
});
