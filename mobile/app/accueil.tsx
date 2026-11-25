import { Redirect, useFocusEffect, useRouter } from "expo-router";
import {
  ChevronRight,
  CloudUpload,
  Fingerprint,
  FlaskConical,
  Layers,
  Map as MapIcon,
  MapPin,
  Play,
  ScanLine,
  Droplets,
  UserPlus,
  Users,
} from "lucide-react-native";
import { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SpaceHeader } from "@/components/space-header";
import { SyncStrip } from "@/components/sync-strip";
import { Alert, T } from "@/components/ui";
import { type DraftMeta, loadDraft } from "@/lib/enrolment-draft";
import type { PickedProducer } from "@/lib/field-data";
import { roleLabel } from "@/lib/labels";
import { cachedOnly } from "@/lib/offline-cache";
import { useOutbox } from "@/lib/outbox";
import { freshness } from "@/lib/parcel-cache";
import { useSession } from "@/lib/session";
import { useSpaceData } from "@/lib/space-data";
import { colors, radius } from "@/theme";

const STEPS = [
  { label: "Producteur", Icon: Users },
  { label: "Contour", Icon: MapPin },
  { label: "Foncier", Icon: Layers },
  { label: "Sol et eau", Icon: Droplets },
  { label: "Mesures", Icon: FlaskConical },
  { label: "AgroID", Icon: Fingerprint },
];

