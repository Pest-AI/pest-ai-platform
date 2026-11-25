import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Check, CloudUpload, Fingerprint, MapPin, Pause, Play, Plus, RotateCcw, Search, Undo2, X } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Chips } from "@/components/chips";
import { SiteForm } from "@/components/site-form";
import { TrackPreview } from "@/components/track-preview";
import { Alert, Button, Card, Input, T } from "@/components/ui";
import { ApiError, NetworkError, SessionExpiredError } from "@/lib/api";
import { api } from "@/lib/client";
import { type PickedProducer, findLocalProducer, searchProducers } from "@/lib/field-data";
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
import { submit as submitOp } from "@/lib/outbox";
import { useSession } from "@/lib/session";
import { type SiteValues, hasSiteData, siteBody, useSiteReferentials } from "@/lib/site";
import { colors, radius } from "@/theme";

type Mode = "walk" | "corners" | "position";
type Owner = "operator" | "other" | "unknown";

const OWNERS: { value: Owner; label: string; personalLabel?: string }[] = [
  { value: "operator", label: "L'exploitant", personalLabel: "Moi-même" },
  { value: "other", label: "Une autre personne" },
  { value: "unknown", label: "Ne sait pas" },
];
const TENURES = [
  ["communal_allocation", "Affectation communale"],
  ["customary_right", "Droit coutumier"],
  ["family_land", "Terre familiale"],
  ["titled_property", "Titre foncier"],
  ["lease", "Bail"],
  ["communal", "Terre communautaire"],
  ["other", "Autre"],
  ["unknown", "Inconnu"],
] as const;
const ARRANGEMENTS = [
  ["rental", "Location"],
  ["sharecropping", "Métayage"],
  ["loan", "Prêt"],
  ["other", "Autre"],
] as const;
const RENTS = [
  ["cash", "En argent"],
  ["harvest_share", "Part de récolte"],
  ["in_kind", "En nature"],
  ["free", "Gratuit"],
  ["unknown", "Ne sait pas"],
] as const;

/** Parcelle créée (envoyée), ou gardée sur le téléphone (`pending`) : AgroID attribué à l'envoi. */
type Created = { id: string; agroid: string | null; status: string; pending?: boolean };

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

