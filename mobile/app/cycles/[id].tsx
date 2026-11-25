import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Plus, Scale, Sprout, Wrench } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Chips } from "@/components/chips";
import { DateField } from "@/components/date-field";
import { Alert, Button, Card, Input, StatusPill, T } from "@/components/ui";
import {
  CYCLE_NEXT,
  CYCLE_STATUS,
  MEASUREMENT_METHODS,
  OPERATION_TYPES,
  PLANTING_METHODS,
  SEED_SOURCES,
  formatKg,
  shortDate,
  todayIso,
  yieldTHa,
} from "@/lib/agriculture";
import { ApiError, NetworkError, SessionExpiredError } from "@/lib/api";
import { api } from "@/lib/client";
import { type FieldCycle, loadFieldCycle } from "@/lib/field-data";
import { formatArea } from "@/lib/geo";
import { type EntityType, submit as submitOp } from "@/lib/outbox";
import { useSession } from "@/lib/session";
import { colors, radius } from "@/theme";

type Panel = "operation" | "harvest" | null;

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ width: "50%", paddingVertical: 6 }}>
      <T style={{ fontSize: 12, color: colors.muted }}>{label}</T>
      <T style={{ fontWeight: "700", marginTop: 2 }}>{value}</T>
    </View>
  );
}

