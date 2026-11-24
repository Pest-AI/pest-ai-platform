import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Check, Fingerprint, MapPin, Pause, Play, Plus, RotateCcw, Search, Undo2, X } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TrackPreview } from "@/components/track-preview";
import { Alert, Button, Card, Input, T } from "@/components/ui";
import { ApiError, NetworkError, SessionExpiredError } from "@/lib/api";
import { api } from "@/lib/client";
import { formatArea, formatDistance } from "@/lib/geo";
import {
  CLOSE_GAP_M,
  type Fix,
  acceptFix,
  accuracyTone,
  closingGapM,
  medianAccuracy,
  perimeterM,
  ringAreaM2,
  toPolygon,
  useLiveFix,
} from "@/lib/gps-track";
import { useSession } from "@/lib/session";
import type { Paginated, Producer } from "@/lib/types";
import { colors, radius } from "@/theme";

type Mode = "walk" | "corners" | "position";
type Created = { id: string; agroid: string | null; status: string; current_geometry?: { validation?: { status?: string } } | null };

const MODES: { value: Mode; label: string; hint: string }[] = [
  { value: "walk", label: "Tour du champ", hint: "Démarrez au coin du champ et marchez le long de la limite ; les points s'ajoutent seuls." },
  { value: "corners", label: "Coin par coin", hint: "Arrêtez-vous à chaque coin du champ et ajoutez le point." },
  { value: "position", label: "Position", hint: "Seulement la position : le contour sera relevé plus tard." },
];

const TONE = {
  good: { color: colors.success, label: "Bonne précision" },
  fair: { color: colors.warning, label: "Précision moyenne" },
  poor: { color: colors.danger, label: "Précision faible : attendez" },
  none: { color: colors.muted, label: "Recherche du signal GPS…" },
} as const;

function ProducerPicker({ workspace, value, onChange }: { workspace: string; value: Producer | null; onChange: (p: Producer | null) => void }) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Producer[]>([]);
  useEffect(() => {
    if (value || q.trim().length < 2) return;
    const t = setTimeout(() => {
      api
        .request<Paginated<Producer>>("/api/v1/producers/", { workspace, query: { q: q.trim() } })
        .then((d) => setItems(d.results.slice(0, 6)))
        .catch(() => setItems([]));
    }, 300);
    return () => clearTimeout(t);
  }, [q, value, workspace]);

  if (value) {
    return (
      <View style={styles.picked}>
        <T style={{ flex: 1, fontWeight: "700" }}>
          {value.first_name} {value.last_name}
          {value.locality_text ? <T style={{ color: colors.muted, fontWeight: "400" }}> · {value.locality_text}</T> : null}
        </T>
        <Pressable onPress={() => onChange(null)} accessibilityRole="button" accessibilityLabel="Retirer l'exploitant" hitSlop={10}>
          <X size={18} color={colors.muted} />
        </Pressable>
      </View>
    );
  }
  return (
    <View style={{ gap: 6 }}>
      <Input accessibilityLabel="Rechercher l'exploitant" icon={<Search size={18} color={colors.muted} />} placeholder="Nom, téléphone, n° d'adhérent" value={q} onChangeText={setQ} />
      {q.trim().length >= 2
        ? items.map((p) => (
            <Pressable key={p.id} onPress={() => onChange(p)} accessibilityRole="button" style={({ pressed }) => [styles.option, pressed && { opacity: 0.7 }]}>
              <T style={{ fontWeight: "700" }}>
                {p.first_name} {p.last_name}
              </T>
              {p.locality_text ? <T style={{ color: colors.muted, fontSize: 13 }}>{p.locality_text}</T> : null}
            </Pressable>
          ))
        : null}
    </View>
  );
}

/**
 * Enrôlement d'une parcelle sur le terrain : exploitant, nom, contour relevé au GPS
 * (tour du champ ou coin par coin) ou simple position. L'AgroID est attribué à l'envoi.
 */
