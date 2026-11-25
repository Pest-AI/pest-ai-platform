import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Check } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Chips } from "@/components/chips";
import { DateField } from "@/components/date-field";
import { Alert, Button, Card, Input, T } from "@/components/ui";
import { PLANTING_METHODS, SEED_SOURCES, todayIso } from "@/lib/agriculture";
import { ApiError, NetworkError, SessionExpiredError } from "@/lib/api";
import { api } from "@/lib/client";
import type { components } from "@/lib/schema";
import { useSession } from "@/lib/session";
import type { Paginated } from "@/lib/types";
import { colors } from "@/theme";

type S = components["schemas"];

/** Démarrer un cycle de culture sur une parcelle (J19), depuis la fiche, au champ. */
export default function NewCycleScreen() {
  const { parcelle } = useLocalSearchParams<{ parcelle: string }>();
  const { status, workspace, expire } = useSession();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [parcel, setParcel] = useState<S["ParcelDetail"] | null>(null);
  const [crops, setCrops] = useState<S["Crop"][]>([]);
  const [campaigns, setCampaigns] = useState<S["Campaign"][]>([]);
  const [crop, setCrop] = useState("");
  const [variety, setVariety] = useState("");
  const [unit, setUnit] = useState("");
  const [campaign, setCampaign] = useState("");
  const [sown, setSown] = useState<"yes" | "no" | "">("");
  const [date, setDate] = useState("");
  const [area, setArea] = useState("");
  const [seed, setSeed] = useState("");
  const [planting, setPlanting] = useState("");
  const [previous, setPrevious] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!workspace || !parcelle) return;
    Promise.all([
      api.request<S["ParcelDetail"]>(`/api/v1/parcels/${parcelle}/`, { workspace }),
      api.request<S["Crop"][]>("/api/v1/crops/", { workspace }),
      api.request<Paginated<S["Campaign"]>>("/api/v1/campaigns/", { workspace }),
    ])
      .then(([p, c, k]) => {
        setParcel(p);
        setCrops(c);
        const open = k.results.filter((x) => x.status !== "closed" && !x.is_archived);
        setCampaigns(open);
        const active = open.find((x) => x.status === "active");
        if (active) setCampaign(active.id);
      })
      .catch((e) => (e instanceof SessionExpiredError ? expire() : setError(e instanceof NetworkError ? "Pas de réseau : démarrer un cycle demande le réseau pour l'instant." : "Chargement impossible.")));
  }, [workspace, parcelle, expire]);

  const varieties = useMemo(() => crops.find((c) => c.code === crop)?.varieties ?? [], [crops, crop]);
  const units = (parcel?.units ?? []).filter((u) => u.status === "active");

  if (status !== "signedIn") return <Redirect href="/connexion" />;
  if (!workspace) return <Redirect href="/espaces" />;

  async function submit() {
    setError(null);
    setBusy(true);
    const areaValue = Number(area.replace(",", "."));
    try {
      const created = await api.request<S["CropCycleDetail"]>("/api/v1/crop-cycles/", {
        method: "POST",
        workspace,
        body: {
          parcel: parcelle,
          declared_crop: crop,
          variety: variety || null,
          cultivation_unit: unit || null,
          campaign: campaign || null,
          status: sown === "yes" ? "in_progress" : "planned",
          sowing_date: sown === "yes" && date ? date : null,
          planned_sowing_date: sown === "no" && date ? date : null,
          declared_area_m2: area.trim() && areaValue > 0 ? areaValue.toFixed(2) : null,
          seed_source: seed,
          planting_method: planting,
          previous_crop: previous && previous !== "fallow" ? previous : null,
          previous_fallow: previous === "fallow",
        },
      });
      router.replace({ pathname: "/cycles/[id]", params: { id: created.id, nouveau: "1" } });
    } catch (e) {
      if (e instanceof SessionExpiredError) return expire();
      if (e instanceof NetworkError) setError("Pas de réseau : réessayez dès que le réseau revient (vos choix restent à l'écran).");
      else if (e instanceof ApiError && e.status === 403) setError("Votre rôle ne permet pas de démarrer un cycle.");
      else setError(e instanceof ApiError ? e.message : "Une erreur est survenue.");
    } finally {
      setBusy(false);
    }
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
              Nouveau cycle de culture
            </T>
            {parcel ? (
              <T mono style={{ color: colors.muted }}>
                {parcel.agroid} · {parcel.local_name || "Parcelle"}
              </T>
            ) : null}
          </View>
        </View>
        {error ? <Alert>{error}</Alert> : null}

        <Card style={{ gap: 12 }}>
          <View style={{ gap: 6 }}>
            <T style={styles.label}>Culture</T>
            <Chips label="Culture" options={crops.map((c) => [c.code, c.name_fr] as const)} value={crop} onChange={(v) => { setCrop(v); setVariety(""); }} />
          </View>
          {varieties.length ? (
            <View style={{ gap: 6 }}>
              <T style={styles.label}>Variété (facultatif)</T>
              <Chips label="Variété" options={varieties.map((v) => [v.id, v.name] as const)} value={variety} onChange={setVariety} clearable />
            </View>
          ) : null}
          {units.length ? (
            <View style={{ gap: 6 }}>
              <T style={styles.label}>Unité de culture (facultatif)</T>
              <Chips label="Unité de culture" options={units.map((u) => [u.id, u.name ? `${u.code} · ${u.name}` : u.code] as const)} value={unit} onChange={setUnit} clearable />
            </View>
          ) : null}
          <View style={{ gap: 6 }}>
            <T style={styles.label}>Campagne</T>
            {campaigns.length ? (
              <Chips label="Campagne" options={campaigns.map((c) => [c.id, c.name] as const)} value={campaign} onChange={setCampaign} clearable />
            ) : (
              <T style={{ color: colors.muted, fontSize: 13 }}>Aucune campagne ouverte : le cycle sera enregistré hors campagne.</T>
            )}
          </View>
        </Card>

        <Card style={{ gap: 12 }}>
          <View style={{ gap: 6 }}>
            <T style={styles.label}>Le semis est-il fait ?</T>
            <Chips label="Semis fait" options={[["yes", "Oui, semé"], ["no", "Pas encore"]] as const} value={sown} onChange={setSown} />
          </View>
          {sown ? (
            <View style={{ gap: 6 }}>
              <T style={styles.label}>{sown === "yes" ? "Date de semis" : "Semis prévu le (facultatif)"}</T>
              <DateField label={sown === "yes" ? "Date de semis" : "Date de semis prévue"} value={date} onChange={setDate} max={sown === "yes" ? todayIso() : undefined} />
            </View>
          ) : null}
          <View style={{ gap: 6 }}>
            <T style={styles.label}>Surface cultivée en m² (facultatif)</T>
            <Input accessibilityLabel="Surface cultivée en m²" keyboardType="decimal-pad" placeholder="ex. 5000" value={area} onChangeText={setArea} />
          </View>
        </Card>

        <Card style={{ gap: 12 }}>
          <View style={{ gap: 6 }}>
            <T style={styles.label}>Semence</T>
            <Chips label="Semence" options={Object.entries(SEED_SOURCES) as [string, string][]} value={seed} onChange={setSeed} clearable />
          </View>
          <View style={{ gap: 6 }}>
            <T style={styles.label}>Implantation</T>
            <Chips label="Implantation" options={Object.entries(PLANTING_METHODS) as [string, string][]} value={planting} onChange={setPlanting} clearable />
          </View>
          <View style={{ gap: 6 }}>
            <T style={styles.label}>Saison précédente</T>
            <Chips label="Saison précédente" options={[["fallow", "Jachère"], ...crops.map((c) => [c.code, c.name_fr] as [string, string])]} value={previous} onChange={setPrevious} clearable />
          </View>
        </Card>

        <Button label="Enregistrer le cycle" icon={<Check size={18} color="#fff" />} disabled={!crop || !sown || (sown === "yes" && !date) || !parcel} loading={busy} onPress={submit} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({ label: { fontSize: 14, fontWeight: "700" } });