function ProducerPicker({ workspace, value, onChange }: { workspace: string; value: PickedProducer | null; onChange: (p: PickedProducer | null) => void }) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<PickedProducer[]>([]);
  useEffect(() => {
    if (value || q.trim().length < 2) return;
    const t = setTimeout(() => {
      searchProducers(api, workspace, q)
        .then(setItems)
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
          {value.pending ? <T style={{ color: colors.warning, fontWeight: "400" }}> · en attente d&apos;envoi</T> : null}
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
              {p.locality_text || p.pending ? (
                <T style={{ color: colors.muted, fontSize: 13 }}>
                  {[p.locality_text, p.pending ? "enrôlé hors ligne, en attente d'envoi" : ""].filter(Boolean).join(" · ")}
                </T>
              ) : null}
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
  const [producer, setProducer] = useState<PickedProducer | null>(null);
  const [name, setName] = useState("");
  const [owner, setOwner] = useState<Owner>("unknown");
  const [ownerName, setOwnerName] = useState("");
  const [tenure, setTenure] = useState<(typeof TENURES)[number][0]>("unknown");
  const [arrangement, setArrangement] = useState<(typeof ARRANGEMENTS)[number][0]>("rental");
  const [rent, setRent] = useState<(typeof RENTS)[number][0] | "">("");
  const [rentAmount, setRentAmount] = useState("");
  const [rentShare, setRentShare] = useState("");
  const [site, setSite] = useState<SiteValues>({ evidence: "declared" });
  const [mode, setMode] = useState<Mode>("walk");
  const [recording, setRecording] = useState(false);
  const [points, setPoints] = useState<Fix[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Created | null>(null);
  const { fix, error: gpsError, supported } = useLiveFix(!created && status === "signedIn");
  const refs = useSiteReferentials(workspace);

  // Exploitant prérempli depuis la fiche producteur.
  useEffect(() => {
    if (!params.producteur || !workspace || workspace === "personal") return;
    const id = params.producteur;
    void findLocalProducer(workspace, id).then((local) => {
      if (local) setProducer(local);
      else
        api
          .request<PickedProducer>(`/api/v1/producers/${id}/`, { workspace })
          .then(setProducer)
          .catch(() => undefined);
    });
  }, [params.producteur, workspace]);

  // Tour du champ : chaque nouvelle position précise s'ajoute au tracé.
  useEffect(() => {
    if (recording && mode === "walk" && fix) setPoints((pts) => acceptFix(pts, fix, "walk"));
  }, [fix, recording, mode]);

  const ring = useMemo(() => points.map((p) => p.position), [points]);
  const area = ringAreaM2(ring);
  const gap = closingGapM(ring);
  const tone = TONE[accuracyTone(fix?.accuracy ?? null)];
  const located = mode === "position" ? Boolean(fix && fix.accuracy <= 25) : points.length >= 3;
  const ownerOk = owner !== "other" || ownerName.trim().length > 1;

  if (status !== "signedIn") return <Redirect href="/connexion" />;
  if (!workspace) return <Redirect href="/espaces" />;
  const personal = workspace === "personal";
  const operatorKnown = personal || Boolean(producer);
  const ready = located && ownerOk && (owner !== "operator" || operatorKnown);

  const reset = () => {
    setPoints([]);
    setRecording(false);
  };

  async function submit() {
    setError(null);
    setRecording(false);
    setBusy(true);
    const body: Record<string, unknown> = { local_name: name.trim(), operator: personal ? null : (producer?.id ?? null) };
    if (owner !== "unknown") {
      body.ownership = { owner, owner_name: owner === "other" ? ownerName.trim() : "", tenure_type: tenure };
      if (owner === "other" && (personal || producer)) {
        body.arrangement_type = arrangement;
        if (rent) {
          const amount = Number(rentAmount.replace(/\s/g, ""));
          const share = Number(rentShare.replace(",", "."));
          body.lease = {
            rent_type: rent,
            rent_amount_xof: rent === "cash" && rentAmount.trim() && Number.isFinite(amount) ? Math.round(amount) : null,
            harvest_share_percent: rent === "harvest_share" && rentShare.trim() && share > 0 && share <= 100 ? share.toFixed(2) : null,
          };
        }
      }
    }
    if (hasSiteData(site)) body.site = siteBody(site);
    if (mode === "position") {
      body.position = fix ? fix.position : null;
      body.capture_method = "gps_points";
    } else {
      body.geometry = toPolygon(points);
      body.capture_method = mode === "walk" ? "gps_walk" : "gps_points";
      body.gps_accuracy_m = medianAccuracy(points);
      body.captured_at = new Date((points[points.length - 1] as Fix).at).toISOString();
    }
    const who = producer ? `${producer.first_name} ${producer.last_name}`.trim() : "";
    try {
      const sent = await submitOp(api, {
        workspace: workspace as string,
        entity_type: "parcel",
        params: {},
        payload: body,
        label: [name.trim() || "Parcelle sans nom", who].filter(Boolean).join(" · "),
      });
      setCreated(
        sent.kind === "applied"
          ? { id: sent.id, agroid: String(sent.result.agroid ?? ""), status: String(sent.result.status ?? "") }
          : { id: `@op:${sent.op.id}`, agroid: null, status: "", pending: true },
      );
    } catch (e) {
      if (e instanceof SessionExpiredError) return expire();
      if (e instanceof NetworkError) setError("Pas de réseau : le relevé est conservé sur cet écran. Réessayez dès que le réseau revient.");
      else if (e instanceof ApiError && e.status === 403) setError("Votre rôle ne permet pas d'enregistrer une parcelle.");
      else setError(e instanceof ApiError ? e.message : "Une erreur est survenue.");
    } finally {
      setBusy(false);
    }
  }

  if (created?.pending) {
    const local = { id: created.id };
    return (
      <View style={[styles.done, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.badge}>
          <CloudUpload size={34} color={colors.forest} />
        </View>
        <T style={{ fontSize: 22, fontWeight: "700", textAlign: "center", marginTop: 18 }}>Parcelle gardée sur le téléphone</T>
        <T style={{ color: colors.muted, textAlign: "center", marginTop: 6, lineHeight: 20 }}>
          Pas de réseau : elle partira toute seule au retour du réseau, et recevra alors son AgroID. Vous pouvez continuer à
          saisir : unités, cycle, sol et eau.
        </T>
        <View style={{ alignSelf: "stretch", gap: 10, marginTop: 28 }}>
          <Button label="Ajouter une unité de culture" onPress={() => router.push({ pathname: "/parcelles/unite", params: local })} />
          <Button label="Démarrer un cycle" variant="secondary" onPress={() => router.push({ pathname: "/cycles/nouveau", params: { parcelle: created.id } })} />
          <Button label="Voir les envois" variant="secondary" onPress={() => router.push("/envois")} />
          <Button
            label="Enrôler une autre parcelle"
            variant="secondary"
            onPress={() => {
              setCreated(null);
              setName("");
              setOwner("unknown");
              setOwnerName("");
              setTenure("unknown");
              setRent("");
              setRentAmount("");
              setRentShare("");
              setSite({ evidence: "declared" });
              reset();
            }}
          />
        </View>
      </View>
    );
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
              setOwner("unknown");
              setOwnerName("");
              setTenure("unknown");
              setRent("");
              setRentAmount("");
              setRentShare("");
              setSite({ evidence: "declared" });
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

        <Card style={{ gap: 12 }}>
          <T style={{ fontSize: 16, fontWeight: "700" }} accessibilityRole="header">
            Foncier
          </T>
          <View style={{ gap: 6 }}>
            <T style={styles.label}>Propriétaire de la parcelle</T>
            <Chips
              label="Propriétaire de la parcelle"
              options={OWNERS.map((o) => [o.value, personal && o.personalLabel ? o.personalLabel : o.label] as const)}
              value={owner}
              onChange={(v) => v && setOwner(v)}
            />
            {owner === "operator" && !operatorKnown ? (
              <T style={{ color: colors.warning, fontSize: 13 }}>Choisissez d&apos;abord l&apos;exploitant.</T>
            ) : null}
          </View>
          {owner === "other" ? (
            <>
              <View style={{ gap: 6 }}>
                <T style={styles.label}>Nom du propriétaire</T>
                <Input accessibilityLabel="Nom du propriétaire" placeholder="ex. Famille Diallo" value={ownerName} onChangeText={setOwnerName} autoCapitalize="words" />
              </View>
              {personal || producer ? (
                <View style={{ gap: 6 }}>
                  <T style={styles.label}>L&apos;exploitant la cultive en</T>
                  <Chips label="Mode d'exploitation" options={ARRANGEMENTS} value={arrangement} onChange={(v) => v && setArrangement(v)} />
                </View>
              ) : null}
              {(personal || producer) && arrangement !== "other" ? (
                <View style={{ gap: 6 }}>
                  <T style={styles.label}>Contrepartie</T>
                  <Chips label="Contrepartie" options={RENTS} value={rent} onChange={setRent} clearable />
                  {rent === "cash" ? (
                    <Input accessibilityLabel="Montant du loyer en FCFA par campagne" keyboardType="number-pad" placeholder="Loyer en FCFA par campagne" value={rentAmount} onChangeText={setRentAmount} maxLength={10} />
                  ) : null}
                  {rent === "harvest_share" ? (
                    <Input accessibilityLabel="Part de la récolte en pourcentage" keyboardType="decimal-pad" placeholder="Part de la récolte (%) — ex. 33" value={rentShare} onChangeText={setRentShare} maxLength={5} />
                  ) : null}
                </View>
              ) : null}
            </>
          ) : null}
          {owner !== "unknown" ? (
            <View style={{ gap: 6 }}>
              <T style={styles.label}>Type de droit</T>
              <Chips label="Type de droit" options={TENURES} value={tenure} onChange={(v) => v && setTenure(v)} />
            </View>
          ) : null}
          <T style={{ color: colors.muted, fontSize: 13 }}>Déclaration du producteur : un document pourra la confirmer plus tard.</T>
        </Card>

        <SiteForm refs={refs} values={site} onChange={setSite} />

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
        {located && !ownerOk ? <T style={{ color: colors.muted, textAlign: "center" }}>Indiquez le nom du propriétaire.</T> : null}
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
