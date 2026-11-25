import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Check, CloudUpload, FlaskConical } from "lucide-react-native";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SoilTestForm } from "@/components/soil-test-form";
import { Alert, Button, Card, T } from "@/components/ui";
import { ApiError, NetworkError, SessionExpiredError } from "@/lib/api";
import { api } from "@/lib/client";
import { useLiveFix } from "@/lib/gps-track";
import { submit as submitOp } from "@/lib/outbox";
import { useSession } from "@/lib/session";
import { useSiteReferentials } from "@/lib/site";
import { EMPTY_SOIL, type SoilDraft, checkSoil, formatSoilValue, lastKitModel, rememberKitModel, soilBody } from "@/lib/soil";
import { colors, radius } from "@/theme";

type Saved = { pending: boolean; values: { label: string; value: string; unit: string; unusual: boolean }[] };

/** Mesurer le sol d'une parcelle au kit de terrain (J20c), avec ou sans réseau. */
export default function SoilTestScreen() {
  const { id, agroid } = useLocalSearchParams<{ id: string; agroid?: string }>();
  const { status, workspace, expire } = useSession();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const refs = useSiteReferentials(workspace);
  const params = refs?.soil_parameters ?? null;
  const [draft, setDraft] = useState<SoilDraft>(EMPTY_SOIL);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Saved | null>(null);
  const { fix } = useLiveFix(!saved && status === "signedIn");

  useEffect(() => {
    void lastKitModel().then((m) => m && setDraft((d) => (d.device ? d : { ...d, device: m })));
  }, []);

  if (status !== "signedIn") return <Redirect href="/connexion" />;
  if (!workspace) return <Redirect href="/espaces" />;

  const check = params ? checkSoil(params.filter((p) => p.kit), draft) : null;

  async function save() {
    if (!params || !id) return;
    // Position de la mesure si le GPS est précis (≤ 25 m).
    const body = soilBody(params, draft, fix && fix.accuracy <= 25 ? fix.position : null);
    if (!body) return;
    setError(null);
    setBusy(true);
    try {
      const sent = await submitOp(api, {
        workspace: workspace as string,
        entity_type: "soil_test",
        params: { parcel: id },
        payload: body,
        label: `Mesure du sol · ${agroid || "parcelle en attente d'envoi"}`,
      });
      void rememberKitModel(draft.device);
      const local = params
        .filter((p) => body.values[p.code] !== undefined)
        .map((p) => ({ label: p.label, value: body.values[p.code]!, unit: p.unit, unusual: Boolean(check?.unusual[p.code]) }));
      setSaved({ pending: sent.kind !== "applied", values: local });
    } catch (e) {
      if (e instanceof SessionExpiredError) return expire();
      if (e instanceof NetworkError) setError("Pas de réseau : réessayez dès que le réseau revient (les valeurs restent à l'écran).");
      else if (e instanceof ApiError && e.status === 403) setError("Votre rôle ne permet pas de mesurer le sol de cette parcelle.");
      else setError(e instanceof ApiError ? e.message : "Une erreur est survenue.");
    } finally {
      setBusy(false);
    }
  }

  if (saved) {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: colors.canvas }} contentContainerStyle={{ padding: 24, paddingTop: insets.top + 40, gap: 14 }}>
        <View style={styles.badge}>{saved.pending ? <CloudUpload size={32} color={colors.forest} /> : <Check size={34} color={colors.forest} />}</View>
        <T style={{ fontSize: 22, fontWeight: "700", textAlign: "center" }}>
          {saved.pending ? "Mesure gardée sur le téléphone" : "Mesure enregistrée"}
        </T>
        {saved.pending ? (
          <T style={{ color: colors.muted, textAlign: "center" }}>Pas de réseau : elle partira toute seule au retour du réseau.</T>
        ) : null}
        <Card style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {saved.values.map((v) => (
            <View key={v.label} style={[styles.measure, v.unusual && { backgroundColor: colors.warningBg }]}>
              <T style={{ fontSize: 12, color: v.unusual ? colors.warning : colors.muted }}>{v.label}</T>
              <T mono style={{ fontSize: 16 }}>
                {formatSoilValue(v.value, v.unit)}
              </T>
            </View>
          ))}
        </Card>
        <Button label="Retour à la fiche" onPress={() => router.back()} />
        <Button label="Nouvelle mesure (autre point)" variant="secondary" onPress={() => { setSaved(null); setDraft({ ...EMPTY_SOIL, depth: draft.depth, device: draft.device }); }} />
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.surface }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Retour" hitSlop={10} style={{ padding: 6 }}>
          <ArrowLeft size={24} color={colors.ink} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <T style={{ fontSize: 20, fontWeight: "700" }} accessibilityRole="header">
            Mesurer le sol
          </T>
          {agroid ? (
            <T mono style={{ color: colors.muted }}>
              {agroid}
            </T>
          ) : null}
        </View>
        <FlaskConical size={22} color={colors.forest} />
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 14 }}>
        {error ? <Alert>{error}</Alert> : null}
        <SoilTestForm params={params} value={draft} onChange={setDraft} />
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Button
          label="Enregistrer la mesure"
          icon={<Check size={18} color="#fff" />}
          loading={busy}
          disabled={!check || !check.filled || Object.keys(check.errors).length > 0}
          onPress={save}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingBottom: 12, backgroundColor: colors.canvas, borderBottomWidth: 1, borderBottomColor: colors.line },
  footer: { backgroundColor: colors.canvas, borderTopWidth: 1, borderTopColor: colors.line, paddingHorizontal: 16, paddingTop: 12 },
  badge: { alignSelf: "center", width: 72, height: 72, borderRadius: 36, backgroundColor: colors.brand50, alignItems: "center", justifyContent: "center" },
  measure: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: radius.sm, backgroundColor: colors.subtle, minWidth: "30%" },
});
