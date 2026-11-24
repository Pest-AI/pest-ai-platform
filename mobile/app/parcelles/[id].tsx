import * as Linking from "expo-linking";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, CloudOff, Fingerprint, Navigation, ShieldCheck, TriangleAlert, UserRound } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ParcelSvgMap } from "@/components/parcel-svg-map";
import { Alert, StatusPill, T } from "@/components/ui";
import { ApiError, NetworkError, SessionExpiredError } from "@/lib/api";
import { api } from "@/lib/client";
import { formatArea } from "@/lib/geo";
import { CAPTURE_LABELS, PARCEL_STATUS_LABELS, STATUS_TONES, VALIDATION_LABELS } from "@/lib/parcel-labels";
import { type CachedParcel, freshness, loadSnapshot } from "@/lib/parcel-cache";
import { useSession } from "@/lib/session";
import type { components } from "@/lib/schema";
import { colors, radius } from "@/theme";

type Detail = components["schemas"]["ParcelDetail"];

/** Fiche parcelle : copie locale (hors ligne) complétée par l'API quand le réseau est là. */
export default function ParcelScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { status, workspace, expire } = useSession();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [cached, setCached] = useState<CachedParcel | null>(null);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspace || !id) return;
    let cancelled = false;
    void (async () => {
      const snapshot = await loadSnapshot(workspace);
      if (!cancelled && snapshot) {
        setCached(snapshot.parcels.find((p) => p.id === id) ?? null);
        setSyncedAt(snapshot.synced_at);
      }
      try {
        const data = await api.request<Detail>(`/api/v1/parcels/${id}/`, { workspace });
        if (!cancelled) setDetail(data);
      } catch (e) {
        if (e instanceof SessionExpiredError) return expire();
        if (cancelled) return;
        if (e instanceof NetworkError) setOffline(true);
        else if (e instanceof ApiError && e.status === 404) setError("Cette parcelle n'est pas (ou plus) suivie par votre espace.");
        else setError(e instanceof ApiError ? e.message : "Une erreur est survenue.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workspace, id, expire]);

  if (status === "signedOut") return <Redirect href="/connexion" />;
  if (!workspace) return <Redirect href="/espaces" />;

  const agroid = detail?.agroid ?? cached?.agroid ?? null;
  const name = detail?.local_name ?? cached?.local_name ?? "";
  const parcelStatus = detail?.status ?? cached?.status ?? "";
  const area = detail?.current_area_m2 ?? cached?.area_m2 ?? null;
  const centroid = (detail?.centroid as [number, number] | null | undefined) ?? cached?.centroid ?? null;
  const geometry = cached?.geometry ?? (detail?.current_geometry?.geometry as CachedParcel["geometry"]) ?? null;
  const validation = detail?.current_geometry?.validation;
  const operators = detail?.operators ?? [];
  const owners = detail?.owners ?? [];

  const directions = () => {
    if (!centroid) return;
    const [lon, lat] = centroid;
    void Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.surface }} contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Retour" hitSlop={10} style={styles.back}>
          <ArrowLeft size={22} color="#fff" />
        </Pressable>
        <T style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>Fiche parcelle</T>
      </View>

      {loading && !cached ? (
        <ActivityIndicator color={colors.forest} style={{ marginTop: 32 }} />
      ) : error && !cached ? (
        <View style={{ padding: 16 }}>
          <Alert>{error}</Alert>
        </View>
      ) : (
        <View style={{ padding: 16, gap: 12 }}>
          <View style={styles.card}>
            <View style={styles.agroid}>
              <Fingerprint size={16} color={colors.gold} />
              <T mono style={{ color: "#fff", fontSize: 17 }} selectable>
                {agroid ?? "AgroID en attente"}
              </T>
            </View>
            <T style={{ fontSize: 24, fontWeight: "700", marginTop: 10 }}>{name || "Parcelle sans nom"}</T>
            <View style={{ flexDirection: "row", gap: 8, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
              {parcelStatus ? (
                <StatusPill tone={STATUS_TONES[parcelStatus] ?? "neutral"} label={PARCEL_STATUS_LABELS[parcelStatus] ?? parcelStatus} />
              ) : null}
              <T mono style={{ color: colors.muted }}>
                {formatArea(area)}
              </T>
            </View>
          </View>

          {offline ? (
            <View style={styles.offline}>
              <CloudOff size={16} color={colors.warning} />
              <T style={{ flex: 1, fontSize: 13, color: colors.warning }}>
                Hors ligne : copie {syncedAt ? `mise à jour ${freshness(syncedAt)}` : "locale"}. Propriété et contrôle
                du contour s&apos;afficheront avec le réseau.
              </T>
            </View>
          ) : null}

          {geometry ? (
            <ParcelSvgMap parcels={[{ ...(cached as CachedParcel), id: id ?? "", status: parcelStatus, geometry }]} height={240} />
          ) : null}

          {centroid ? (
            <View style={[styles.card, { gap: 10 }]}>
              <T style={styles.h2}>Se rendre sur la parcelle</T>
              <T mono style={{ color: colors.muted }} selectable>
                {centroid[1].toFixed(5)}° N, {Math.abs(centroid[0]).toFixed(5)}° W
              </T>
              <Pressable onPress={directions} accessibilityRole="button" style={styles.cta}>
                <Navigation size={18} color="#fff" />
                <T style={{ color: "#fff", fontWeight: "700" }}>Itinéraire (Google Maps)</T>
              </Pressable>
            </View>
          ) : null}

          {validation ? (
            <View style={styles.card}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                {validation.flags.length ? (
                  <TriangleAlert size={18} color={colors.gold} />
                ) : (
                  <ShieldCheck size={18} color={colors.leaf} />
                )}
                <T style={styles.h2}>{VALIDATION_LABELS[validation.status] ?? validation.status}</T>
              </View>
              {validation.labels.map((label) => (
                <T key={label} style={{ marginTop: 6 }}>
                  • {label}
                </T>
              ))}
              {detail?.current_geometry ? (
                <T style={{ fontSize: 13, color: colors.muted, marginTop: 6 }}>
                  Version {detail.current_geometry.version} ·{" "}
                  {CAPTURE_LABELS[detail.current_geometry.capture_method] ?? detail.current_geometry.capture_method}
                </T>
              ) : null}
            </View>
          ) : null}

          <View style={styles.card}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <UserRound size={18} color={colors.forest} />
              <T style={styles.h2}>Exploitant</T>
            </View>
            {operators.length ? (
              operators.map((o) => (
                <View key={o.id} style={{ marginTop: 8 }}>
                  <T style={{ fontWeight: "700" }}>{o.producer_name}</T>
                  <T style={{ fontSize: 13, color: colors.muted }}>
                    {o.operator_role === "primary" ? "Exploitant principal" : "Co-exploitant"}
                  </T>
                </View>
              ))
            ) : (
              <T style={{ color: colors.muted, marginTop: 6 }}>{cached?.operator_name ?? (detail ? "Non renseigné" : "—")}</T>
            )}
            {owners.length ? (
              <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 10 }}>
                <T style={{ fontSize: 13, color: colors.muted }}>Propriété</T>
                {owners.map((o) => (
                  <T key={o.id} style={{ fontWeight: "700", marginTop: 4 }}>
                    {o.owner_display}
                  </T>
                ))}
              </View>
            ) : null}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  top: { backgroundColor: colors.forest, paddingHorizontal: 12, paddingBottom: 14, flexDirection: "row", alignItems: "center", gap: 8 },
  back: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  card: { backgroundColor: colors.canvas, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: 16 },
  h2: { fontSize: 17, fontWeight: "700" },
  agroid: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.night,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  offline: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    backgroundColor: colors.warningBg,
    borderRadius: radius.md,
    padding: 12,
  },
  cta: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.forest,
    borderRadius: radius.md,
    paddingVertical: 12,
  },
});
