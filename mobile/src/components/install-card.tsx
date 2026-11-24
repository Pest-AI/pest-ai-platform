import { Download, Share, X } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";

import { Button, T } from "@/components/ui";
import { useInstallPrompt } from "@/lib/pwa";
import { colors, radius } from "@/theme";

/** Carte « Installer l'app » (version navigateur uniquement ; disparaît une fois installée). */
export function InstallCard() {
  const state = useInstallPrompt();
  if (state.kind === "none") return null;
  return (
    <View style={styles.card} accessibilityRole="summary">
      <View style={styles.icon}>
        {state.kind === "android" ? (
          <Download size={20} color={colors.forest} />
        ) : (
          <Share size={20} color={colors.forest} />
        )}
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <T style={{ fontSize: 15, fontWeight: "700" }}>Installer PEST AI sur ce téléphone</T>
        <T style={{ fontSize: 13, color: colors.muted }}>
          {state.kind === "android"
            ? "Accès direct depuis l'écran d'accueil, en plein écran."
            : "Touchez Partager, puis « Sur l'écran d'accueil »."}
        </T>
        {state.kind === "android" ? (
          <View style={{ marginTop: 8, alignSelf: "flex-start" }}>
            <Button label="Installer" onPress={() => void state.install()} />
          </View>
        ) : null}
      </View>
      <Pressable onPress={state.dismiss} accessibilityRole="button" accessibilityLabel="Masquer" hitSlop={10}>
        <X size={18} color={colors.muted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
    backgroundColor: colors.brand50,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.canvas,
    alignItems: "center",
    justifyContent: "center",
  },
});
