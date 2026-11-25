import { usePathname, useRouter } from "expo-router";
import { CloudUpload, House, Map as MapIcon, Plus, Users } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { T } from "@/components/ui";
import { useOutbox } from "@/lib/outbox";
import { useSession } from "@/lib/session";
import { colors } from "@/theme";

const TABS = [
  { href: "/accueil", label: "Accueil", Icon: House },
  { href: "/parcelles", label: "Parcelles", Icon: MapIcon },
  { href: "/producteurs", label: "Producteurs", Icon: Users },
  { href: "/envois", label: "Envois", Icon: CloudUpload },
] as const;

/** Écrans principaux : ils portent la barre d'onglets. Les fiches et formulaires s'ouvrent par-dessus. */
export const TAB_ROUTES: readonly string[] = TABS.map((t) => t.href);

/** Barre d'onglets en bas de l'écran, avec le bouton central « Enrôler ». */
export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { status, workspace } = useSession();
  const { ops } = useOutbox();
  if (status !== "signedIn" || !workspace || !TAB_ROUTES.includes(pathname)) return null;

  const mine = ops.filter((o) => o.workspace === workspace);
  const waiting = mine.filter((o) => o.status === "pending").length;
  const problems = mine.filter((o) => o.status === "rejected" || o.status === "conflict").length;
  const badge = problems || waiting;

  const tab = (t: (typeof TABS)[number]) => {
    const active = pathname === t.href;
    const color = active ? colors.forest : colors.muted;
    return (
      <Pressable
        key={t.href}
        onPress={() => !active && router.replace(t.href)}
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
        accessibilityLabel={t.href === "/envois" && badge ? `${t.label}, ${badge} à voir` : t.label}
        style={styles.tab}
      >
        <View>
          <t.Icon size={24} color={color} strokeWidth={active ? 2.4 : 1.9} />
          {t.href === "/envois" && badge ? (
            <View style={[styles.badge, { backgroundColor: problems ? colors.danger : colors.gold }]}>
              <T style={[styles.badgeText, { color: problems ? "#fff" : colors.night }]}>{badge > 99 ? "99+" : badge}</T>
            </View>
          ) : null}
        </View>
        <T style={[styles.label, { color, fontWeight: active ? "700" : "400" }]}>{t.label}</T>
        {active ? <View style={styles.indicator} /> : null}
      </Pressable>
    );
  };

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]} accessibilityRole="tablist">
      {tab(TABS[0])}
      {tab(TABS[1])}
      <Pressable
        onPress={() => router.push("/parcelles/nouvelle")}
        accessibilityRole="button"
        accessibilityLabel="Enrôler une parcelle"
        style={styles.tab}
      >
        <View style={styles.fab}>
          <Plus size={28} color="#fff" strokeWidth={2.6} />
        </View>
        <T style={[styles.label, { color: colors.forest, fontWeight: "700" }]}>Enrôler</T>
      </Pressable>
      {tab(TABS[2])}
      {tab(TABS[3])}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: colors.canvas,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 6,
    paddingHorizontal: 4,
  },
  tab: { flex: 1, alignItems: "center", justifyContent: "flex-end", gap: 3, minHeight: 52, paddingBottom: 2 },
  label: { fontSize: 11 },
  indicator: { position: "absolute", top: -6, width: 28, height: 3, borderRadius: 2, backgroundColor: colors.forest },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginTop: -26,
    backgroundColor: colors.forest,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: colors.canvas,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  badge: { position: "absolute", top: -5, right: -12, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, alignItems: "center", justifyContent: "center" },
  badgeText: { fontSize: 10, fontWeight: "700" },
});
