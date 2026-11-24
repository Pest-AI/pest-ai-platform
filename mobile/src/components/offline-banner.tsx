import { WifiOff } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { T } from "@/components/ui";
import { useOnline } from "@/lib/network";
import { colors } from "@/theme";

/** Bandeau affiché en bas de l'écran (sans masquer les en-têtes) tant que le téléphone est hors ligne. */
export function OfflineBanner() {
  const online = useOnline();
  const insets = useSafeAreaInsets();
  if (online) return null;
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[styles.banner, { paddingBottom: insets.bottom + 10 }]}
      pointerEvents="none"
    >
      <WifiOff size={16} color={colors.night} />
      <T style={styles.text}>Hors ligne : les données affichées peuvent ne pas être à jour.</T>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.gold,
    paddingTop: 10,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  text: { color: colors.night, fontSize: 13, fontWeight: "700", flex: 1 },
});
