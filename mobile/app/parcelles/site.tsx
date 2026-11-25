import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SiteForm } from "@/components/site-form";
import { Alert, Button, T } from "@/components/ui";
import { ApiError, NetworkError, SessionExpiredError } from "@/lib/api";
import { api } from "@/lib/client";
import { useSession } from "@/lib/session";
import { type SiteProfile, type SiteValues, fromProfile, hasSiteData, siteBody, useSiteReferentials } from "@/lib/site";
import { colors } from "@/theme";

/**
 * Compléter le sol, l'eau et l'accès d'une parcelle (J18d). Chaque enregistrement ajoute une
 * version complète du profil ; l'historique est conservé.
 */
export default function SiteScreen() {
  const { id, agroid } = useLocalSearchParams<{ id: string; agroid?: string }>();
  const { status, workspace, expire } = useSession();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const refs = useSiteReferentials(workspace);
  const [values, setValues] = useState<SiteValues | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!workspace || !id) return;
    api
      .request<{ current: SiteProfile | null }>(`/api/v1/parcels/${id}/site/`, { workspace })
      .then((d) => setValues({ ...fromProfile(d.current), evidence: d.current?.evidence ?? "observed" }))
      .catch((e) => {
        if (e instanceof SessionExpiredError) return expire();
        setValues({ evidence: "observed" });
        setError(e instanceof NetworkError ? "Pas de réseau : la mise à jour du sol et de l'eau demande le réseau pour l'instant." : null);
      });
  }, [workspace, id, expire]);

  if (status !== "signedIn") return <Redirect href="/connexion" />;
  if (!workspace) return <Redirect href="/espaces" />;

  async function save() {
    if (!values) return;
    setError(null);
    setBusy(true);
    try {
      await api.request(`/api/v1/parcels/${id}/site/`, { method: "POST", workspace, body: siteBody(values) });
      router.back();
    } catch (e) {
      if (e instanceof SessionExpiredError) return expire();
      if (e instanceof NetworkError) setError("Pas de réseau : réessayez dès que le réseau revient (vos choix restent à l'écran).");
      else if (e instanceof ApiError && e.status === 403) setError("Votre rôle ne permet pas de modifier cette parcelle.");
      else setError(e instanceof ApiError ? e.message : "Une erreur est survenue.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        style={{ backgroundColor: colors.surface }}
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 18, paddingBottom: insets.bottom + 28, gap: 14 }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Retour" hitSlop={10} style={{ padding: 4 }}>
            <ArrowLeft size={24} color={colors.ink} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <T style={{ fontSize: 22, fontWeight: "700" }} accessibilityRole="header">
              Sol, eau et accès
            </T>
            {agroid ? (
              <T mono style={{ color: colors.muted }}>
                {agroid}
              </T>
            ) : null}
          </View>
        </View>
        <T style={{ color: colors.muted, lineHeight: 20 }}>
          Complétez ce que vous savez : « Ne sait pas » est une réponse. La version précédente reste dans l&apos;historique.
        </T>
        {error ? <Alert>{error}</Alert> : null}
        {values ? (
          <>
            <SiteForm refs={refs} values={values} onChange={setValues} defaultOpen />
            <Button label="Enregistrer" loading={busy} disabled={!hasSiteData(values)} onPress={save} />
          </>
        ) : (
          <ActivityIndicator color={colors.forest} style={{ marginTop: 24 }} />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
