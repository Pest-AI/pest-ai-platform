import { Redirect, useRouter } from "expo-router";
import { ArrowLeft, Link2, UserPlus } from "lucide-react-native";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PhoneInput } from "@/components/phone-input";
import { Alert, Button, Card, Input, T } from "@/components/ui";
import { ApiError, NetworkError, SessionExpiredError } from "@/lib/api";
import { api } from "@/lib/client";
import { LANGUAGE_LABELS, SEX_LABELS } from "@/lib/labels";
import { DEFAULT_COUNTRY, toInternationalPhone } from "@/lib/phone";
import { useSession } from "@/lib/session";
import type { Producer } from "@/lib/types";
import { colors, radius } from "@/theme";

type Candidate = {
  id: string;
  display_name: string;
  locality: string;
  phone_hint: string;
  in_organization: boolean;
  can_attach: boolean;
};

function Choice({ options, value, onChange }: { options: [string, string][]; value: string; onChange: (v: string) => void }) {
  return (
    <View style={{ flexDirection: "row", gap: 8 }}>
      {options.map(([v, label]) => (
        <Pressable
          key={v}
          onPress={() => onChange(v)}
          accessibilityRole="radio"
          accessibilityState={{ checked: value === v }}
          style={[styles.choice, value === v && styles.choiceOn]}
        >
          <T style={{ fontSize: 15, fontWeight: value === v ? "700" : "400", color: value === v ? colors.forest : colors.ink }}>{label}</T>
        </Pressable>
      ))}
    </View>
  );
}

/**
 * Enrôlement d'un producteur par l'agent (cas A : rattaché à l'organisation de l'espace).
 * Doublon probable (D-28) : l'agent choisit de rattacher la fiche existante ou de créer quand même.
 */
