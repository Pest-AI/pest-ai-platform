import { Alert, Platform } from "react-native";

/** Demande de confirmation (fenêtre native ; confirm() du navigateur dans l'aperçu web). */
export function confirmAction(title: string, message: string, actionLabel: string, onConfirm: () => void) {
  if (Platform.OS === "web") {
    if (globalThis.confirm?.(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: "Annuler", style: "cancel" },
    { text: actionLabel, style: "destructive", onPress: onConfirm },
  ]);
}

/** Déconnexion toujours précédée d'une confirmation (règle du fondateur, 23/11). */
export function confirmLogout(signOut: () => Promise<void>) {
  confirmAction("Se déconnecter ?", "Vous devrez vous reconnecter pour revenir dans votre espace.", "Se déconnecter", () => {
    void signOut();
  });
}
