import { Redirect, useRouter } from "expo-router";
import { ChevronRight, CloudOff, Fingerprint, ScanLine, List, LocateFixed, Map as MapIcon, RefreshCw, Search, X } from "lucide-react-native";
import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ParcelSvgMap } from "@/components/parcel-svg-map";
import { SpaceHeader } from "@/components/space-header";
import { Alert, Button, Input, StatusPill, T } from "@/components/ui";
import { matchesParcel } from "@/lib/agroid";
import { distanceM, formatArea, formatDistance } from "@/lib/geo";
import { TYPE_LABELS, roleLabel } from "@/lib/labels";
import { useOnline } from "@/lib/network";
import { PARCEL_STATUS_LABELS, STATUS_TONES } from "@/lib/parcel-labels";
import { type CachedParcel, freshness } from "@/lib/parcel-cache";
import { usePosition } from "@/lib/position";
import { useSession } from "@/lib/session";
import { useSpaceData } from "@/lib/space-data";
import { colors, radius } from "@/theme";

/**
 * Onglet Parcelles : les parcelles de l'espace, en liste ou sur la carte, consultables hors ligne.
 * Copie locale affichée d'abord, puis mise à jour si le réseau le permet.
 */
export default function ParcelsHome() {
  const { status, me, workspace } = useSession();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const online = useOnline();
  const { fix, error: positionError, locate } = usePosition();
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"liste" | "carte">("liste");
  const [selected, setSelected] = useState<CachedParcel | null>(null);
  const { org, canView, snapshot, syncing, error, sync, now } = useSpaceData();

  const parcels = useMemo(() => {
    const all = snapshot?.parcels ?? [];
    const found = all.filter((p) => matchesParcel(query, p));
    if (!fix) return found;
    return [...found].sort(
      (a, b) =>
        (a.centroid ? distanceM(fix.position, a.centroid) : Infinity) -
        (b.centroid ? distanceM(fix.position, b.centroid) : Infinity),
    );
  }, [snapshot, query, fix]);

  if (status === "signedOut") return <Redirect href="/connexion" />;
  if (!workspace) return <Redirect href="/espaces" />;

  const membership = me?.memberships.find((m) => m.workspace === workspace);
  const scopeName = org?.short_name || org?.name || membership?.organization_name || snapshot?.label || "…";

  const header = (
    <View>
      <SpaceHeader
        scopeName={scopeName}
        title="Parcelles"
        subtitle={
          membership
            ? `${org ? `${TYPE_LABELS[org.organization_type] ?? ""} · ` : ""}${roleLabel(membership.roles)}`
            : "Données gardées sur ce téléphone"
        }
      />
      <View style={{ paddingHorizontal: 16, paddingTop: 16, gap: 12 }}>
        {/* Fraîcheur des données */}
        <View style={styles.fresh}>
          {online ? <RefreshCw size={15} color={colors.muted} /> : <CloudOff size={15} color={colors.warning} />}
          <T style={{ flex: 1, fontSize: 13, color: online ? colors.muted : colors.warning }}>
            {snapshot
              ? `${snapshot.parcels.length} parcelle${snapshot.parcels.length > 1 ? "s" : ""} · mises à jour ${freshness(snapshot.synced_at, now)}`
              : syncing
                ? "Chargement des parcelles…"
                : "Pas encore de parcelles sur ce téléphone"}
          </T>
          <Pressable
            onPress={() => void sync()}
            disabled={syncing || !online}
            accessibilityRole="button"
            accessibilityLabel="Mettre à jour"
            hitSlop={8}
          >
            {syncing ? (
              <ActivityIndicator size="small" color={colors.forest} />
            ) : (
              <T style={{ fontSize: 13, fontWeight: "700", color: online ? colors.forest : colors.lineStrong }}>Mettre à jour</T>
            )}
          </Pressable>
        </View>

        {error ? <Alert tone={snapshot ? "info" : "danger"}>{error}</Alert> : null}
        {snapshot?.truncated ? (
          <Alert tone="info">Seules 1 000 parcelles sont gardées hors ligne ; utilisez la recherche en ligne pour les autres.</Alert>
        ) : null}
        {canView === false ? <Alert tone="info">Les parcelles ne sont pas accessibles avec votre rôle.</Alert> : null}

        {canView && snapshot && snapshot.parcels.length > 0 ? (
          <>
            <Input
              icon={<Search size={18} color={colors.muted} />}
              placeholder="AgroID, nom de parcelle ou exploitant"
              value={query}
              onChangeText={(t) => {
                setQuery(t);
                setSelected(null);
              }}
              accessibilityLabel="Rechercher une parcelle"
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="search"
              end={
                query ? (
                  <Pressable onPress={() => setQuery("")} accessibilityLabel="Effacer" hitSlop={8} style={{ paddingHorizontal: 12 }}>
                    <X size={18} color={colors.muted} />
                  </Pressable>
                ) : undefined
              }
            />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable onPress={() => router.push("/scanner")} accessibilityRole="button" accessibilityLabel="Scanner un AgroID" style={styles.locate}>
                <ScanLine size={18} color={colors.forest} />
              </Pressable>
              <View style={styles.segment}>
                {(
                  [
                    ["liste", "Liste", List],
                    ["carte", "Carte", MapIcon],
                  ] as const
                ).map(([key, label, Icon]) => (
                  <Pressable
                    key={key}
                    onPress={() => setView(key)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: view === key }}
                    style={[styles.segmentItem, view === key && styles.segmentActive]}
                  >
                    <Icon size={16} color={view === key ? colors.forest : colors.muted} />
                    <T style={{ fontWeight: "700", color: view === key ? colors.forest : colors.muted }}>{label}</T>
                  </Pressable>
                ))}
              </View>
              <Pressable onPress={locate} accessibilityRole="button" accessibilityLabel="Ma position" style={styles.locate}>
                <LocateFixed size={18} color={fix ? "#2F6FDB" : colors.forest} />
              </Pressable>
            </View>
            {positionError ? <T style={{ fontSize: 12, color: colors.muted }}>{positionError}</T> : null}
            {fix ? (
              <T style={{ fontSize: 12, color: colors.muted }}>
                Triées de la plus proche à la plus éloignée (précision {Math.round(fix.accuracy)} m).
              </T>
            ) : null}
            {view === "carte" ? (
              <View style={{ gap: 10 }}>
                <ParcelSvgMap
                  parcels={parcels}
                  selectedId={selected?.id}
                  onSelect={setSelected}
                  position={fix?.position ?? null}
                />
                {selected ? (
                  <ParcelRow parcel={selected} fix={fix?.position ?? null} onPress={() => router.push(`/parcelles/${selected.id}`)} />
                ) : (
                  <T style={{ fontSize: 13, color: colors.muted, textAlign: "center" }}>
                    Touchez une parcelle pour voir son identité. Carte disponible hors ligne (sans fond satellite).
                  </T>
                )}
              </View>
            ) : null}
          </>
        ) : null}
      </View>
    </View>
  );

  const listMode = view === "liste" && canView && snapshot && snapshot.parcels.length > 0;

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.surface }}
      data={listMode ? parcels : []}
      keyExtractor={(p) => p.id}
      ListHeaderComponent={header}
      ListHeaderComponentStyle={{ marginBottom: 12 }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      refreshControl={<RefreshControl refreshing={syncing && Boolean(snapshot)} onRefresh={() => void sync()} tintColor={colors.forest} />}
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      renderItem={({ item }) => (
        <View style={{ marginHorizontal: 16 }}>
          <ParcelRow parcel={item} fix={fix?.position ?? null} onPress={() => router.push(`/parcelles/${item.id}`)} />
        </View>
      )}
      ListEmptyComponent={
        <>
          {!canView || view === "carte" ? null : syncing && !snapshot ? (
          <ActivityIndicator color={colors.forest} style={{ marginTop: 24 }} />
        ) : snapshot && snapshot.parcels.length > 0 ? (
          <View style={styles.empty}>
            <T style={{ fontSize: 16, fontWeight: "700" }}>Aucune parcelle pour « {query} »</T>
            <T style={{ fontSize: 14, color: colors.muted, textAlign: "center", marginTop: 4 }}>
              Vérifiez l&apos;AgroID : O et 0, I et 1 sont acceptés indifféremment.
            </T>
          </View>
        ) : snapshot ? (
          <View style={styles.empty}>
            <Fingerprint size={28} color={colors.forest} />
            <T style={{ fontSize: 16, fontWeight: "700", marginTop: 10 }}>Aucune parcelle pour le moment</T>
            <T style={{ fontSize: 14, color: colors.muted, textAlign: "center", marginTop: 4 }}>
              Le relevé des contours depuis le téléphone arrive avec la collecte terrain.
            </T>
          </View>
        ) : !online ? (
          <View style={{ marginHorizontal: 16, gap: 10 }}>
            <Alert tone="info">Connectez-vous une première fois avec du réseau pour garder les parcelles sur ce téléphone.</Alert>
            <Button label="Réessayer" variant="secondary" onPress={() => void sync()} />
          </View>
        ) : null}
        </>
      }
    />
  );
}

