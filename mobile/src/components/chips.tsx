import { Pressable, StyleSheet, View } from "react-native";

import { T } from "@/components/ui";
import { colors } from "@/theme";

/** Choix unique en pastilles (référentiels fermés). Toucher la valeur choisie la retire si `clearable`. */
export function Chips<V extends string>({
  options,
  value,
  onChange,
  label,
  clearable = false,
}: {
  options: readonly (readonly [V, string])[];
  value: V | "";
  onChange: (v: V | "") => void;
  label: string;
  clearable?: boolean;
}) {
  return (
    <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map(([v, text]) => {
        const on = value === v;
        return (
          <Pressable
            key={v}
            onPress={() => onChange(on && clearable ? "" : v)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            style={[styles.chip, on && styles.chipOn]}
          >
            <T style={{ fontSize: 14, fontWeight: "700", color: on ? colors.forest : colors.ink }}>{text}</T>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.canvas },
  chipOn: { borderColor: colors.forest, backgroundColor: colors.brand50 },
});
