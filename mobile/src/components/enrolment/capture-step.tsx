import { MapPin, Pause, Play, Plus, RotateCcw, Undo2 } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { TrackPreview } from "@/components/track-preview";
import { Alert, Button, Card, Input, T } from "@/components/ui";
import { formatArea, formatDistance } from "@/lib/geo";
import {
  CLOSE_GAP_M,
  type Fix,
  MAX_ACCURACY_M,
  acceptFix,
  accuracyTone,
  closingGapM,
  perimeterM,
  ringAreaM2,
} from "@/lib/gps-track";
import { colors, radius } from "@/theme";

export type CaptureMode = "walk" | "corners" | "position";

const MODES: { value: CaptureMode; label: string; hint: string }[] = [
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

/** Étape « Contour » : nom de la parcelle et relevé GPS (tour, coins ou position seule). */
export function CaptureStep({
  name,
  onName,
  mode,
  onMode,
  points,
  onPoints,
  position,
  onPosition,
  fix,
  gpsError,
  supported,
}: {
  name: string;
  onName: (v: string) => void;
  mode: CaptureMode;
  onMode: (m: CaptureMode) => void;
  points: Fix[];
  onPoints: (update: (pts: Fix[]) => Fix[]) => void;
  position: Fix | null;
  onPosition: (f: Fix | null) => void;
  fix: Fix | null;
  gpsError: string | null;
  supported: boolean;
}) {
  const [recording, setRecording] = useState(false);
  useEffect(() => {
    if (recording && mode === "walk" && fix) onPoints((pts) => acceptFix(pts, fix, "walk"));
  }, [fix, recording, mode, onPoints]);

  const ring = useMemo(() => points.map((p) => p.position), [points]);
  const gap = closingGapM(ring);
  const tone = TONE[accuracyTone(fix?.accuracy ?? null)];
  const reset = () => {
    setRecording(false);
    onPoints(() => []);
  };

  return (
    <>
      <Card style={{ gap: 6 }}>
        <T style={styles.label}>Nom de la parcelle (facultatif)</T>
        <Input accessibilityLabel="Nom de la parcelle" placeholder="ex. Casier Nord" value={name} onChangeText={onName} />
      </Card>

      <View style={styles.segment} accessibilityRole="radiogroup" accessibilityLabel="Méthode de relevé">
        {MODES.map((m) => (
          <Pressable
            key={m.value}
            onPress={() => {
              if (m.value === mode) return;
              onMode(m.value);
              reset();
              onPosition(null);
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

      {mode === "position" ? (
        <Card style={{ gap: 10 }}>
          {position ? (
            <>
              <T style={{ fontWeight: "700", color: colors.success }}>Position enregistrée</T>
              <T mono style={{ color: colors.muted }}>
                {position.position[1].toFixed(5)}, {position.position[0].toFixed(5)} · ± {Math.round(position.accuracy)} m
              </T>
              <Button label="Reprendre la position" variant="secondary" icon={<RotateCcw size={18} color={colors.ink} />} onPress={() => onPosition(null)} />
            </>
          ) : (
            <Button
              label="Enregistrer ma position"
              icon={<MapPin size={18} color="#fff" />}
              disabled={!fix || fix.accuracy > MAX_ACCURACY_M}
              onPress={() => fix && onPosition(fix)}
            />
          )}
        </Card>
      ) : (
        <>
          <TrackPreview points={points} current={fix} closed={!recording && points.length >= 3} />
          <View style={styles.stats}>
            <View style={styles.stat}>
              <T style={styles.statLabel}>Points</T>
              <T mono style={styles.statValue}>{points.length}</T>
            </View>
            <View style={styles.stat}>
              <T style={styles.statLabel}>Surface</T>
              <T mono style={styles.statValue}>{points.length >= 3 ? formatArea(ringAreaM2(ring)) : "—"}</T>
            </View>
            <View style={styles.stat}>
              <T style={styles.statLabel}>Périmètre</T>
              <T mono style={styles.statValue}>{points.length >= 2 ? formatDistance(perimeterM(ring, points.length >= 3)) : "—"}</T>
            </View>
          </View>
          {mode === "walk" && recording && gap !== null ? (
            <T style={{ color: gap <= CLOSE_GAP_M ? colors.success : colors.muted, textAlign: "center" }}>
              {gap <= CLOSE_GAP_M ? "Vous êtes revenu près du départ : mettez en pause puis continuez." : `Départ à ${formatDistance(gap)}`}
            </T>
          ) : null}
          {mode === "walk" ? (
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Button
                style={{ flex: 1 }}
                label={recording ? "Pause" : points.length ? "Reprendre le tour" : "Démarrer le tour"}
                icon={recording ? <Pause size={18} color="#fff" /> : <Play size={18} color="#fff" />}
                disabled={!supported || !fix}
                onPress={() => setRecording((r) => !r)}
              />
              <Button label="" variant="secondary" accessibilityLabel="Recommencer" icon={<RotateCcw size={18} color={colors.ink} />} disabled={!points.length} onPress={reset} />
            </View>
          ) : (
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Button
                style={{ flex: 1 }}
                label={`Ajouter ce coin (${points.length + 1})`}
                icon={<Plus size={18} color="#fff" />}
                disabled={!fix || fix.accuracy > MAX_ACCURACY_M}
                onPress={() => fix && onPoints((pts) => acceptFix(pts, fix, "corners"))}
              />
              <Button label="" variant="secondary" accessibilityLabel="Annuler le dernier coin" icon={<Undo2 size={18} color={colors.ink} />} disabled={!points.length} onPress={() => onPoints((p) => p.slice(0, -1))} />
            </View>
          )}
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 14, fontWeight: "700" },
  segment: { flexDirection: "row", gap: 6, padding: 4, borderRadius: radius.md, backgroundColor: colors.subtle },
  segmentItem: { flex: 1, height: 44, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  segmentOn: { backgroundColor: colors.forest },
  gps: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: radius.md, backgroundColor: colors.canvas, borderWidth: 1, borderColor: colors.line },
  dot: { width: 12, height: 12, borderRadius: 6 },
  stats: { flexDirection: "row", gap: 10 },
  stat: { flex: 1, padding: 12, borderRadius: radius.md, backgroundColor: colors.canvas, borderWidth: 1, borderColor: colors.line },
  statLabel: { fontSize: 12, color: colors.muted },
  statValue: { fontSize: 17, marginTop: 2 },
});