export default function NewProducerScreen() {
  const { status, workspace, expire } = useSession();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [sex, setSex] = useState("unspecified");
  const [year, setYear] = useState("");
  const [locality, setLocality] = useState("");
  const [country, setCountry] = useState(DEFAULT_COUNTRY);
  const [phone, setPhone] = useState("");
  const [membership, setMembership] = useState("");
  const [language, setLanguage] = useState("fr");
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (status !== "signedIn") return <Redirect href="/connexion" />;
  if (!workspace) return <Redirect href="/espaces" />;

  async function fail(e: unknown) {
    if (e instanceof SessionExpiredError) return expire();
    if (e instanceof NetworkError) return setError("Pas de réseau : l'enrôlement hors ligne arrive bientôt. Réessayez avec du réseau.");
    if (e instanceof ApiError && e.status === 403) return setError("Votre rôle ne permet pas d'enregistrer un producteur.");
    setError(e instanceof ApiError ? e.message : "Une erreur est survenue.");
  }

  async function submit(confirmNew = false) {
    setError(null);
    if (!first.trim() || !last.trim()) return setError("Indiquez le prénom et le nom.");
    const birthYear = year.trim() ? Number(year) : null;
    if (birthYear !== null && (!Number.isInteger(birthYear) || birthYear < 1900 || birthYear > new Date().getFullYear())) {
      return setError("Année de naissance invalide (ex. 1985).");
    }
    setBusy(true);
    try {
      const created = await api.request<Producer>("/api/v1/producers/", {
        method: "POST",
        workspace,
        body: {
          first_name: first.trim(),
          last_name: last.trim(),
          sex,
          birth_year: birthYear,
          locality_text: locality.trim(),
          preferred_language: language,
          phone_number: phone.trim() ? toInternationalPhone(phone, country) : "",
          relationship_type: "member",
          membership_number: membership.trim(),
          confirm_new: confirmNew,
        },
      });
      router.replace({ pathname: "/producteurs/[id]", params: { id: created.id, nouveau: "1" } });
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setCandidates(((e.body as { candidates?: Candidate[] }) ?? {}).candidates ?? []);
      } else {
        await fail(e);
      }
    } finally {
      setBusy(false);
    }
  }

  async function attach(candidate: Candidate) {
    setBusy(true);
    setError(null);
    try {
      await api.request("/api/v1/producers/attach/", {
        method: "POST",
        workspace,
        body: { producer_id: candidate.id, relationship_type: "member", membership_number: membership.trim() },
      });
      router.replace({ pathname: "/producteurs/[id]", params: { id: candidate.id } });
    } catch (e) {
      await fail(e);
    } finally {
      setBusy(false);
    }
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
            Nouveau producteur
          </T>
        </View>

        {error ? <Alert>{error}</Alert> : null}

        {candidates ? (
          <Card style={{ gap: 12 }}>
            <T style={{ fontSize: 16, fontWeight: "700" }}>Ce producteur existe peut-être déjà</T>
            <T style={{ color: colors.muted, lineHeight: 20 }}>
              Même téléphone, ou même nom dans la même localité. Vérifiez avec lui avant de créer une nouvelle fiche.
            </T>
            {candidates.map((c) => (
              <View key={c.id} style={styles.candidate}>
                <View style={{ flex: 1 }}>
                  <T style={{ fontWeight: "700" }}>{c.display_name}</T>
                  <T style={{ color: colors.muted, fontSize: 13 }}>
                    {[c.locality, c.phone_hint ? `tél. …${c.phone_hint}` : ""].filter(Boolean).join(" · ") || "Localité non renseignée"}
                  </T>
                </View>
                {c.in_organization ? (
                  <T style={{ color: colors.success, fontSize: 13, fontWeight: "700" }}>Déjà chez vous</T>
                ) : c.can_attach ? (
                  <Button label="Rattacher" variant="secondary" icon={<Link2 size={16} color={colors.forest} />} onPress={() => attach(c)} loading={busy} />
                ) : null}
              </View>
            ))}
            <Button label="Ce n'est pas lui : créer une nouvelle fiche" variant="secondary" onPress={() => submit(true)} loading={busy} />
          </Card>
        ) : null}

        <Card style={{ gap: 14 }}>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1, gap: 6 }}>
              <T style={styles.label}>Prénom</T>
              <Input accessibilityLabel="Prénom" value={first} onChangeText={setFirst} autoCapitalize="words" />
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <T style={styles.label}>Nom</T>
              <Input accessibilityLabel="Nom" value={last} onChangeText={setLast} autoCapitalize="words" />
            </View>
          </View>
          <View style={{ gap: 6 }}>
            <T style={styles.label}>Sexe</T>
            <Choice options={Object.entries(SEX_LABELS)} value={sex} onChange={setSex} />
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1, gap: 6 }}>
              <T style={styles.label}>Année de naissance</T>
              <Input accessibilityLabel="Année de naissance" value={year} onChangeText={setYear} keyboardType="number-pad" maxLength={4} placeholder="ex. 1985" />
            </View>
            <View style={{ flex: 1.3, gap: 6 }}>
              <T style={styles.label}>Village</T>
              <Input accessibilityLabel="Village ou localité" value={locality} onChangeText={setLocality} placeholder="ex. Guédé" />
            </View>
          </View>
          <View style={{ gap: 6 }}>
            <T style={styles.label}>Téléphone (facultatif)</T>
            <PhoneInput country={country} onCountryChange={setCountry} value={phone} onChangeText={setPhone} />
          </View>
          <View style={{ gap: 6 }}>
            <T style={styles.label}>N° d&apos;adhérent (facultatif)</T>
            <Input accessibilityLabel="Numéro d'adhérent" value={membership} onChangeText={setMembership} autoCapitalize="characters" />
          </View>
          <View style={{ gap: 6 }}>
            <T style={styles.label}>Langue préférée</T>
            <Choice options={Object.entries(LANGUAGE_LABELS)} value={language} onChange={setLanguage} />
          </View>
        </Card>

        {!candidates ? (
          <Button label="Enregistrer le producteur" icon={<UserPlus size={18} color="#fff" />} loading={busy} onPress={() => submit(false)} />
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 14, fontWeight: "700" },
  choice: {
    flex: 1,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.canvas,
  },
  choiceOn: { borderColor: colors.forest, backgroundColor: colors.brand50 },
  candidate: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.line },
});
