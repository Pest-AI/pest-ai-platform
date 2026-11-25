import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SiteForm } from "@/components/site-form";
import { Alert, Button, T } from "@/components/ui";
import { ApiError, NetworkError, SessionExpiredError } from "@/lib/api";
import { api } from "@/lib/client";
import { cachedGet } from "@/lib/offline-cache";
import { isLocalRef, submit as submitOp } from "@/lib/outbox";
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
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (!workspace || !id) return;
    if (isLocalRef(id)) {
      setValues({ evidence: "observed" }); // parcelle pas encore envoyée : pas d'historique
      return;
    }
    cachedGet<{ current: SiteProfile | null }>(api, `/api/v1/parcels/${id}/site/`, { workspace })
      .then(({ data: d, offline }) => {
        setValues({ ...fromProfile(d.current), evidence: d.current?.evidence ?? "observed" });
        if (offline) setInfo("Pas de réseau : valeurs de la dernière copie du téléphone ; l'enregistrement partira au retour du réseau.");
      })
      .catch((e) => {
        if (e instanceof SessionExpiredError) return expire();
        setValues({ evidence: "observed" });
        if (e instanceof NetworkError) setInfo("Pas de réseau : l'enregistrement partira au retour du réseau.");
      });
  }, [workspace, id, expire]);

  if (status !== "signedIn") return <Redirect href="/connexion" />;
  if (!workspace) return <Redirect href="/espaces" />;

  async function save() {
    if (!values) return;
    setError(null);
    setBusy(true);
    try {
      const sent = await submitOp(api, {
        workspace: workspace as string,
        entity_type: "parcel_site",
        params: { parcel: id },
        payload: siteBody(values),
        label: `Sol et eau · ${agroid || "parcelle en attente d'envoi"}`,
      });
      if (sent.kind === "queued") {
        setInfo("Pas de réseau : gardé sur le téléphone, envoi au retour du réseau.");
        setTimeout(() => router.back(), 1200);
      } else router.back();
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
        {info ? <Alert tone="info">{info}</Alert> : null}
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
