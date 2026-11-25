import { useRouter } from "expo-router";
import type * as React from "react";
import { ArrowLeftRight, LogOut } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar, T, initialsOf } from "@/components/ui";
import { confirmLogout } from "@/lib/confirm";
import { useSession } from "@/lib/session";
import { colors, radius } from "@/theme";

/** En-tête des écrans principaux : titre, périmètre actif, compte (déconnexion). */
export function SpaceHeader({ scopeName, title, subtitle, children }: { scopeName: string; title?: string; subtitle?: string; children?: React.ReactNode }) {
  const { me, signOut } = useSession();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.top, { paddingTop: insets.top + 12 }]}>
      <View style={styles.row}>
        <Pressable
          onPress={() => router.push("/espaces")}
          accessibilityRole="button"
          accessibilityLabel="Changer d'espace"
          style={styles.scope}
        >
          <T style={{ color: "rgba(255,255,255,0.65)", fontSize: 12 }}>Périmètre actif</T>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <T style={styles.scopeName} numberOfLines={1}>
              {scopeName}
            </T>
            <ArrowLeftRight size={14} color="rgba(255,255,255,0.7)" />
          </View>
        </Pressable>
        <Pressable
          onPress={() => confirmLogout(signOut)}
          accessibilityRole="button"
          accessibilityLabel="Se déconnecter"
          style={styles.me}
        >
          <Avatar initials={initialsOf(me?.first_name ?? "", me?.last_name ?? "")} size={36} />
          <LogOut size={16} color="rgba(255,255,255,0.8)" />
        </Pressable>
      </View>
      {title ? (
        <View>
          {subtitle ? <T style={{ color: "rgba(255,255,255,0.7)", fontSize: 13 }}>{subtitle}</T> : null}
          <T style={styles.title} accessibilityRole="header">
            {title}
          </T>
        </View>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  top: { backgroundColor: colors.forest, paddingHorizontal: 16, paddingBottom: 12, gap: 12 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  scope: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.07)",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  scopeName: { color: "#fff", fontSize: 15, fontWeight: "700", flexShrink: 1 },
  me: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { color: "#fff", fontSize: 26, fontWeight: "700", marginTop: 2 },
});