/** Accueil de l'app terrain : enrôler, reprendre un brouillon, raccourcis, état de l'espace. */
export default function Home() {
  const { status, me, workspace } = useSession();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { org, canView, canCreate, snapshot, syncing, error, sync, now, permissions } = useSpaceData();
  const { ops } = useOutbox();
  const [draft, setDraft] = useState<DraftMeta | null>(null);
  const [producerCount, setProducerCount] = useState<number | null>(null);

  // Brouillon et copies relus à chaque retour sur l'accueil.
  useFocusEffect(
    useCallback(() => {
      if (!workspace) return;
      void loadDraft(workspace).then((d) => setDraft(d?.meta ?? null));
      void cachedOnly<PickedProducer[]>("producers:all", { workspace }).then((p) => setProducerCount(p ? p.length : null));
    }, [workspace]),
  );

  if (status === "signedOut") return <Redirect href="/connexion" />;
  if (!workspace) return <Redirect href="/espaces" />;

  const membership = me?.memberships.find((m) => m.workspace === workspace);
  const scopeName = org?.short_name || org?.name || membership?.organization_name || snapshot?.label || "…";
  const personal = workspace === "personal";
  const mine = ops.filter((o) => o.workspace === workspace);
  const waiting = mine.filter((o) => o.status === "pending").length;
  const recent = mine
    .filter((o) => o.entity_type === "parcel")
    .slice(-4)
    .reverse();
  const canAddProducer = permissions.includes("producers.create");

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surface }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      refreshControl={<RefreshControl refreshing={syncing} onRefresh={() => void sync()} tintColor={colors.forest} />}
    >
      <SpaceHeader
        scopeName={scopeName}
        title={me?.first_name ? `Bonjour ${me.first_name}` : "Bonjour"}
        subtitle={membership ? roleLabel(membership.roles) : "Données gardées sur ce téléphone"}
      />

      <View style={{ padding: 16, gap: 16 }}>
        <SyncStrip workspace={workspace} />

        {canCreate ? (
          <View style={styles.hero}>
            <T style={styles.heroKicker}>Enrôlement</T>
            <T style={styles.heroTitle}>{draft ? "Un enrôlement est en cours" : "Enrôler une parcelle"}</T>
            <T style={styles.heroText}>
              {draft
                ? `${draft.label || "Parcelle"} · étape ${draft.step + 1} sur ${STEPS.length} · enregistré ${freshness(draft.saved_at, now)}`
                : "Étapes guidées, avec ou sans réseau, jusqu'à l'identifiant AgroID."}
            </T>
            <View style={styles.path}>
              {STEPS.map(({ label, Icon }, i) => {
                const done = draft ? i < draft.step : false;
                const current = draft ? i === draft.step : i === 0;
                return (
                  <View key={label} style={styles.pathStep}>
                    <View style={[styles.pathDot, done && styles.pathDone, current && styles.pathCurrent]}>
                      <Icon size={16} color={current ? colors.forest : done ? colors.night : "rgba(255,255,255,0.85)"} />
                    </View>
                    <T style={styles.pathLabel} numberOfLines={1}>
                      {label}
                    </T>
                  </View>
                );
              })}
            </View>
            <Pressable
              onPress={() => router.push("/parcelles/nouvelle")}
              accessibilityRole="button"
              style={({ pressed }) => [styles.heroButton, pressed && { opacity: 0.85 }]}
            >
              <Play size={18} color={colors.forest} />
              <T style={{ color: colors.forest, fontWeight: "700", fontSize: 16 }}>
                {draft ? "Reprendre l'enrôlement" : "Commencer"}
              </T>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.stats}>
          <Stat label="Parcelles" value={snapshot ? String(snapshot.parcels.length) : "—"} onPress={() => router.replace("/parcelles")} />
          {personal ? null : (
            <Stat label="Producteurs" value={producerCount === null ? "—" : String(producerCount)} onPress={() => router.replace("/producteurs")} />
          )}
          <Stat label="À envoyer" value={String(waiting)} tone={waiting ? "warning" : undefined} onPress={() => router.replace("/envois")} />
        </View>

        <View style={{ gap: 10 }}>
          <T style={styles.section}>Raccourcis</T>
          <View style={styles.grid}>
            {canAddProducer && !personal ? (
              <Action Icon={UserPlus} label="Nouveau producteur" onPress={() => router.push("/producteurs/nouveau")} />
            ) : null}
            {canView ? <Action Icon={ScanLine} label="Scanner un AgroID" onPress={() => router.push("/scanner")} /> : null}
            {canView ? <Action Icon={MapIcon} label="Carte des parcelles" onPress={() => router.replace("/parcelles")} /> : null}
            <Action Icon={CloudUpload} label="Envois" onPress={() => router.replace("/envois")} />
          </View>
        </View>

        {recent.length ? (
          <View style={{ gap: 10 }}>
            <T style={styles.section}>Dernières parcelles enrôlées</T>
            {recent.map((o) => {
              const r = (o.result ?? {}) as { id?: string; agroid?: string };
              const sent = o.status === "applied" && r.id;
              return (
                <Pressable
                  key={o.id}
                  onPress={() => (sent ? router.push(`/parcelles/${r.id}`) : router.replace("/envois"))}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }]}
                >
                  <View style={styles.rowIcon}>
                    <Fingerprint size={20} color={colors.forest} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <T style={{ fontWeight: "700" }} numberOfLines={1}>
                      {o.label}
                    </T>
                    {sent && r.agroid ? (
                      <T mono style={{ fontSize: 13, color: colors.forest }}>
                        {r.agroid}
                      </T>
                    ) : (
                      <T style={{ fontSize: 13, color: o.status === "pending" ? colors.warning : colors.danger }}>
                        {o.status === "pending" ? "En attente d'envoi" : "À reprendre"}
                      </T>
                    )}
                  </View>
                  <ChevronRight size={18} color={colors.muted} />
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {error && !snapshot ? <Alert tone="info">{error}</Alert> : null}
      </View>
    </ScrollView>
  );
}

function Stat({ label, value, onPress, tone }: { label: string; value: string; onPress: () => void; tone?: "warning" }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label} : ${value}`} style={({ pressed }) => [styles.stat, pressed && { opacity: 0.8 }]}>
      <T mono style={{ fontSize: 24, color: tone ? colors.warning : colors.ink }}>
        {value}
      </T>
      <T style={{ fontSize: 12, color: colors.muted }}>{label}</T>
    </Pressable>
  );
}

function Action({ Icon, label, onPress }: { Icon: typeof UserPlus; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.action, pressed && { opacity: 0.8 }]}>
      <View style={styles.actionIcon}>
        <Icon size={22} color={colors.forest} />
      </View>
      <T style={{ fontWeight: "700", fontSize: 14 }}>{label}</T>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.forest, borderRadius: radius.xl, padding: 18, gap: 8 },
  heroKicker: { color: colors.gold, fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 },
  heroTitle: { color: "#fff", fontSize: 22, fontWeight: "700" },
  heroText: { color: "rgba(255,255,255,0.8)", lineHeight: 20 },
  path: { flexDirection: "row", marginTop: 8, marginBottom: 4 },
  pathStep: { flex: 1, alignItems: "center", gap: 6 },
  pathDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  pathDone: { backgroundColor: colors.gold },
  pathCurrent: { backgroundColor: "#fff" },
  pathLabel: { color: "rgba(255,255,255,0.85)", fontSize: 11 },
  heroButton: {
    marginTop: 6,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  stats: { flexDirection: "row", gap: 10 },
  stat: { flex: 1, backgroundColor: colors.canvas, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: 14, gap: 2 },
  section: { fontSize: 13, fontWeight: "700", color: colors.muted, textTransform: "uppercase", letterSpacing: 0.6 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  action: {
    flexBasis: "47%",
    flexGrow: 1,
    backgroundColor: colors.canvas,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
    gap: 10,
  },
  actionIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: colors.brand50, alignItems: "center", justifyContent: "center" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.canvas,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 12,
  },
  rowIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.brand50, alignItems: "center", justifyContent: "center" },
});