export default function NewParcelScreen() {
  const { status, workspace, expire } = useSession();
  const params = useLocalSearchParams<{ producteur?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [producer, setProducer] = useState<Producer | null>(null);
  const [name, setName] = useState("");
  const [mode, setMode] = useState<Mode>("walk");
  const [recording, setRecording] = useState(false);
  const [points, setPoints] = useState<Fix[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Created | null>(null);
  const { fix, error: gpsError, supported } = useLiveFix(!created && status === "signedIn");

  // Exploitant prérempli depuis la fiche producteur.
  useEffect(() => {
    if (!params.producteur || !workspace || workspace === "personal") return;
    api
      .request<Producer>(`/api/v1/producers/${params.producteur}/`, { workspace })
      .then(setProducer)
      .catch(() => undefined);
  }, [params.producteur, workspace]);

  // Tour du champ : chaque nouvelle position précise s'ajoute au tracé.
  useEffect(() => {
    if (recording && mode === "walk" && fix) setPoints((pts) => acceptFix(pts, fix, "walk"));
  }, [fix, recording, mode]);

  const ring = useMemo(() => points.map((p) => p.position), [points]);
  const area = ringAreaM2(ring);
  const gap = closingGapM(ring);
  const tone = TONE[accuracyTone(fix?.accuracy ?? null)];
  const ready = mode === "position" ? Boolean(fix && fix.accuracy <= 25) : points.length >= 3;

  if (status !== "signedIn") return <Redirect href="/connexion" />;
  if (!workspace) return <Redirect href="/espaces" />;
  const personal = workspace === "personal";

  const reset = () => {
    setPoints([]);
    setRecording(false);
  };

  async function submit() {
    setError(null);
    setRecording(false);
    setBusy(true);
    const body: Record<string, unknown> = { local_name: name.trim(), operator: personal ? null : (producer?.id ?? null) };
    if (mode === "position") {
      body.position = fix ? fix.position : null;
      body.capture_method = "gps_points";
    } else {
      body.geometry = toPolygon(points);
      body.capture_method = mode === "walk" ? "gps_walk" : "gps_points";
      body.gps_accuracy_m = medianAccuracy(points);
      body.captured_at = new Date((points[points.length - 1] as Fix).at).toISOString();
    }
    try {
      setCreated(await api.request<Created>("/api/v1/parcels/", { method: "POST", workspace, body }));
    } catch (e) {
      if (e instanceof SessionExpiredError) return expire();
      if (e instanceof NetworkError) setError("Pas de réseau : le relevé est conservé sur cet écran. Réessayez dès que le réseau revient.");
      else if (e instanceof ApiError && e.status === 403) setError("Votre rôle ne permet pas d'enregistrer une parcelle.");
      else setError(e instanceof ApiError ? e.message : "Une erreur est survenue.");
    } finally {
      setBusy(false);
    }
  }

  if (created) {
    const flagged = created.status === "pending_validation";
    return (
      <View style={[styles.done, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.badge}>
          <Fingerprint size={34} color={colors.forest} />
        </View>
        <T style={{ fontSize: 22, fontWeight: "700", textAlign: "center", marginTop: 18 }}>Parcelle enregistrée</T>
        <T style={{ color: colors.muted, textAlign: "center", marginTop: 6 }}>Son identifiant unique :</T>
        <T mono style={styles.agroid} accessibilityLabel={`AgroID ${created.agroid ?? ""}`}>
          {created.agroid ?? "—"}
        </T>
        {flagged ? (
          <View style={{ marginTop: 14, alignSelf: "stretch" }}>
            <Alert tone="warning">Contour à vérifier (précision, surface ou chevauchement) : un agronome le contrôlera.</Alert>
          </View>
        ) : null}
        <View style={{ alignSelf: "stretch", gap: 10, marginTop: 28 }}>
          <Button label="Voir la fiche" onPress={() => router.replace({ pathname: "/parcelles/[id]", params: { id: created.id } })} />
          <Button
            label="Enrôler une autre parcelle"
            variant="secondary"
            onPress={() => {
              setCreated(null);
              setName("");
              reset();
            }}
          />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ backgroundColor: colors.surface, paddingTop: insets.top + 8, paddingHorizontal: 18, paddingBottom: insets.bottom + 28, gap: 14 }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Retour" hitSlop={10} style={{ padding: 4 }}>
            <ArrowLeft size={24} color={colors.ink} />
          </Pressable>
          <T style={{ fontSize: 22, fontWeight: "700" }} accessibilityRole="header">
            Enrôler une parcelle
          </T>
        </View>

        {error ? <Alert>{error}</Alert> : null}

        <Card style={{ gap: 12 }}>
          {personal ? null : (
            <View style={{ gap: 6 }}>
              <T style={styles.label}>Exploitant</T>
              <ProducerPicker workspace={workspace} value={producer} onChange={setProducer} />
            </View>
          )}
          <View style={{ gap: 6 }}>
            <T style={styles.label}>Nom de la parcelle (facultatif)</T>
            <Input accessibilityLabel="Nom de la parcelle" placeholder="ex. Casier Nord" value={name} onChangeText={setName} />
          </View>
        </Card>

        <View style={styles.segment} accessibilityRole="radiogroup">
          {MODES.map((m) => (
            <Pressable
              key={m.value}
              onPress={() => {
                setMode(m.value);
                reset();
              }}
              accessibilityRole="radio"
              accessibilityState={{ checked: mode === m.value }}
              style={[styles.segmentItem, mode === m.value && styles.segmentOn]}
            >
              <T style={{ fontSize: 14, fontWeight: "700", color: mode === m.value ? "#fff" : colors.ink }}>{m.label}</T>
            </Pressable>
          ))}
        </View>
        <T style={{ color: colors.muted, lineHeight: 20 }}>{MODES.find((m) => m.value === mode)?.hint}</T>

        {!supported ? (
          <Alert tone="info">Le relevé GPS se fait pour l&apos;instant dans l&apos;app navigateur (terrain.pestai.africa).</Alert>
        ) : gpsError ? (
          <Alert tone="warning">{gpsError}</Alert>
        ) : null}

        <View style={styles.gps}>
          <View style={[styles.dot, { backgroundColor: tone.color }]} />
          <T style={{ flex: 1, fontWeight: "700", color: tone.color }}>{tone.label}</T>
          {fix ? <T mono>± {Math.round(fix.accuracy)} m</T> : null}
        </View>

        <TrackPreview points={points} current={fix} closed={!recording && points.length >= 3} />

        {mode !== "position" ? (
          <View style={styles.stats}>
            <View style={styles.stat}>
              <T style={styles.statLabel}>Points</T>
              <T mono style={styles.statValue}>{points.length}</T>
            </View>
            <View style={styles.stat}>
              <T style={styles.statLabel}>Surface</T>
              <T mono style={styles.statValue}>{points.length >= 3 ? formatArea(area) : "—"}</T>
            </View>
            <View style={styles.stat}>
              <T style={styles.statLabel}>Périmètre</T>
              <T mono style={styles.statValue}>{points.length >= 2 ? formatDistance(perimeterM(ring, points.length >= 3)) : "—"}</T>
            </View>
          </View>
        ) : null}

        {mode === "walk" && recording && gap !== null ? (
          <T style={{ color: gap <= CLOSE_GAP_M ? colors.success : colors.muted, textAlign: "center" }}>
            {gap <= CLOSE_GAP_M ? "Vous êtes revenu près du départ : vous pouvez terminer." : `Départ à ${formatDistance(gap)}`}
          </T>
        ) : null}

        {mode === "walk" ? (
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Button
              style={{ flex: 1 }}
              label={recording ? "Pause" : points.length ? "Reprendre" : "Démarrer le tour"}
              icon={recording ? <Pause size={18} color="#fff" /> : <Play size={18} color="#fff" />}
              disabled={!supported || !fix}
              onPress={() => setRecording((r) => !r)}
            />
            <Button label="" variant="secondary" accessibilityLabel="Recommencer" icon={<RotateCcw size={18} color={colors.ink} />} disabled={!points.length} onPress={reset} />
          </View>
        ) : mode === "corners" ? (
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Button
              style={{ flex: 1 }}
              label={`Ajouter ce coin (${points.length + 1})`}
              icon={<Plus size={18} color="#fff" />}
              disabled={!fix || fix.accuracy > 25}
              onPress={() => fix && setPoints((pts) => acceptFix(pts, fix, "corners"))}
            />
            <Button label="" variant="secondary" accessibilityLabel="Annuler le dernier coin" icon={<Undo2 size={18} color={colors.ink} />} disabled={!points.length} onPress={() => setPoints((p) => p.slice(0, -1))} />
          </View>
        ) : null}

        <Button
          label={mode === "position" ? "Enregistrer à ma position" : "Terminer et attribuer l'AgroID"}
          icon={mode === "position" ? <MapPin size={18} color="#fff" /> : <Check size={18} color="#fff" />}
          disabled={!ready}
          loading={busy}
          onPress={submit}
        />
        {mode !== "position" && points.length > 0 && points.length < 3 ? (
          <T style={{ color: colors.muted, textAlign: "center" }}>Il faut au moins 3 points pour former un contour.</T>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 14, fontWeight: "700" },
  picked: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: radius.md, backgroundColor: colors.brand50 },
  option: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: radius.sm, backgroundColor: colors.surface },
  segment: { flexDirection: "row", gap: 6, padding: 4, borderRadius: radius.md, backgroundColor: colors.subtle },
  segmentItem: { flex: 1, height: 42, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  segmentOn: { backgroundColor: colors.forest },
  gps: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: radius.md, backgroundColor: colors.canvas, borderWidth: 1, borderColor: colors.line },
  dot: { width: 12, height: 12, borderRadius: 6 },
  stats: { flexDirection: "row", gap: 10 },
  stat: { flex: 1, padding: 12, borderRadius: radius.md, backgroundColor: colors.canvas, borderWidth: 1, borderColor: colors.line },
  statLabel: { fontSize: 12, color: colors.muted },
  statValue: { fontSize: 17, marginTop: 2 },
  done: { flex: 1, backgroundColor: colors.canvas, paddingHorizontal: 24, alignItems: "center" },
  badge: { width: 76, height: 76, borderRadius: 38, alignItems: "center", justifyContent: "center", backgroundColor: colors.brand50 },
  agroid: { marginTop: 10, fontSize: 26, letterSpacing: 1, color: colors.forest },
});