function ParcelRow({ parcel: p, fix, onPress }: { parcel: CachedParcel; fix: [number, number] | null; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${p.agroid ?? "Brouillon"} ${p.local_name}`}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.subtle }]}
    >
      <View style={{ flex: 1, gap: 6 }}>
        <View style={styles.agroid}>
          <Fingerprint size={13} color={colors.gold} />
          <T mono style={{ color: "#fff", fontSize: 13 }}>
            {p.agroid ?? "En attente"}
          </T>
        </View>
        <T style={{ fontSize: 16, fontWeight: "700" }} numberOfLines={1}>
          {p.local_name || "Parcelle sans nom"}
        </T>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <StatusPill tone={STATUS_TONES[p.status] ?? "neutral"} label={PARCEL_STATUS_LABELS[p.status] ?? p.status} />
          <T mono style={{ fontSize: 13, color: colors.muted }}>
            {formatArea(p.area_m2)}
          </T>
          {fix && p.centroid ? (
            <T mono style={{ fontSize: 13, color: "#2F6FDB" }}>
              à {formatDistance(distanceM(fix, p.centroid))}
            </T>
          ) : null}
        </View>
        {p.operator_name ? (
          <T style={{ fontSize: 13, color: colors.muted }} numberOfLines={1}>
            {p.operator_name}
          </T>
        ) : null}
      </View>
      <ChevronRight size={18} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: 28, fontWeight: "700", marginTop: 2 },
  fresh: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.canvas,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  segment: { flex: 1, flexDirection: "row", backgroundColor: colors.subtle, borderRadius: 12, padding: 4 },
  segmentItem: { flex: 1, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", paddingVertical: 8, borderRadius: 9 },
  segmentActive: { backgroundColor: colors.canvas },
  locate: {
    width: 46,
    borderRadius: 12,
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.canvas,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
  },
  agroid: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.night,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  empty: {
    marginHorizontal: 16,
    alignItems: "center",
    backgroundColor: colors.canvas,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
});
