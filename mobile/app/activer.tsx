import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Eye, EyeOff, KeyRound, Lock } from "lucide-react-native";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PhoneInput } from "@/components/phone-input";
import { Alert, Button, Input, T } from "@/components/ui";
import { ApiError, NetworkError } from "@/lib/api";
import { api } from "@/lib/client";
import { DEFAULT_COUNTRY, splitPhone, toInternationalPhone } from "@/lib/phone";
import { useSession } from "@/lib/session";
import { colors } from "@/theme";

const MIN_PASSWORD = 8; // même règle que l'API (MinimumLengthValidator)

/**
 * Activation du compte d'un agent créé par PEST AI : numéro, code d'activation reçu, puis mot
 * de passe choisi. L'app se connecte ensuite directement. Le lien envoyé à l'agent
 * (/activer?tel=+221…) préremplit son numéro.
 * (Le code par SMS — OTP, D-14 — s'ajoutera à cette étape plus tard.)
 */
export default function ActivationScreen() {
  const { status, signIn } = useSession();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { tel } = useLocalSearchParams<{ tel?: string }>();
  const prefill = typeof tel === "string" && /^\+\d{8,15}$/.test(tel) ? splitPhone(tel) : null;
  const [country, setCountry] = useState(prefill?.country.iso ?? DEFAULT_COUNTRY);
  const [phone, setPhone] = useState(prefill?.national ?? "");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (status === "signedIn") return <Redirect href="/" />;

  async function submit() {
    setError(null);
    const e164 = toInternationalPhone(phone, country);
    if (!e164 || !code.trim() || !password) return setError("Renseignez votre numéro, le code et un mot de passe.");
    if (password.length < MIN_PASSWORD) return setError(`Mot de passe trop court : ${MIN_PASSWORD} caractères au moins.`);
    if (password !== confirm) return setError("Les deux mots de passe ne sont pas identiques.");
    setBusy(true);
    try {
      await api.activate(e164, code, password);
      await signIn(e164, password);
    } catch (e) {
      if (e instanceof NetworkError) setError("Pas de connexion au serveur. Vérifiez votre réseau et réessayez.");
      else if (e instanceof ApiError) setError(e.message);
      else setError("Une erreur est survenue. Réessayez.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1, backgroundColor: colors.canvas, paddingTop: insets.top + 12, paddingHorizontal: 22, paddingBottom: insets.bottom + 24 }}
      >
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Retour" hitSlop={10} style={{ alignSelf: "flex-start", paddingVertical: 8 }}>
          <ArrowLeft size={24} color={colors.ink} />
        </Pressable>
        <T style={{ fontSize: 28, fontWeight: "700", marginTop: 8 }} accessibilityRole="header">
          Activer mon compte
        </T>
        <T style={{ fontSize: 15, color: colors.muted, marginTop: 6, lineHeight: 21 }}>
          Votre organisation vous a enregistré et vous a transmis un code d&apos;activation. Choisissez ensuite votre mot de passe.
        </T>

        {error ? (
          <View style={{ marginTop: 18 }}>
            <Alert>{error}</Alert>
          </View>
        ) : null}

        <View style={{ gap: 14, marginTop: 22 }}>
          <View style={{ gap: 6 }}>
            <T style={{ fontSize: 14, fontWeight: "700" }}>Numéro de téléphone</T>
            <PhoneInput country={country} onCountryChange={setCountry} value={phone} onChangeText={setPhone} />
          </View>
          <View style={{ gap: 6 }}>
            <T style={{ fontSize: 14, fontWeight: "700" }}>Code d&apos;activation</T>
            <Input
              accessibilityLabel="Code d'activation"
              icon={<KeyRound size={18} color={colors.muted} />}
              placeholder="Code reçu de votre organisation"
              autoCapitalize="characters"
              autoCorrect={false}
              autoComplete="one-time-code"
              value={code}
              onChangeText={setCode}
            />
          </View>
          <View style={{ gap: 6 }}>
            <T style={{ fontSize: 14, fontWeight: "700" }}>Nouveau mot de passe</T>
            <Input
              accessibilityLabel="Nouveau mot de passe"
              icon={<Lock size={18} color={colors.muted} />}
              placeholder={`${MIN_PASSWORD} caractères au moins`}
              secureTextEntry={!show}
              autoComplete="new-password"
              textContentType="newPassword"
              value={password}
              onChangeText={setPassword}
              end={
                <Pressable onPress={() => setShow((v) => !v)} accessibilityRole="button" accessibilityLabel={show ? "Masquer" : "Afficher"} hitSlop={10} style={{ paddingHorizontal: 14 }}>
                  {show ? <EyeOff size={20} color={colors.muted} /> : <Eye size={20} color={colors.muted} />}
                </Pressable>
              }
            />
            <Input
              accessibilityLabel="Confirmer le mot de passe"
              icon={<Lock size={18} color={colors.muted} />}
              placeholder="Confirmer le mot de passe"
              secureTextEntry={!show}
              autoComplete="new-password"
              value={confirm}
              onChangeText={setConfirm}
              returnKeyType="go"
              onSubmitEditing={submit}
            />
          </View>
          <Button label="Activer et me connecter" loading={busy} onPress={submit} style={{ marginTop: 6 }} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
