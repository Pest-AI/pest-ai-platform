import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { Alert, Button, T } from "@/components/ui";
import { SessionExpiredError } from "@/lib/api";
import { agroidFromText } from "@/lib/qr";
import { resolveAgroid } from "@/lib/resolve-agroid";
import { useSession } from "@/lib/session";
import { colors } from "@/theme";

/** Lien d'un QR code AgroID (terrain.pestai.africa/a/PAI-SN-XXXXXXXX) : ouvre la fiche. */
export default function AgroIdLink() {
  const { agroid: raw } = useLocalSearchParams<{ agroid: string }>();
  const { status, workspace, expire } = useSession();
  const router = useRouter();
  const agroid = agroidFromText(String(raw ?? ""));
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!workspace || !agroid) return;
    resolveAgroid(workspace, agroid)
      .then((r) => {
        if ("id" in r) router.replace({ pathname: "/parcelles/[id]", params: { id: r.id } });
        else if ("offline" in r) setMessage(`Pas de réseau et ${agroid} n'est pas dans la copie locale de vos parcelles.`);
        else setMessage(`${agroid} n'est pas suivie par votre espace de travail.`);
      })
      .catch((e) => (e instanceof SessionExpiredError ? expire() : setMessage("Une erreur est survenue.")));
  }, [workspace, agroid, router, expire]);

  if (status !== "signedIn") return <Redirect href="/connexion" />;
  if (!workspace) return <Redirect href="/espaces" />;

  return (
    <View style={{ flex: 1, padding: 24, justifyContent: "center", gap: 16, backgroundColor: colors.surface }}>
      {!agroid ? (
        <Alert>Ce QR code ne contient pas d&apos;AgroID PEST AI.</Alert>
      ) : message ? (
        <Alert tone="warning">{message}</Alert>
      ) : (
        <>
          <ActivityIndicator color={colors.forest} />
          <T mono style={{ textAlign: "center" }}>
            {agroid}
          </T>
        </>
      )}
      {!agroid || message ? <Button label="Retour à l'accueil" variant="secondary" onPress={() => router.replace("/accueil")} /> : null}
    </View>
  );
}
