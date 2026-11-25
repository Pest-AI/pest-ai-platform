import { Alert, Platform } from "react-native";

import { listOps } from "./outbox";

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
  void listOps().then((ops) => {
    const waiting = ops.filter((o) => o.status === "pending").length;
    const note = waiting
      ? ` ${waiting} saisie${waiting > 1 ? "s" : ""} pas encore envoyée${waiting > 1 ? "s" : ""} reste${waiting > 1 ? "nt" : ""} sur ce téléphone et partira${waiting > 1 ? "ont" : ""} à votre prochaine connexion.`
      : "";
    confirmAction("Se déconnecter ?", `Vous devrez vous reconnecter pour revenir dans votre espace.${note}`, "Se déconnecter", () => {
      void signOut();
    });
  });
}
