import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";

import { useSession } from "@/lib/session";
import { colors } from "@/theme";

/** Aiguillage au démarrage : connexion, choix de l'espace ou accueil. */
export default function Index() {
  const { status, workspace } = useSession();
  if (status === "loading") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface }}>
        <ActivityIndicator color={colors.forest} size="large" />
      </View>
    );
  }
  if (status === "signedOut") return <Redirect href="/connexion" />;
  return <Redirect href={workspace ? "/accueil" : "/espaces"} />;
}
