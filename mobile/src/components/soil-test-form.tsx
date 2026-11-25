import { AlertTriangle } from "lucide-react-native";
import { StyleSheet, View } from "react-native";

import { Chips } from "@/components/chips";
import { Card, Input, T } from "@/components/ui";
import { DEPTHS, type SoilDraft, type SoilParameter, checkSoil } from "@/lib/soil";
import { colors } from "@/theme";

/**
 * Saisie des valeurs lues sur le kit de terrain : une ligne par paramètre, avec son unité.
 * Valeur impossible : en rouge (bloque l'envoi) ; inhabituelle : en orange (signalée).
 */
export function SoilTestForm({
  params,
  value,
  onChange,
  showAll = false,
}: {
  params: SoilParameter[] | null;
  value: SoilDraft;
  onChange: (v: SoilDraft) => void;
  showAll?: boolean;
}) {
  if (!params) return <T style={{ color: colors.muted }}>Chargement des paramètres… (réseau requis une première fois)</T>;
  const shown = params.filter((p) => showAll || p.kit);
  const check = checkSoil(shown, value);
  return (
    <>
      <Card style={{ gap: 4, paddingVertical: 8 }}>
        {shown.map((p, i) => {
          const error = check.errors[p.code];
          const warn = check.unusual[p.code];
          return (
            <View key={p.code} style={[styles.row, i > 0 && styles.sep]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <T style={{ fontWeight: "700", fontSize: 15 }}>{p.label}</T>
                  <T style={{ color: colors.muted, fontSize: 12 }}>
                    {p.unit ? `${p.unit} · ` : ""}souvent {p.usual_min.replace(".", ",")}–{p.usual_max.replace(".", ",")}
                  </T>
                </View>
                <View style={{ width: 120 }}>
                  <Input
                    accessibilityLabel={`${p.label}${p.unit ? ` en ${p.unit}` : ""}`}
                    keyboardType="decimal-pad"
                    value={value.values[p.code] ?? ""}
                    onChangeText={(t) => onChange({ ...value, values: { ...value.values, [p.code]: t } })}
                    placeholder="—"
                    invalid={Boolean(error)}
                    style={{ textAlign: "right", fontSize: 18, minWidth: 0, width: "100%" }}
                    maxLength={8}
                  />
                </View>
              </View>
              {error ? <T style={{ color: colors.danger, fontSize: 13 }}>{error}</T> : null}
              {!error && warn ? (
                <View style={{ flexDirection: "row", gap: 6, alignItems: "flex-start" }}>
                  <AlertTriangle size={14} color={colors.warning} style={{ marginTop: 2 }} />
                  <T style={{ flex: 1, color: colors.warning, fontSize: 13 }}>{warn}</T>
                </View>
              ) : null}
            </View>
          );
        })}
      </Card>
      <Card style={{ gap: 12 }}>
        <View style={{ gap: 6 }}>
          <T style={styles.label}>Profondeur de la sonde</T>
          <Chips label="Profondeur de la sonde" options={DEPTHS} value={value.depth} onChange={(depth) => onChange({ ...value, depth })} clearable />
        </View>
        <View style={{ gap: 6 }}>
          <T style={styles.label}>Modèle du kit (facultatif)</T>
          <Input accessibilityLabel="Modèle du kit" placeholder="ex. Testeur 7 en 1" value={value.device} onChangeText={(device) => onChange({ ...value, device })} />
        </View>
      </Card>
      <T style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>
        Plantez la sonde dans un sol humide, à l&apos;écart des bords, et attendez que la valeur se stabilise. Laissez vide ce que le
        kit ne mesure pas.
      </T>
    </>
  );
}

const styles = StyleSheet.create({
  row: { gap: 6, paddingVertical: 10 },
  sep: { borderTopWidth: 1, borderTopColor: colors.line },
  label: { fontSize: 14, fontWeight: "700" },
});
