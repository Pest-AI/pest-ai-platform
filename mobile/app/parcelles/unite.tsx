import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Check, Pause, Play, Plus, RotateCcw, Undo2 } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TrackPreview } from "@/components/track-preview";
import { Alert, Button, Card, Input, T } from "@/components/ui";
import { ApiError, NetworkError, SessionExpiredError } from "@/lib/api";
import { api } from "@/lib/client";
import { type FieldParcel, loadFieldParcel, rings } from "@/lib/field-data";
import { formatArea } from "@/lib/geo";
import { type Fix, acceptFix, medianAccuracy, ringAreaM2, toPolygon, useLiveFix } from "@/lib/gps-track";
import { submit as submitOp } from "@/lib/outbox";
import { useSession } from "@/lib/session";
import { colors, radius } from "@/theme";

type Created = { code: string; area_m2: string | null; check: { status: string; labels: string[] } | null; pending: boolean };
type Mode = "walk" | "corners" | "area";

const MODES: { value: Mode; label: string; hint: string }[] = [
  { value: "walk", label: "Tour de la zone", hint: "Marchez le long de la limite de la zone cultivée ; les points s'ajoutent seuls." },
  { value: "corners", label: "Coin par coin", hint: "Arrêtez-vous à chaque coin de la zone et ajoutez le point." },
  { value: "area", label: "Surface seule", hint: "Déclarez la surface sans relever le contour (D-16)." },
];

/**
 * Unité de culture (J19, D-16) : une zone de la parcelle consacrée à une culture. Contour
 * relevé au GPS (tour ou coins) ou surface seule. Le serveur mesure le contour et signale une
 * unité qui déborde de la parcelle (au-delà de 1 m) ou chevauche une autre unité.
 */
