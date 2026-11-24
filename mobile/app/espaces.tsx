import { Image } from "expo-image";
import { Redirect, useRouter } from "expo-router";
import { ChevronRight, Globe2, LogOut, MailOpen, Sprout } from "lucide-react-native";
import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { InstallCard } from "@/components/install-card";
import { Alert, Button, T } from "@/components/ui";
import { ApiError, NetworkError, SessionExpiredError } from "@/lib/api";
import { api } from "@/lib/client";
import { confirmLogout } from "@/lib/confirm";
import { TYPE_LABELS, roleLabel } from "@/lib/labels";
import { useSession } from "@/lib/session";
import { colors, radius } from "@/theme";

/** Choix de l'espace : organisations actives et invitations à accepter. */
export default function WorkspacesScreen() {
  const { status, me, offline, reload, chooseWorkspace, signOut, expire } = useSession();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [accepting, setAccepting] = useState<string | null>(null);

  if (status === "signedOut") return <Redirect href="/connexion" />;

  const memberships = me?.memberships.filter((m) => m.status === "active") ?? [];
  const invitations = me?.memberships.filter((m) => m.status === "invited") ?? [];

  async function refresh() {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }

  async function accept(id: string) {
    setError(null);
    setAccepting(id);
    try {
      await api.request(`/api/v1/me/memberships/${id}/accept/`, { method: "POST", body: {} });
      await reload();
    } catch (e) {
      if (e instanceof SessionExpiredError) return expire();
      setError(e instanceof NetworkError || e instanceof ApiError ? e.message : "Une erreur est survenue.");
    } finally {
      setAccepting(null);
    }
  }

  async function open(workspace: string) {
    await chooseWorkspace(workspace);
    router.replace("/accueil");
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surface }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.forest} />}
    >
      <View style={{ height: 230 + insets.top }}>
        <Image
          source={require("../assets/brand/espaces-panorama.jpg")}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          contentPosition={{ left: "15%", top: "50%" }}
        />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(16,68,38,0.45)" }]} />
        <View style={[styles.top, { paddingTop: insets.top + 10 }]}>
          <View style={styles.brand}>
            <View style={styles.mark}>
              <Image source={require("../assets/brand/pest-ai-mark.png")} style={{ width: 26, height: 28 }} contentFit="contain" />
            </View>
            <T style={styles.brandText}>
              PEST AI <T style={[styles.brandText, { color: colors.gold }]}>OS</T>
            </T>
          </View>
          <Pressable
            onPress={() => confirmLogout(signOut)}
            accessibilityRole="button"
            accessibilityLabel="Se déconnecter"
            hitSlop={8}
            style={styles.logout}
          >
            <LogOut size={18} color="#fff" />
          </Pressable>
        </View>
        <View style={styles.greeting}>
          <T style={{ color: "rgba(255,255,255,0.9)", fontSize: 16 }}>Bonjour {me?.first_name ?? ""} 👋</T>
          <T style={styles.h1} accessibilityRole="header">
            Choisissez votre espace
          </T>
          <View style={styles.goldBar} />
        </View>
      </View>

      <View style={{ paddingHorizontal: 16, marginTop: -18, gap: 12 }}>
        {offline ? <Alert tone="warning">Hors ligne : liste des espaces non actualisée. Tirez vers le bas pour réessayer.</Alert> : null}
        {error ? <Alert>{error}</Alert> : null}

        {invitations.map((inv) => (
          <View key={inv.id} style={[styles.card, { borderColor: colors.gold }]}>
            <View style={[styles.icon, { backgroundColor: colors.warningBg }]}>
              <MailOpen size={26} color={colors.warning} />
            </View>
            <View style={{ flex: 1 }}>
              <T style={{ color: colors.warning, fontSize: 12, fontWeight: "700" }}>Nouvelle invitation</T>
              <T style={styles.name}>{inv.organization_name}</T>
              <T style={styles.meta}>{roleLabel(inv.roles)}</T>
              <Button label="Accepter" loading={accepting === inv.id} onPress={() => accept(inv.id)} style={{ marginTop: 10, minHeight: 44 }} />
            </View>
          </View>
        ))}

        {memberships.map((m) => {
          const ngo = m.organization_type === "ngo";
          return (
            <Pressable
              key={m.id}
              onPress={() => open(m.workspace)}
              accessibilityRole="button"
              accessibilityLabel={`Ouvrir ${m.organization_name}`}
              style={({ pressed }) => [styles.card, pressed && { backgroundColor: colors.surface }]}
            >
              <View style={[styles.icon, { backgroundColor: ngo ? colors.warningBg : colors.brand50 }]}>
                {ngo ? <Globe2 size={26} color={colors.warning} /> : <Sprout size={26} color={colors.forest} />}
              </View>
              <View style={{ flex: 1 }}>
                <T style={styles.name}>{m.organization_name}</T>
                <T style={styles.meta}>
                  {TYPE_LABELS[m.organization_type] ?? m.organization_type} · {roleLabel(m.roles)}
                </T>
              </View>
              <ChevronRight size={20} color={colors.muted} />
            </Pressable>
          );
        })}

        {memberships.length === 0 && invitations.length === 0 && !offline ? (
          <View style={[styles.card, { flexDirection: "column", alignItems: "center", paddingVertical: 32 }]}>
            <T style={{ fontSize: 17, fontWeight: "700" }}>Aucun espace pour le moment</T>
            <T style={[styles.meta, { textAlign: "center", marginTop: 6 }]}>
              Demandez à l&apos;administrateur de votre organisation de vous inviter.
            </T>
          </View>
        ) : null}

        <InstallCard />

        {me?.is_platform_admin ? (
          <T style={[styles.meta, { textAlign: "center", marginTop: 8 }]}>La Console d&apos;administration est disponible sur le Web OS.</T>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16 },
  brand: { flexDirection: "row", alignItems: "center", gap: 10 },
  mark: { width: 40, height: 40, borderRadius: 12, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  brandText: { color: "#fff", fontSize: 20, fontWeight: "700" },
  logout: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(11,25,41,0.35)",
  },
  greeting: { position: "absolute", left: 20, right: 20, bottom: 36 },
  h1: { color: "#fff", fontSize: 29, lineHeight: 35, fontWeight: "700", marginTop: 2 },
  goldBar: { width: 56, height: 4, borderRadius: 2, backgroundColor: colors.gold, marginTop: 12 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: colors.canvas,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
  },
  icon: { width: 56, height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  name: { fontSize: 16, lineHeight: 21, fontWeight: "700" },
  meta: { fontSize: 14, color: colors.muted, marginTop: 2 },
});
