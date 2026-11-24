/**
 * Position de l'agent, pour situer les parcelles autour de lui.
 * Navigateur (PWA) : géolocalisation du navigateur, avec l'accord de l'utilisateur.
 * Téléphone : arrive avec la capture GPS des contours (module de localisation).
 */
import { useCallback, useState } from "react";
import { Platform } from "react-native";

import type { Position } from "./geo";

export type Fix = { position: Position; accuracy: number };

export function usePosition() {
  const [fix, setFix] = useState<Fix | null>(null);
  const [error, setError] = useState<string | null>(null);
  const supported = Platform.OS === "web" && typeof navigator !== "undefined" && "geolocation" in navigator;

  const locate = useCallback(() => {
    if (!supported) {
      setError("Localisation disponible dans la version navigateur pour l'instant.");
      return;
    }
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (p) => setFix({ position: [p.coords.longitude, p.coords.latitude], accuracy: p.coords.accuracy }),
      (e) => setError(e.code === 1 ? "Autorisez la localisation dans le navigateur." : "Position introuvable."),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 },
    );
  }, [supported]);

  return { fix, error, locate, supported };
}