export default function NewUnitScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { status, workspace, expire } = useSession();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [parcel, setParcel] = useState<FieldParcel | null>(null);
  const [mode, setMode] = useState<Mode>("walk");
  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [recording, setRecording] = useState(false);
  const [points, setPoints] = useState<Fix[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Created | null>(null);
  const { fix, error: gpsError, supported } = useLiveFix(!created && mode !== "area" && status === "signedIn");

  useEffect(() => {
    if (!workspace || !id) return;
    loadFieldParcel(api, workspace, id)
      .then(setParcel)
      .catch((e) => (e instanceof SessionExpiredError ? expire() : setError(e instanceof NetworkError ? "Pas de réseau, et cette parcelle n'est pas encore sur le téléphone." : "Parcelle introuvable.")));
  }, [workspace, id, expire]);

  useEffect(() => {
    if (recording && mode === "walk" && fix) setPoints((pts) => acceptFix(pts, fix, "walk"));
  }, [fix, recording, mode]);

  const reference = useMemo(() => {
    const parcelRings = rings(parcel?.geometry);
    const unitRings = (parcel?.units ?? []).filter((u) => u.status === "active").flatMap((u) => rings(u.geometry));
    return [...parcelRings, ...unitRings];
  }, [parcel]);
  const ring = useMemo(() => points.map((p) => p.position), [points]);
  const ready = mode === "area" ? Number(area.replace(",", ".")) > 0 : points.length >= 3;

  if (status !== "signedIn") return <Redirect href="/connexion" />;
  if (!workspace) return <Redirect href="/espaces" />;

  async function submit() {
    setError(null);
    setRecording(false);
    setBusy(true);
    const body: Record<string, unknown> = { name: name.trim() };
    if (mode === "area") body.area_m2 = Number(area.replace(",", ".")).toFixed(2);
    else {
      body.geometry = toPolygon(points);
      body.capture_method = mode === "walk" ? "gps_walk" : "gps_points";
    }
    try {
      const sent = await submitOp(api, {
        workspace: workspace as string,
        entity_type: "cultivation_unit",
        params: { parcel: parcel?.id ?? id },
        payload: body,
        label: [name.trim() || "Unité", parcel?.agroid || parcel?.local_name || "parcelle en attente d'envoi"].join(" · "),
      });
      if (sent.kind === "applied") {
        const r = sent.result as { code?: string; area_m2?: string | null; check?: Created["check"] };
        setCreated({ code: r.code ?? "", area_m2: r.area_m2 ?? null, check: r.check ?? null, pending: false });
      } else {
        const declared = mode === "area" ? String(body.area_m2) : String(Math.round(ringAreaM2(ring)));
        setCreated({ code: "", area_m2: declared, check: null, pending: true });
      }
    } catch (e) {
      if (e instanceof SessionExpiredError) return expire();
      if (e instanceof NetworkError) setError("Pas de réseau : le relevé reste à l'écran, réessayez dès que le réseau revient.");
      else if (e instanceof ApiError && e.status === 403) setError("Votre rôle ne permet pas d'ajouter une unité sur cette parcelle.");
      else setError(e instanceof ApiError ? e.message : "Une erreur est survenue.");
    } finally {
      setBusy(false);
    }
  }

  if (created) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.canvas, padding: 24, paddingTop: insets.top + 48, gap: 14 }}>
        <T style={{ fontSize: 22, fontWeight: "700", textAlign: "center" }}>
          {created.pending ? "Unité gardée sur le téléphone" : `Unité ${created.code} enregistrée`}
        </T>
        <T mono style={{ textAlign: "center", color: colors.muted }}>
          {formatArea(Number(created.area_m2 ?? 0))}
        </T>
        {created.pending ? (
          <Alert tone="info">Pas de réseau : elle partira au retour du réseau ; son code (U1, U2…) et le contrôle du contour seront faits à l&apos;envoi.</Alert>
        ) : created.check?.status === "flagged" ? (
          <Alert tone="warning">{created.check.labels.join(" · ")}. L&apos;unité est enregistrée ; un responsable vérifiera.</Alert>
        ) : created.check?.status === "valid" ? (
          <Alert tone="info">Contour dans la parcelle.</Alert>
        ) : null}
        <Button label="Retour à la fiche" onPress={() => router.back()} />
        <Button
          label="Ajouter une autre unité"
          variant="secondary"
          onPress={() => {
            setCreated(null);
            setPoints([]);
            setName("");
            setArea("");
            setParcel(null);
            if (workspace) void loadFieldParcel(api, workspace, id).then(setParcel).catch(() => undefined);
          }}
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" style={{ backgroundColor: colors.surface }} contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 18, paddingBottom: insets.bottom + 28, gap: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Retour" hitSlop={10} style={{ padding: 4 }}>
            <ArrowLeft size={24} color={colors.ink} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <T style={{ fontSize: 22, fontWeight: "700" }} accessibilityRole="header">
              Nouvelle unité de culture
            </T>
            {parcel?.agroid ? (
              <T mono style={{ color: colors.muted }}>
                {parcel.agroid}
              </T>
            ) : parcel?.pending ? (
              <T style={{ color: colors.warning }}>{parcel.local_name || "Parcelle"} · en attente d&apos;envoi</T>
            ) : null}
          </View>
        </View>
        {error ? <Alert>{error}</Alert> : null}

        <Card style={{ gap: 6 }}>
          <T style={styles.label}>Nom de l&apos;unité (facultatif)</T>
          <Input accessibilityLabel="Nom de l'unité" placeholder="ex. Tomate nord" value={name} onChangeText={setName} />
          <T style={{ color: colors.muted, fontSize: 13 }}>Code attribué automatiquement (U1, U2…).</T>
        </Card>

        <View style={styles.segment} accessibilityRole="radiogroup">
          {MODES.map((m) => (
            <Pressable
              key={m.value}
              onPress={() => {
                setMode(m.value);
                setPoints([]);
                setRecording(false);
              }}
              accessibilityRole="radio"
              accessibilityState={{ checked: mode === m.value }}
              style={[styles.segmentItem, mode === m.value && styles.segmentOn]}
            >
              <T style={{ fontSize: 13, fontWeight: "700", color: mode === m.value ? "#fff" : colors.ink }}>{m.label}</T>
            </Pressable>
          ))}
        </View>
        <T style={{ color: colors.muted, lineHeight: 20 }}>{MODES.find((m) => m.value === mode)?.hint}</T>

        {mode === "area" ? (
          <Card style={{ gap: 6 }}>
            <T style={styles.label}>Surface en m²</T>
            <Input accessibilityLabel="Surface de l'unité en m²" keyboardType="decimal-pad" placeholder="ex. 2500" value={area} onChangeText={setArea} />
          </Card>
        ) : (
          <>
            {!supported ? <Alert tone="info">Le relevé GPS se fait pour l&apos;instant dans l&apos;app navigateur.</Alert> : gpsError ? <Alert tone="warning">{gpsError}</Alert> : null}
            <TrackPreview points={points} current={fix} closed={!recording && points.length >= 3} reference={reference} />
            <T style={{ color: colors.muted, fontSize: 13, textAlign: "center" }}>
              En blanc : la parcelle et ses autres unités. ± {fix ? Math.round(fix.accuracy) : "—"} m
            </T>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={styles.stat}>
                <T style={styles.statLabel}>Points</T>
                <T mono style={styles.statValue}>{points.length}</T>
              </View>
              <View style={styles.stat}>
                <T style={styles.statLabel}>Surface</T>
                <T mono style={styles.statValue}>{points.length >= 3 ? formatArea(ringAreaM2(ring)) : "—"}</T>
              </View>
              <View style={styles.stat}>
                <T style={styles.statLabel}>Précision</T>
                <T mono style={styles.statValue}>{medianAccuracy(points) ?? "—"}</T>
              </View>
            </View>
            {mode === "walk" ? (
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Button style={{ flex: 1 }} label={recording ? "Pause" : points.length ? "Reprendre" : "Démarrer le tour"} icon={recording ? <Pause size={18} color="#fff" /> : <Play size={18} color="#fff" />} disabled={!supported || !fix} onPress={() => setRecording((r) => !r)} />
                <Button label="" variant="secondary" accessibilityLabel="Recommencer" icon={<RotateCcw size={18} color={colors.ink} />} disabled={!points.length} onPress={() => setPoints([])} />
              </View>
            ) : (
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Button style={{ flex: 1 }} label={`Ajouter ce coin (${points.length + 1})`} icon={<Plus size={18} color="#fff" />} disabled={!fix || fix.accuracy > 25} onPress={() => fix && setPoints((pts) => acceptFix(pts, fix, "corners"))} />
                <Button label="" variant="secondary" accessibilityLabel="Annuler le dernier coin" icon={<Undo2 size={18} color={colors.ink} />} disabled={!points.length} onPress={() => setPoints((p) => p.slice(0, -1))} />
              </View>
            )}
          </>
        )}

        <Button label="Enregistrer l'unité" icon={<Check size={18} color="#fff" />} disabled={!ready || !parcel} loading={busy} onPress={submit} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 14, fontWeight: "700" },
  segment: { flexDirection: "row", gap: 6, padding: 4, borderRadius: radius.md, backgroundColor: colors.subtle },
  segmentItem: { flex: 1, height: 42, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  segmentOn: { backgroundColor: colors.forest },
  stat: { flex: 1, padding: 12, borderRadius: radius.md, backgroundColor: colors.canvas, borderWidth: 1, borderColor: colors.line },
  statLabel: { fontSize: 12, color: colors.muted },
  statValue: { fontSize: 17, marginTop: 2 },
});
