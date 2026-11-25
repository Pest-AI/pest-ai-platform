import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { Check, CloudUpload, Droplets, Fingerprint, FlaskConical, Layers, MapPin, Pencil, Users } from "lucide-react-native";
import type * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BackHandler, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { type CaptureMode, CaptureStep } from "@/components/enrolment/capture-step";
import { EMPTY_LAND, type Land, LandStep, OWNERS, TENURES, landBody, ARRANGEMENTS, RENTS } from "@/components/enrolment/land-step";
import { type NewProducer, ProducerStep } from "@/components/enrolment/producer-step";
import { StepShell } from "@/components/enrolment/step-shell";
import { QrCode } from "@/components/qr-code";
import { SiteForm } from "@/components/site-form";
import { SoilTestForm } from "@/components/soil-test-form";
import { Alert, Avatar, Button, Card, T, initialsOf } from "@/components/ui";
import { ApiError, NetworkError, SessionExpiredError } from "@/lib/api";
import { api } from "@/lib/client";
import { confirmAction } from "@/lib/confirm";
import { clearDraft, loadDraft, saveDraft } from "@/lib/enrolment-draft";
import { type PickedProducer, findLocalProducer } from "@/lib/field-data";
import { formatArea } from "@/lib/geo";
import { type Fix, medianAccuracy, ringAreaM2, toPolygon, useLiveFix } from "@/lib/gps-track";
import { submit as submitOp } from "@/lib/outbox";
import { toInternationalPhone } from "@/lib/phone";
import { agroidUrl } from "@/lib/qr";
import { useSession } from "@/lib/session";
import { type SiteValues, hasSiteData, labelOf, siteBody, useSiteReferentials } from "@/lib/site";
import { EMPTY_SOIL, type SoilDraft, checkSoil, formatSoilValue, lastKitModel, rememberKitModel, soilBody } from "@/lib/soil";
import { colors, radius } from "@/theme";

type Candidate = { id: string; display_name: string; locality: string; phone_hint: string; in_organization: boolean; can_attach: boolean };

/** Tout ce que l'agent a saisi : gardé sur le téléphone à chaque changement (brouillon). */
type Draft = {
  step: number;
  producer: PickedProducer | null;
  newProducer: NewProducer | null;
  /** Producteur déjà envoyé ou mis en file pendant cet enrôlement (évite un doublon au 2e essai). */
  producerRef: string | null;
  name: string;
  mode: CaptureMode;
  points: Fix[];
  position: Fix | null;
  land: Land;
  site: SiteValues;
  soil: SoilDraft;
};

const EMPTY: Draft = {
  step: 0,
  producer: null,
  newProducer: null,
  producerRef: null,
  name: "",
  mode: "walk",
  points: [],
  position: null,
  land: EMPTY_LAND,
  site: { evidence: "declared" },
  soil: EMPTY_SOIL,
};

type Done = { id: string; agroid: string | null; status: string; pending: boolean; area: number | null; who: string };

const label = (pairs: readonly (readonly [string, string])[], v: string) => pairs.find(([k]) => k === v)?.[1] ?? v;

/**
 * Enrôlement d'une parcelle, étape par étape : producteur, contour, foncier, sol et eau,
 * récapitulatif, puis AgroID. Avec ou sans réseau (file d'envoi) ; brouillon gardé à chaque
 * changement et repris à la réouverture.
 */
