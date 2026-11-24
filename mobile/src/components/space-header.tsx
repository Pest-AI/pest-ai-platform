import { usePathname, useRouter } from "expo-router";
import { ArrowLeftRight, LogOut } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar, T, initialsOf } from "@/components/ui";
import { confirmLogout } from "@/lib/confirm";
import { useSession } from "@/lib/session";
import { colors, radius } from "@/theme";

const TABS = [
  { href: "/accueil", label: "Parcelles" },
  { href: "/producteurs", label: "Producteurs" },
] as const;

/** En-tête des écrans d'espace : périmètre actif, déconnexion, onglets. */
export function SpaceHeader({ scopeName }: { scopeName: string }) {
  const { me, signOut } = useSession();
  const router = useRouter();
  const pathname = usePathname();
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
      <View style={styles.tabs} accessibilityRole="tablist">
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Pressable
              key={tab.href}
              onPress={() => !active && router.replace(tab.href)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={[styles.tab, active && styles.tabActive]}
            >
              <T style={[styles.tabLabel, active && { color: colors.forest }]}>{tab.label}</T>
            </Pressable>
          );
        })}
      </View>
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
  tabs: { flexDirection: "row", gap: 6, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 12, padding: 4 },
  tab: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 9 },
  tabActive: { backgroundColor: "#fff" },
  tabLabel: { color: "rgba(255,255,255,0.85)", fontWeight: "700", fontSize: 14 },
});
