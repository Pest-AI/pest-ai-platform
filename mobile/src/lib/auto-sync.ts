/**
 * Envoi automatique des saisies en attente : au démarrage, au retour du réseau, au retour dans
 * l'app, et toutes les 30 secondes tant qu'il reste des saisies à envoyer.
 *
 * Le retour du réseau est détecté par la connexion de l'appareil (NetInfo, événement « online »
 * du navigateur) sans attendre le test d'accès à Internet, qui peut tarder ou échouer sur
 * certains réseaux : un essai sans réseau coûte peu (échec immédiat, rien n'est perdu).
 */
import NetInfo from "@react-native-community/netinfo";
import { useEffect } from "react";
import { AppState, Platform } from "react-native";

import { api } from "./client";
import { flush, listOps } from "./outbox";
import { useSession } from "./session";

const EVERY_MS = 30_000;

export function useAutoSync() {
  const { status, expire } = useSession();

  useEffect(() => {
    if (status !== "signedIn") return;
    let alive = true;
    const run = async () => {
      if (!alive) return;
      if (!(await listOps()).some((o) => o.status === "pending")) return;
      const report = await flush(api);
      if (report.expired) await expire();
    };
    void run();
    let connected = true;
    const unsubscribeNet = NetInfo.addEventListener((state) => {
      const now = state.isConnected !== false;
      if (now && !connected) void run();
      connected = now;
    });
    const onOnline = () => void run();
    if (Platform.OS === "web" && typeof window !== "undefined") window.addEventListener("online", onOnline);
    const appState = AppState.addEventListener("change", (s) => {
      if (s === "active") void run();
    });
    const timer = setInterval(() => void run(), EVERY_MS);
    return () => {
      alive = false;
      unsubscribeNet();
      if (Platform.OS === "web" && typeof window !== "undefined") window.removeEventListener("online", onOnline);
      appState.remove();
      clearInterval(timer);
    };
  }, [status, expire]);
}
