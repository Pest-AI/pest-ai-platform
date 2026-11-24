/**
 * Fonctions propres à la version navigateur (PWA) : service worker et installation.
 * Sans effet sur téléphone (app native) et en développement.
 */
import { useEffect, useState } from "react";
import { Platform } from "react-native";

const DISMISS_KEY = "pestai.install.dismissed";

/** Enregistre le service worker (version publiée uniquement) et lui confie les fichiers déjà chargés. */
export function registerServiceWorker() {
  if (Platform.OS !== "web" || __DEV__ || typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }
  const register = () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then(async () => {
        const ready = await navigator.serviceWorker.ready;
        const urls = performance
          .getEntriesByType("resource")
          .map((entry) => entry.name)
          .filter((name) => name.startsWith(location.origin) && !name.includes("/api/"));
        ready.active?.postMessage({ type: "precache", urls: [...new Set(urls)] });
      })
      .catch(() => undefined); // Sans service worker, l'app marche quand même (en ligne).
  };
  // Appelé après le montage de l'app : la page est souvent déjà chargée.
  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
}

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export type InstallState =
  | { kind: "none" }
  | { kind: "android"; install: () => Promise<void>; dismiss: () => void }
  | { kind: "ios"; dismiss: () => void };

function isStandalone() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function wasDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

/** Propose d'installer l'app : bouton sur Android (Chrome), explication sur iPhone (Safari). */
export function useInstallPrompt(): InstallState {
  const [state, setState] = useState<InstallState>({ kind: "none" });

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined" || isStandalone() || wasDismissed()) return;
    const dismiss = () => {
      try {
        localStorage.setItem(DISMISS_KEY, "1");
      } catch {
        // Stockage indisponible : la proposition reviendra, sans gravité.
      }
      setState({ kind: "none" });
    };
    const onPrompt = (event: Event) => {
      event.preventDefault();
      const deferred = event as InstallEvent;
      setState({
        kind: "android",
        dismiss,
        install: async () => {
          await deferred.prompt();
          await deferred.userChoice;
          setState({ kind: "none" });
        },
      });
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    const ua = navigator.userAgent;
    const iosSafari = /iPhone|iPad|iPod/.test(ua) && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
    if (iosSafari) setState({ kind: "ios", dismiss });
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  return state;
}