/** Fiche d'un cycle de culture dans l'app (J19) : suivi, opérations, récoltes. */
export default function CycleScreen() {
  const { id, nouveau } = useLocalSearchParams<{ id: string; nouveau?: string }>();
  const { status, workspace, expire } = useSession();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [field, setField] = useState<FieldCycle | null>(null);
  const cycle = field?.cycle ?? null;
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(
    nouveau === "1" ? "Cycle enregistré." : nouveau === "local" ? "Pas de réseau : cycle gardé sur le téléphone, envoi au retour du réseau." : null,
  );
  const [busy, setBusy] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  // Opération
  const [opType, setOpType] = useState("");
  const [opDate, setOpDate] = useState(todayIso());
  const [opProduct, setOpProduct] = useState("");
  const [opQty, setOpQty] = useState("");
  const [opUnit, setOpUnit] = useState("");
  // Récolte
  const [hDate, setHDate] = useState(todayIso());
  const [bags, setBags] = useState("");
  const [bagKg, setBagKg] = useState("80");
  const [kg, setKg] = useState("");
  const [method, setMethod] = useState("declared");

  const load = useCallback(async () => {
    if (!workspace || !id) return;
    try {
      setField(await loadFieldCycle(api, workspace, id));
    } catch (e) {
      if (e instanceof SessionExpiredError) return expire();
      setError(e instanceof NetworkError ? "Pas de réseau, et ce cycle n'est pas encore sur le téléphone." : "Cycle introuvable.");
    }
  }, [workspace, id, expire]);

  useEffect(() => {
    void load();
  }, [load]);

  if (status !== "signedIn") return <Redirect href="/connexion" />;
  if (!workspace) return <Redirect href="/espaces" />;

  async function send(
    entity: EntityType,
    operation: "create" | "update",
    body: Record<string, unknown>,
    label: string,
    done: string,
  ) {
    if (!field || !workspace) return;
    setError(null);
    setNotice(null);
    setBusy(true);
    const update = operation === "update";
    try {
      const sent = await submitOp(api, {
        workspace,
        entity_type: entity,
        operation,
        params: update ? {} : { cycle: field.ref },
        entity_id: update ? field.ref : null,
        // Version connue du téléphone : un changement fait entre-temps au bureau devient un conflit.
        base_row_version: update && !field.pending && !field.statusPending ? field.cycle.row_version : null,
        payload: body,
        label: `${label} · ${field.cycle.crop.name_fr}${field.cycle.parcel.agroid ? ` · ${field.cycle.parcel.agroid}` : ""}`,
      });
      if (sent.kind === "conflict") setError("Ce cycle a été modifié entre-temps au bureau : votre changement n'a pas été appliqué.");
      else setNotice(sent.kind === "queued" ? `${done.replace(".", "")} sur le téléphone : envoi au retour du réseau.` : done);
      setPanel(null);
      await load();
    } catch (e) {
      if (e instanceof SessionExpiredError) return expire();
      if (e instanceof NetworkError) setError("Pas de réseau : réessayez dès que le réseau revient (la saisie reste à l'écran).");
      else if (e instanceof ApiError && e.status === 403) setError("Votre rôle ne permet pas cette action.");
      else setError(e instanceof ApiError ? e.message : "Une erreur est survenue.");
    } finally {
      setBusy(false);
    }
  }

  const bagsN = Number(bags.replace(",", "."));
  const bagKgN = Number(bagKg.replace(",", "."));
  const harvestKg = bags.trim() ? bagsN * bagKgN : Number(kg.replace(",", "."));

  function addOperation() {
    const qty = Number(opQty.replace(",", "."));
    void send(
      "crop_operation",
      "create",
      {
        operation_type: opType,
        performed_date: opDate || null,
        source: "field_agent",
        product_text: opProduct.trim(),
        quantity: opQty.trim() && qty > 0 ? qty.toFixed(2) : null,
        quantity_unit: opUnit.trim(),
      },
      OPERATION_TYPES[opType] ?? "Opération",
      "Opération enregistrée.",
    );
  }

  function addHarvest() {
    void send(
      "harvest",
      "create",
      {
        harvest_date: hDate,
        quantity_kg: harvestKg.toFixed(2),
        original_quantity: bags.trim() ? bagsN.toFixed(2) : null,
        original_unit: bags.trim() ? `sac de ${bagKgN} kg` : "kg",
        measurement_method: method,
      },
      `Récolte ${formatKg(harvestKg)}`,
      "Récolte enregistrée.",
    );
  }

  if (!cycle) {
    return (
      <View style={{ flex: 1, padding: 24, justifyContent: "center", backgroundColor: colors.surface }}>
        {error ? <Alert>{error}</Alert> : <ActivityIndicator color={colors.forest} />}
      </View>
    );
  }

  const st = CYCLE_STATUS[cycle.status] ?? { label: cycle.status, tone: "neutral" as const };
  const harvestArea = cycle.harvests.reduce((s, h) => s + Number(h.harvested_area_m2 ?? 0), 0);
  const yieldText = yieldTHa(cycle.total_harvest_kg, harvestArea || cycle.declared_area_m2);
  const editable = !cycle.is_archived;
  const operations = [...cycle.operations].sort((a, b) => (b.performed_date ?? b.planned_date ?? "").localeCompare(a.performed_date ?? a.planned_date ?? ""));

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" style={{ backgroundColor: colors.surface }} contentContainerStyle={{ paddingBottom: insets.bottom + 28 }}>
        <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Retour" hitSlop={10} style={{ padding: 8 }}>
            <ArrowLeft size={22} color="#fff" />
          </Pressable>
          <T style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>Cycle de culture</T>
        </View>
        <View style={{ padding: 16, gap: 12 }}>
          {notice ? <Alert tone="info">{notice}</Alert> : null}
          {error ? <Alert>{error}</Alert> : null}

          <Card style={{ gap: 6 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Sprout size={20} color={colors.forest} />
              <T style={{ fontSize: 22, fontWeight: "700", flex: 1 }}>{cycle.crop.name_fr}</T>
              <StatusPill tone={st.tone === "danger" ? "warning" : st.tone} label={st.label} />
            </View>
            <T style={{ color: colors.muted }}>
              {cycle.campaign?.name ?? "Hors campagne"}
              {cycle.cultivation_unit ? ` · unité ${cycle.cultivation_unit.code}` : ""}
            </T>
            <T mono style={{ color: colors.muted, fontSize: 13 }}>
              {cycle.parcel.agroid || "Parcelle en attente d'envoi"}
            </T>
            {field?.pending || field?.statusPending ? (
              <T style={styles.waiting}>
                {field.pending ? "Cycle gardé sur le téléphone : envoi au retour du réseau." : "Changement de statut en attente d'envoi."}
              </T>
            ) : field?.offline ? (
              <T style={{ color: colors.muted, fontSize: 13 }}>Copie du téléphone (pas de réseau).</T>
            ) : null}
            <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 6 }}>
              <Fact label={cycle.sowing_date ? "Semis" : "Semis prévu"} value={shortDate(cycle.sowing_date ?? cycle.planned_sowing_date)} />
              <Fact label="Surface" value={cycle.declared_area_m2 ? formatArea(Number(cycle.declared_area_m2)) : "—"} />
              <Fact label="Récolte" value={formatKg(cycle.total_harvest_kg)} />
              <Fact label="Rendement" value={yieldText ?? "—"} />
              <Fact label="Semence" value={SEED_SOURCES[cycle.seed_source] ?? "—"} />
              <Fact label="Implantation" value={PLANTING_METHODS[cycle.planting_method] ?? "—"} />
            </View>
            {editable && (CYCLE_NEXT[cycle.status] ?? []).length ? (
              <View style={{ flexDirection: "row", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                {(CYCLE_NEXT[cycle.status] ?? []).map((n) => (
                  <Button
                    key={n.status}
                    label={n.label}
                    variant={n.status === "abandoned" ? "secondary" : "primary"}
                    loading={busy}
                    onPress={() =>
                      void send(
                        "crop_cycle",
                        "update",
                        n.status === "in_progress" && !cycle.sowing_date ? { status: n.status, sowing_date: todayIso() } : { status: n.status },
                        n.label,
                        "Cycle mis à jour.",
                      )
                    }
                  />
                ))}
              </View>
            ) : null}
          </Card>

          {editable ? (
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Button style={{ flex: 1 }} variant={panel === "operation" ? "primary" : "secondary"} label="Opération" icon={<Wrench size={18} color={panel === "operation" ? "#fff" : colors.ink} />} onPress={() => setPanel(panel === "operation" ? null : "operation")} />
              <Button style={{ flex: 1 }} variant={panel === "harvest" ? "primary" : "secondary"} label="Récolte" icon={<Scale size={18} color={panel === "harvest" ? "#fff" : colors.ink} />} onPress={() => setPanel(panel === "harvest" ? null : "harvest")} />
            </View>
          ) : null}

          {panel === "operation" ? (
            <Card style={{ gap: 10 }}>
              <T style={styles.h2}>Nouvelle opération</T>
              <Chips label="Type d'opération" options={Object.entries(OPERATION_TYPES) as [string, string][]} value={opType} onChange={setOpType} />
              <T style={styles.label}>Date</T>
              <DateField label="Date de l'opération" value={opDate} onChange={setOpDate} max={todayIso()} />
              <T style={styles.label}>Produit (facultatif)</T>
              <Input accessibilityLabel="Produit" placeholder="ex. Urée 46 %" value={opProduct} onChangeText={setOpProduct} />
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1, gap: 6 }}>
                  <T style={styles.label}>Quantité</T>
                  <Input accessibilityLabel="Quantité" keyboardType="decimal-pad" value={opQty} onChangeText={setOpQty} />
                </View>
                <View style={{ flex: 1, gap: 6 }}>
                  <T style={styles.label}>Unité</T>
                  <Input accessibilityLabel="Unité de la quantité" placeholder="kg, sac, L" value={opUnit} onChangeText={setOpUnit} />
                </View>
              </View>
              <Button label="Enregistrer l'opération" icon={<Plus size={18} color="#fff" />} disabled={!opType || !opDate} loading={busy} onPress={addOperation} />
            </Card>
          ) : null}

          {panel === "harvest" ? (
            <Card style={{ gap: 10 }}>
              <T style={styles.h2}>Nouvelle récolte</T>
              <T style={styles.label}>Date</T>
              <DateField label="Date de récolte" value={hDate} onChange={setHDate} max={todayIso()} />
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1, gap: 6 }}>
                  <T style={styles.label}>Nombre de sacs</T>
                  <Input accessibilityLabel="Nombre de sacs" keyboardType="decimal-pad" value={bags} onChangeText={setBags} />
                </View>
                <View style={{ flex: 1, gap: 6 }}>
                  <T style={styles.label}>kg par sac</T>
                  <Input accessibilityLabel="Kilos par sac" keyboardType="decimal-pad" value={bagKg} onChangeText={setBagKg} />
                </View>
              </View>
              {!bags.trim() ? (
                <View style={{ gap: 6 }}>
                  <T style={styles.label}>Ou quantité en kg</T>
                  <Input accessibilityLabel="Quantité récoltée en kg" keyboardType="decimal-pad" value={kg} onChangeText={setKg} />
                </View>
              ) : null}
              <T mono style={{ color: colors.forest }}>{harvestKg > 0 ? `= ${formatKg(harvestKg)}` : ""}</T>
              <T style={styles.label}>Mesure</T>
              <Chips label="Mesure" options={Object.entries(MEASUREMENT_METHODS) as [string, string][]} value={method} onChange={(v) => setMethod(v || "declared")} />
              <Button label="Enregistrer la récolte" icon={<Plus size={18} color="#fff" />} disabled={!(harvestKg > 0) || !hDate} loading={busy} onPress={addHarvest} />
            </Card>
          ) : null}

          <Card style={{ gap: 8 }}>
            <T style={styles.h2}>Opérations</T>
            {operations.length ? (
              operations.map((o) => (
                <View key={o.id} style={styles.row}>
                  <T style={{ fontWeight: "700", flex: 1 }}>
                    {OPERATION_TYPES[o.operation_type] ?? o.operation_type}
                    {field?.pendingIds.has(o.id) ? <T style={styles.waiting}> · en attente d&apos;envoi</T> : null}
                  </T>
                  <T mono style={{ color: colors.muted, fontSize: 13 }}>
                    {shortDate(o.performed_date ?? o.planned_date)}
                  </T>
                </View>
              ))
            ) : (
              <T style={{ color: colors.muted }}>Aucune opération.</T>
            )}
          </Card>
          <Card style={{ gap: 8 }}>
            <T style={styles.h2}>Récoltes</T>
            {cycle.harvests.length ? (
              cycle.harvests.map((h) => (
                <View key={h.id} style={styles.row}>
                  <T style={{ fontWeight: "700", flex: 1 }}>
                    {formatKg(h.quantity_kg)}
                    {field?.pendingIds.has(h.id) ? <T style={styles.waiting}> · en attente d&apos;envoi</T> : null}
                  </T>
                  <T mono style={{ color: colors.muted, fontSize: 13 }}>
                    {shortDate(h.harvest_date)}
                  </T>
                </View>
              ))
            ) : (
              <T style={{ color: colors.muted }}>Aucune récolte.</T>
            )}
          </Card>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  top: { backgroundColor: colors.forest, paddingHorizontal: 8, paddingBottom: 12, flexDirection: "row", alignItems: "center", gap: 6 },
  h2: { fontSize: 17, fontWeight: "700" },
  label: { fontSize: 14, fontWeight: "700" },
  waiting: { color: colors.warning, fontSize: 13, fontWeight: "400" },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.line, borderRadius: radius.sm },
});
