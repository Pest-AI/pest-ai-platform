import { createElement } from "react";
import { Platform, StyleSheet } from "react-native";

import { Input } from "@/components/ui";
import { colors, fonts, radius } from "@/theme";

/**
 * Date (AAAA-MM-JJ). Navigateur (PWA) : sélecteur de date du téléphone ; application native :
 * saisie au clavier en attendant le sélecteur natif (stores).
 */
export function DateField({ value, onChange, label, max }: { value: string; onChange: (v: string) => void; label: string; max?: string }) {
  if (Platform.OS === "web") {
    return createElement("input", {
      type: "date",
      value,
      max,
      "aria-label": label,
      onChange: (e: { target: { value: string } }) => onChange(e.target.value),
      style: StyleSheet.flatten(styles.web),
    });
  }
  return <Input accessibilityLabel={label} placeholder="AAAA-MM-JJ" value={value} onChangeText={onChange} keyboardType="numbers-and-punctuation" maxLength={10} />;
}

const styles = StyleSheet.create({
  web: {
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.canvas,
    paddingHorizontal: 12,
    fontSize: 16,
    color: colors.ink,
    fontFamily: fonts.mono,
  },
});
