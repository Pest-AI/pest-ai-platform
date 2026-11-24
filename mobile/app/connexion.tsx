import { Image } from "expo-image";
import { Redirect, useRouter } from "expo-router";
import { ChevronRight, Eye, EyeOff, Lock, Mail } from "lucide-react-native";
import { useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PhoneInput } from "@/components/phone-input";
import { Alert, Button, Input, type InputRef, T } from "@/components/ui";
import { ApiError, NetworkError } from "@/lib/api";
import { DEFAULT_COUNTRY, toInternationalPhone } from "@/lib/phone";
import { useSession } from "@/lib/session";
import { colors, radius } from "@/theme";

/** Connexion : photo de terrain en haut, logo PEST AI, formulaire sur une feuille blanche. */
export default function LoginScreen() {
  const { status, signIn } = useSession();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const router = useRouter();
  const [country, setCountry] = useState(DEFAULT_COUNTRY);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const passwordRef = useRef<InputRef>(null);

  if (status === "signedIn") return <Redirect href="/" />;

  async function submit() {
    setError(null);
    const e164 = toInternationalPhone(phone, country);
    if (!e164 || !password) {
      setError("Renseignez votre numéro et votre mot de passe.");
      return;
    }
    setBusy(true);
    try {
      await signIn(e164, password);
    } catch (e) {
      if (e instanceof NetworkError) setError("Pas de connexion au serveur. Vérifiez votre réseau et réessayez.");
      else if (e instanceof ApiError) setError(e.message);
      else setError("Une erreur est survenue. Réessayez.");
    } finally {
      setBusy(false);
    }
  }

  const heroHeight = Math.max(260, Math.round(height * 0.42));

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, backgroundColor: colors.canvas }}>
        <View style={{ height: heroHeight }}>
          <Image
            source={require("../assets/brand/connexion-champ.jpg")}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            contentPosition={{ left: "72%", top: "50%" }}
            accessibilityLabel="Agriculteur consultant la carte de ses parcelles sur une tablette"
          />
          <View style={[StyleSheet.absoluteFill, styles.heroShade]} />
          <View style={[styles.logoChip, { top: insets.top + 14 }]}>
            <Image source={require("../assets/brand/pest-ai-logo.png")} style={styles.logo} contentFit="contain" accessibilityLabel="PEST AI" />
          </View>
          <View style={styles.headline}>
            <T style={styles.headlineText}>
              Une agriculture plus <T style={[styles.headlineText, { color: colors.gold }]}>intelligente</T> pour l&apos;Afrique
            </T>
          </View>
        </View>

        <View style={[styles.sheet, { paddingBottom: insets.bottom + 24 }]}>
          <T style={styles.title} accessibilityRole="header">
            Connexion
          </T>
          <T style={styles.subtitle}>Accédez à votre espace PEST AI OS</T>

          {error ? (
            <View style={{ marginTop: 18 }}>
              <Alert>{error}</Alert>
            </View>
          ) : null}

          <View style={{ gap: 12, marginTop: 22 }}>
            <PhoneInput
              country={country}
              onCountryChange={setCountry}
              value={phone}
              onChangeText={setPhone}
              onSubmitEditing={() => passwordRef.current?.focus()}
            />
            <Input
              ref={passwordRef}
              accessibilityLabel="Mot de passe"
              icon={<Lock size={18} color={colors.muted} />}
              placeholder="Mot de passe"
              secureTextEntry={!showPassword}
              autoComplete="current-password"
              textContentType="password"
              value={password}
              onChangeText={setPassword}
              returnKeyType="go"
              onSubmitEditing={submit}
              end={
                <Pressable
                  onPress={() => setShowPassword((v) => !v)}
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  hitSlop={10}
                  style={{ paddingHorizontal: 14 }}
                >
                  {showPassword ? <EyeOff size={20} color={colors.muted} /> : <Eye size={20} color={colors.muted} />}
                </Pressable>
              }
            />
            <Button
              label="Se connecter"
              loading={busy}
              onPress={submit}
              style={{ marginTop: 6 }}
            />
          </View>

          <View style={styles.divider}>
            <View style={styles.rule} />
            <T style={{ color: colors.muted, fontSize: 13 }}>ou</T>
            <View style={styles.rule} />
          </View>

          <Pressable
            onPress={() => router.push("/activer")}
            accessibilityRole="button"
            style={({ pressed }) => [styles.invite, pressed && { opacity: 0.8 }]}
          >
            <Mail size={22} color={colors.forest} />
            <View style={{ flex: 1 }}>
              <T style={{ fontSize: 15, fontWeight: "700" }}>Vous avez reçu un code d&apos;invitation ?</T>
              <T style={{ fontSize: 13, color: colors.muted, marginTop: 2, lineHeight: 18 }}>
                Activez votre compte avec le code transmis par votre organisation.
              </T>
            </View>
            <ChevronRight size={18} color={colors.muted} />
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  heroShade: { backgroundColor: "rgba(10,38,22,0.25)" },
  logoChip: {
    position: "absolute",
    left: 20,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 18,
    padding: 8,
  },
  logo: { width: 64, height: 74 },
  headline: { position: "absolute", left: 22, right: 22, bottom: 46 },
  headlineText: {
    color: "#fff",
    fontSize: 27,
    lineHeight: 33,
    fontWeight: "700",
    textShadowColor: "rgba(0,0,0,0.35)",
    textShadowRadius: 12,
  },
  sheet: {
    flex: 1,
    marginTop: -28,
    backgroundColor: colors.canvas,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: 22,
    paddingTop: 28,
  },
  title: { fontSize: 30, fontWeight: "700", textAlign: "center" },
  subtitle: { fontSize: 15, color: colors.muted, textAlign: "center", marginTop: 4 },
  divider: { flexDirection: "row", alignItems: "center", gap: 14, marginVertical: 22 },
  rule: { flex: 1, height: 1, backgroundColor: colors.line },
  invite: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.brand50,
    borderLeftWidth: 4,
    borderLeftColor: colors.leaf,
    borderRadius: radius.md,
    padding: 14,
  },
});