export default function EnrolmentScreen() {
  const { status, workspace, expire } = useSession();
  const params = useLocalSearchParams<{ producteur?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [d, setD] = useState<Draft>(EMPTY);
  const [ready, setReady] = useState(false);
  const [resumed, setResumed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [proposed, setProposed] = useState<string | null>(null);
  const personal = workspace === "personal";
  const { fix, error: gpsError, supported } = useLiveFix(ready && !done && d.step === 1 && status === "signedIn");
  const refs = useSiteReferentials(workspace);
  const soilParams = refs?.soil_parameters ?? null;
  const update = useCallback((patch: Partial<Draft>) => setD((cur) => ({ ...cur, ...patch })), []);
  const setPoints = useCallback((fn: (pts: Fix[]) => Fix[]) => setD((cur) => ({ ...cur, points: fn(cur.points) })), []);

  // Brouillon repris (ou exploitant prérempli depuis sa fiche).
  useEffect(() => {
    if (!workspace) return;
    let cancelled = false;
    void (async () => {
      const saved = await loadDraft<Draft>(workspace);
      if (cancelled) return;
      // Un relevé déjà commencé n'est jamais écrasé : il est repris en priorité.
      const started = saved && (saved.points.length > 0 || saved.position);
      if (params.producteur && !started) {
        const id = params.producteur;
        const local = await findLocalProducer(workspace, id);
        const producer =
          local ?? (await api.request<PickedProducer>(`/api/v1/producers/${id}/`, { workspace }).catch(() => null));
        if (!cancelled) setD({ ...EMPTY, producer, step: producer ? 1 : 0 });
      } else if (saved) {
        const { meta: _meta, ...rest } = saved;
        setD({ ...EMPTY, ...rest, soil: rest.soil ?? EMPTY_SOIL });
        setResumed(true);
      } else if (personal) {
        setD({ ...EMPTY, step: 1 });
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [workspace, params.producteur, personal]);

  // Modèle du kit prérempli avec le dernier utilisé sur ce téléphone.
  useEffect(() => {
    if (!ready || d.step !== 4 || d.soil.device) return;
    void lastKitModel().then((m) => m && setD((cur) => (cur.soil.device ? cur : { ...cur, soil: { ...cur.soil, device: m } })));
  }, [ready, d.step, d.soil.device]);

  // Numéro d'adhérent proposé pour un nouveau producteur.
  useEffect(() => {
    if (!workspace || personal) return;
    api
      .request<{ proposed: string }>("/api/v1/producers/membership-number/", { workspace })
      .then((r) => setProposed(r.proposed))
      .catch(() => setProposed(null));
  }, [workspace, personal]);

  // Brouillon enregistré à chaque changement, sans délai : quitter l'écran juste après un point
  // ne doit pas le perdre (écritures IndexedDB faites dans l'ordre).
  const who = d.producer
    ? `${d.producer.first_name} ${d.producer.last_name}`.trim()
    : d.newProducer
      ? `${d.newProducer.first} ${d.newProducer.last}`.trim()
      : "";
  useEffect(() => {
    if (!ready || !workspace || done) return;
    void saveDraft(workspace, d, {
      step: d.step,
      saved_at: new Date().toISOString(),
      label: [d.name.trim() || "Parcelle", who].filter(Boolean).join(" · "),
    });
  }, [d, ready, workspace, done, who]);

  const goBack = useCallback(() => {
    setError(null);
    if (d.step > (personal ? 1 : 0)) {
      update({ step: d.step - 1 });
      return true;
    }
    if (router.canGoBack()) router.back();
    else router.replace("/accueil");
    return true;
  }, [d.step, personal, router, update]);

  // Bouton retour d'Android : étape précédente.
  const backRef = useRef(goBack);
  backRef.current = goBack;
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => (done ? false : backRef.current()));
    return () => sub.remove();
  }, [done]);

  const ring = useMemo(() => d.points.map((p) => p.position), [d.points]);

  if (status !== "signedIn") return <Redirect href="/connexion" />;
  if (!workspace) return <Redirect href="/espaces" />;

  const close = () => {
    const leave = () => (router.canGoBack() ? router.back() : router.replace("/accueil"));
    const touched = d.producer || d.newProducer || d.points.length || d.position || d.name;
    if (!touched) return leave();
    confirmAction(
      "Quitter l'enrôlement ?",
      "Votre saisie est gardée sur le téléphone : vous la reprendrez depuis l'accueil.",
      "Quitter",
      leave,
    );
  };

  const restart = () =>
    confirmAction("Recommencer ?", "Le brouillon en cours sera effacé.", "Recommencer", () => {
      void clearDraft(workspace);
      setD({ ...EMPTY, step: personal ? 1 : 0 });
      setResumed(false);
      setCandidates(null);
      setError(null);
    });

  // ── Validation des étapes ──────────────────────────────────────────────
  const np = d.newProducer;
  const producerOk = personal || Boolean(d.producer) || Boolean(np && np.first.trim() && np.last.trim());
  const located = d.mode === "position" ? Boolean(d.position) : d.points.length >= 3;
  const ownerOk = d.land.owner !== "other" || d.land.ownerName.trim().length > 1;
  const area = d.mode === "position" ? null : ringAreaM2(ring);
  const soilCheck = soilParams ? checkSoil(soilParams.filter((p) => p.kit), d.soil) : { errors: {}, unusual: {}, filled: 0 };
  const soilOk = Object.keys(soilCheck.errors).length === 0;

  // ── Envoi ─────────────────────────────────────────────────────────────
  async function ensureProducer(confirmNew = false): Promise<string | null> {
    if (personal) return null;
    if (d.producer) return d.producer.id;
    if (d.producerRef) return d.producerRef;
    if (!np) return null;
    const sent = await submitOp(api, {
      workspace: workspace as string,
      entity_type: "producer",
      params: {},
      label: [`${np.first.trim()} ${np.last.trim()}`, np.locality.trim()].filter(Boolean).join(" · "),
      payload: {
        first_name: np.first.trim(),
        last_name: np.last.trim(),
        sex: np.sex,
        locality_text: np.locality.trim(),
        phone_number: np.phone.trim() ? toInternationalPhone(np.phone, np.country) : "",
        relationship_type: "member",
        membership_number: np.membership.trim(),
        confirm_new: confirmNew,
      },
    });
    const ref = sent.kind === "applied" ? sent.id : `@op:${sent.op.id}`;
    update({ producerRef: ref });
    return ref;
  }

  async function finish(confirmNew = false) {
    setError(null);
    setBusy(true);
    try {
      let operator: string | null;
      try {
        operator = await ensureProducer(confirmNew);
      } catch (e) {
        if (e instanceof ApiError && e.status === 409) {
          setCandidates(((e.body as { candidates?: Candidate[] }) ?? {}).candidates ?? []);
          return;
        }
        throw e;
      }
      const body: Record<string, unknown> = { local_name: d.name.trim(), operator, ...landBody(d.land, true) };
      if (hasSiteData(d.site)) body.site = siteBody(d.site);
      const soil = soilParams ? soilBody(soilParams, d.soil, d.mode === "position" ? (d.position?.position as [number, number]) : null) : null;
      if (soil) {
        body.soil_test = soil;
        void rememberKitModel(d.soil.device);
      }
      if (d.mode === "position") {
        body.position = d.position?.position ?? null;
        body.capture_method = "gps_points";
      } else {
        body.geometry = toPolygon(d.points);
        body.capture_method = d.mode === "walk" ? "gps_walk" : "gps_points";
        body.gps_accuracy_m = medianAccuracy(d.points);
        body.captured_at = new Date((d.points[d.points.length - 1] as Fix).at).toISOString();
      }
      const sent = await submitOp(api, {
        workspace: workspace as string,
        entity_type: "parcel",
        params: {},
        payload: body,
        label: [d.name.trim() || "Parcelle sans nom", who].filter(Boolean).join(" · "),
      });
      await clearDraft(workspace as string);
      setDone(
        sent.kind === "applied"
          ? { id: sent.id, agroid: String(sent.result.agroid ?? ""), status: String(sent.result.status ?? ""), pending: false, area, who }
          : { id: `@op:${sent.op.id}`, agroid: null, status: "", pending: true, area, who },
      );
    } catch (e) {
      if (e instanceof SessionExpiredError) return expire();
      if (e instanceof NetworkError) setError("Pas de réseau : votre saisie est gardée. Réessayez dès que le réseau revient.");
      else if (e instanceof ApiError && e.status === 403) setError("Votre rôle ne permet pas d'enregistrer une parcelle.");
      else setError(e instanceof ApiError ? e.message : "Une erreur est survenue.");
    } finally {
      setBusy(false);
    }
  }

  // ── Écran final : l'AgroID ────────────────────────────────────────────
  if (done) {
    const again = () => {
      setDone(null);
      setCandidates(null);
      setResumed(false);
      setD({ ...EMPTY, step: personal ? 1 : 0 });
    };
    const sameProducer = () => {
      const keep = d.producer ?? (d.producerRef && np ? ({ id: d.producerRef, first_name: np.first, last_name: np.last, locality_text: np.locality, pending: d.producerRef.startsWith("@op:") } as PickedProducer) : null);
      setDone(null);
      setD({ ...EMPTY, producer: keep, step: keep || personal ? 1 : 0 });
    };
    const flagged = done.status === "pending_validation";
    return (
      <ScrollView style={{ flex: 1, backgroundColor: colors.forest }} contentContainerStyle={{ paddingTop: insets.top + 32, paddingBottom: insets.bottom + 24, paddingHorizontal: 20, gap: 16 }}>
        <View style={{ alignItems: "center", gap: 10 }}>
          <View style={styles.doneBadge}>
            {done.pending ? <CloudUpload size={34} color={colors.forest} /> : <Check size={36} color={colors.forest} strokeWidth={3} />}
          </View>
          <T style={{ color: "#fff", fontSize: 24, fontWeight: "700", textAlign: "center" }}>
            {done.pending ? "Parcelle gardée sur le téléphone" : "Parcelle enrôlée"}
          </T>
          <T style={{ color: "rgba(255,255,255,0.8)", textAlign: "center", lineHeight: 20 }}>
            {done.pending
              ? "Pas de réseau : elle partira toute seule au retour du réseau et recevra alors son AgroID."
              : "Son identité numérique est créée."}
          </T>
        </View>

        <Card style={{ alignItems: "center", gap: 10, padding: 20 }}>
          {done.agroid ? (
            <>
              <T style={{ fontSize: 12, color: colors.muted, textTransform: "uppercase", letterSpacing: 1 }}>AgroID</T>
              <T mono style={styles.agroid} accessibilityLabel={`AgroID ${done.agroid}`}>
                {done.agroid}
              </T>
              <QrCode value={agroidUrl(done.agroid)} size={170} label={`QR code de l'AgroID ${done.agroid}`} />
            </>
          ) : (
            <>
              <Fingerprint size={40} color={colors.lineStrong} />
              <T style={{ color: colors.muted, textAlign: "center" }}>L&apos;AgroID et son QR code s&apos;afficheront après l&apos;envoi.</T>
            </>
          )}
          <View style={{ alignSelf: "stretch", borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 10, gap: 4 }}>
            <T style={{ fontWeight: "700", textAlign: "center" }}>{d.name.trim() || "Parcelle sans nom"}</T>
            <T style={{ color: colors.muted, textAlign: "center" }}>
              {[done.who, done.area ? formatArea(done.area) : "Position seule"].filter(Boolean).join(" · ")}
            </T>
          </View>
        </Card>
        {flagged ? <Alert tone="warning">Contour à vérifier (précision, surface ou chevauchement) : un agronome le contrôlera.</Alert> : null}

        <View style={{ gap: 10 }}>
          {!done.pending ? (
            <Button label="Voir la fiche de la parcelle" variant="secondary" onPress={() => router.replace({ pathname: "/parcelles/[id]", params: { id: done.id } })} />
          ) : null}
          <Button label="Ajouter une unité de culture" variant="secondary" onPress={() => router.push({ pathname: "/parcelles/unite", params: { id: done.id } })} />
          <Button label="Démarrer un cycle" variant="secondary" onPress={() => router.push({ pathname: "/cycles/nouveau", params: { parcelle: done.id } })} />
          {!personal && done.who ? <Button label={`Autre parcelle de ${done.who}`} variant="secondary" onPress={sameProducer} /> : null}
          <Button label="Enrôler une autre parcelle" variant="secondary" onPress={again} />
          <Pressable onPress={() => router.replace("/accueil")} accessibilityRole="button" style={{ padding: 12, alignItems: "center" }}>
            <T style={{ color: "#fff", fontWeight: "700" }}>Retour à l&apos;accueil</T>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  if (!ready) return <View style={{ flex: 1, backgroundColor: colors.surface }} />;

  const banner = resumed ? (
    <View style={styles.resumed}>
      <T style={{ flex: 1, color: colors.forest, fontSize: 13 }}>Enrôlement repris là où vous l&apos;aviez laissé.</T>
      <Pressable onPress={restart} accessibilityRole="button" hitSlop={8}>
        <T style={{ color: colors.forest, fontWeight: "700", fontSize: 13 }}>Recommencer</T>
      </Pressable>
    </View>
  ) : null;
  const go = (step: number) => {
    setError(null);
    update({ step });
  };

  // ── Étapes ────────────────────────────────────────────────────────────
  if (d.step === 0) {
    return (
      <StepShell
        step={0}
        title="Le producteur"
        hint="Qui cultive cette parcelle ? Cherchez-le, ou enrôlez-le s'il n'est pas encore enregistré."
        onBack={goBack}
        onClose={close}
        next={{
          label: "Continuer",
          onPress: () => go(1),
          disabled: !producerOk,
          reason: np ? "Indiquez le prénom et le nom." : "Choisissez l'exploitant ou enrôlez un nouveau producteur.",
        }}
      >
        {banner}
        <ProducerStep
          workspace={workspace}
          picked={d.producer}
          onPick={(p) => update({ producer: p, newProducer: null, producerRef: null })}
          draft={np}
          onDraft={(p) => update({ newProducer: p, producerRef: null })}
          proposedNumber={proposed}
        />
      </StepShell>
    );
  }

  if (d.step === 1) {
    return (
      <StepShell
        step={1}
        title="Le contour"
        onBack={goBack}
        onClose={close}
        next={{
          label: "Continuer",
          onPress: () => go(2),
          disabled: !located,
          reason: d.mode === "position" ? "Enregistrez la position de la parcelle." : "Il faut au moins 3 points pour former un contour.",
        }}
      >
        {banner}
        <CaptureStep
          name={d.name}
          onName={(name) => update({ name })}
          mode={d.mode}
          onMode={(mode) => update({ mode })}
          points={d.points}
          onPoints={setPoints}
          position={d.position}
          onPosition={(position) => update({ position })}
          fix={fix}
          gpsError={gpsError}
          supported={supported}
        />
      </StepShell>
    );
  }

  if (d.step === 2) {
    return (
      <StepShell
        step={2}
        title="Le foncier"
        hint="À qui appartient la parcelle, et à quel titre l'exploitant la cultive."
        onBack={goBack}
        onClose={close}
        next={{ label: "Continuer", onPress: () => go(3), disabled: !ownerOk, reason: "Indiquez le nom du propriétaire." }}
      >
        <LandStep value={d.land} onChange={(land) => update({ land })} personal={personal} />
      </StepShell>
    );
  }

  if (d.step === 3) {
    return (
      <StepShell
        step={3}
        title="Le sol et l'eau"
        hint="Complétez ce que vous savez : « Ne sait pas » est une réponse. Tout est facultatif et se complète plus tard."
        onBack={goBack}
        onClose={close}
        next={{
          label: hasSiteData(d.site) ? "Continuer" : "Passer",
          onPress: () => go(4),
        }}
      >
        <SiteForm refs={refs} values={d.site} onChange={(site) => update({ site })} defaultOpen />
      </StepShell>
    );
  }

  if (d.step === 4) {
    return (
      <StepShell
        step={4}
        title="Mesures du sol"
        hint="Avec le kit de terrain : pH, conductivité, azote, phosphore, potassium… Facultatif : passez si vous n'avez pas le kit."
        onBack={goBack}
        onClose={close}
        next={{
          label: soilCheck.filled ? "Continuer" : "Pas de kit : passer",
          onPress: () => go(5),
          disabled: !soilOk,
          reason: "Corrigez les valeurs impossibles (en rouge).",
        }}
      >
        <SoilTestForm params={soilParams} value={d.soil} onChange={(soil) => update({ soil })} />
      </StepShell>
    );
  }

  // Récapitulatif
  const siteFilled = Object.entries(d.site).filter(([k, v]) => v && k !== "evidence" && k !== "distance_to_village_km" && k !== "scheme_name" && k !== "other_detail");
  return (
    <StepShell
      step={5}
      title="Récapitulatif"
      hint="Vérifiez avec le producteur avant d'attribuer l'AgroID."
      onBack={goBack}
      onClose={close}
      next={{
        label: "Attribuer l'AgroID",
        icon: <Fingerprint size={18} color="#fff" />,
        onPress: () => void finish(false),
        loading: busy,
        disabled: !producerOk || !located || !ownerOk || !soilOk || Boolean(candidates),
        reason: candidates ? "Choisissez d'abord ci-dessus." : "Une étape est incomplète.",
      }}
    >
      {error ? <Alert>{error}</Alert> : null}
      {candidates ? (
        <Card style={{ gap: 10, borderColor: "#F5C2BD" }}>
          <T style={{ fontSize: 16, fontWeight: "700" }}>Ce producteur existe peut-être déjà</T>
          <T style={{ color: colors.muted, lineHeight: 20 }}>Même téléphone, ou même nom dans la même localité. Vérifiez avec lui.</T>
          {candidates.map((c) => (
            <View key={c.id} style={styles.candidate}>
              <View style={{ flex: 1 }}>
                <T style={{ fontWeight: "700" }}>{c.display_name}</T>
                <T style={{ color: colors.muted, fontSize: 13 }}>
                  {[c.locality, c.phone_hint ? `tél. …${c.phone_hint}` : ""].filter(Boolean).join(" · ") || "Localité non renseignée"}
                </T>
              </View>
              {c.in_organization ? (
                <Button
                  label="C'est lui"
                  variant="secondary"
                  onPress={() => {
                    const [first, ...rest] = c.display_name.split(" ");
                    update({ producer: { id: c.id, first_name: first ?? "", last_name: rest.join(" "), locality_text: c.locality }, newProducer: null, producerRef: null });
                    setCandidates(null);
                  }}
                />
              ) : c.can_attach ? (
                <Button
                  label="Rattacher"
                  variant="secondary"
                  loading={busy}
                  onPress={async () => {
                    setBusy(true);
                    setError(null);
                    try {
                      await api.request("/api/v1/producers/attach/", {
                        method: "POST",
                        workspace,
                        body: { producer_id: c.id, relationship_type: "member", membership_number: np?.membership.trim() ?? "" },
                      });
                      const [first, ...rest] = c.display_name.split(" ");
                      update({ producer: { id: c.id, first_name: first ?? "", last_name: rest.join(" "), locality_text: c.locality }, newProducer: null, producerRef: null });
                      setCandidates(null);
                    } catch (e) {
                      setError(e instanceof NetworkError ? "Le rattachement demande le réseau." : e instanceof ApiError ? e.message : "Une erreur est survenue.");
                    } finally {
                      setBusy(false);
                    }
                  }}
                />
              ) : null}
            </View>
          ))}
          <Button
            label="Ce n'est pas lui : créer une nouvelle fiche"
            variant="secondary"
            loading={busy}
            onPress={() => {
              setCandidates(null);
              void finish(true);
            }}
          />
        </Card>
      ) : null}

      <Section Icon={Users} title="Producteur" onEdit={personal ? undefined : () => go(0)}>
        {personal ? (
          <T>Vous êtes l&apos;exploitant.</T>
        ) : (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Avatar initials={initialsOf(d.producer?.first_name ?? np?.first ?? "", d.producer?.last_name ?? np?.last ?? "")} size={36} />
            <View style={{ flex: 1 }}>
              <T style={{ fontWeight: "700" }}>{who || "—"}</T>
              <T style={{ color: colors.muted, fontSize: 13 }}>
                {np && !d.producer ? "Nouveau producteur, enregistré avec la parcelle" : d.producer?.locality_text || ""}
              </T>
            </View>
          </View>
        )}
      </Section>
      <Section Icon={MapPin} title="Contour" onEdit={() => go(1)}>
        <T style={{ fontWeight: "700" }}>{d.name.trim() || "Parcelle sans nom"}</T>
        <T style={{ color: colors.muted }}>
          {d.mode === "position"
            ? `Position seule (± ${Math.round(d.position?.accuracy ?? 0)} m)`
            : `${d.points.length} points · ${formatArea(area ?? 0)} · ${d.mode === "walk" ? "tour du champ" : "coin par coin"}`}
        </T>
      </Section>
      <Section Icon={Layers} title="Foncier" onEdit={() => go(2)}>
        <T>
          {d.land.owner === "unknown"
            ? "Propriétaire non renseigné"
            : [
                d.land.owner === "other" ? `Propriétaire : ${d.land.ownerName.trim()}` : `Propriétaire : ${label(OWNERS.map((o) => [o.value, personal && o.personalLabel ? o.personalLabel : o.label] as const), d.land.owner)}`,
                label(TENURES, d.land.tenure),
                d.land.owner === "other" ? label(ARRANGEMENTS, d.land.arrangement) : "",
                d.land.owner === "other" && d.land.rent ? label(RENTS, d.land.rent) : "",
              ]
                .filter(Boolean)
                .join(" · ")}
        </T>
      </Section>
      <Section Icon={Droplets} title="Sol et eau" onEdit={() => go(3)}>
        <T style={{ color: siteFilled.length ? colors.ink : colors.muted }}>
          {siteFilled.length ? siteFilled.map(([k, v]) => labelOf(refs, k, v)).join(" · ") : "Rien de renseigné (à compléter plus tard)"}
        </T>
      </Section>
      <Section Icon={FlaskConical} title="Mesures du sol" onEdit={() => go(4)}>
        {soilParams && soilCheck.filled ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {soilParams
              .filter((p) => (d.soil.values[p.code] ?? "").trim())
              .map((p) => (
                <View key={p.code} style={[styles.measure, soilCheck.unusual[p.code] ? { backgroundColor: colors.warningBg } : null]}>
                  <T style={{ fontSize: 12, color: colors.muted }}>{p.label}</T>
                  <T mono style={{ fontSize: 15 }}>
                    {formatSoilValue(d.soil.values[p.code]!.trim(), p.unit)}
                  </T>
                </View>
              ))}
          </View>
        ) : (
          <T style={{ color: colors.muted }}>Pas de mesure (à faire plus tard depuis la fiche)</T>
        )}
      </Section>
    </StepShell>
  );
}

function Section({ Icon, title, onEdit, children }: { Icon: typeof Users; title: string; onEdit?: () => void; children: React.ReactNode }) {
  return (
    <Card style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Icon size={18} color={colors.forest} />
        <T style={{ flex: 1, fontSize: 13, fontWeight: "700", color: colors.muted, textTransform: "uppercase", letterSpacing: 0.6 }}>{title}</T>
        {onEdit ? (
          <Pressable onPress={onEdit} accessibilityRole="button" accessibilityLabel={`Modifier : ${title}`} hitSlop={8} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Pencil size={14} color={colors.forest} />
            <T style={{ color: colors.forest, fontWeight: "700", fontSize: 13 }}>Modifier</T>
          </Pressable>
        ) : null}
      </View>
      {children}
    </Card>
  );
}

const styles = StyleSheet.create({
  resumed: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: radius.md, backgroundColor: colors.brand50 },
  candidate: { flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderRadius: radius.sm, backgroundColor: colors.subtle },
  doneBadge: { width: 76, height: 76, borderRadius: 38, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  agroid: { fontSize: 26, letterSpacing: 1, color: colors.forest },
  measure: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: radius.sm, backgroundColor: colors.subtle, minWidth: "30%" },
});
