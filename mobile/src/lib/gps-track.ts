/**
 * Relevé GPS d'un contour de parcelle (J18).
 *
 * Deux façons de faire, comme sur le terrain :
 * - « tour du champ » (gps_walk) : l'agent marche le long de la limite, un point est gardé
 *   tous les MIN_STEP_M mètres ;
 * - « coin par coin » (gps_points) : l'agent s'arrête à chaque coin et ajoute le point.
 *
 * Seules les positions assez précises (≤ MAX_ACCURACY_M) sont gardées. La précision
 * envoyée à l'API est la médiane des points (D-19 : au-delà de 10 m, contour signalé).
 * Version navigateur (PWA) : géolocalisation du navigateur. Application native : avec le
 * module de localisation d'Expo, à la publication sur les stores.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

import { type Position, distanceM } from "./geo";

export const MAX_ACCURACY_M = 25;
export const MIN_STEP_M = 3;
export const CLOSE_GAP_M = 30;

export type Fix = { position: Position; accuracy: number; at: number };

/** Ajoute une position au tracé si elle est assez précise et assez loin du dernier point. */
export function acceptFix(points: Fix[], fix: Fix, mode: "walk" | "corners"): Fix[] {
  if (fix.accuracy > MAX_ACCURACY_M) return points;
  const last = points[points.length - 1];
  if (mode === "walk" && last && distanceM(last.position, fix.position) < MIN_STEP_M) return points;
  return [...points, fix];
}

/** Surface approchée en m² d'un anneau (projection locale) : affichage seulement. */
export function ringAreaM2(ring: Position[]): number {
  if (ring.length < 3) return 0;
  const lat0 = (ring.reduce((s, p) => s + p[1], 0) / ring.length) * (Math.PI / 180);
  const mx = 111_320 * Math.cos(lat0);
  const my = 110_540;
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i] as Position;
    const b = ring[(i + 1) % ring.length] as Position;
    sum += a[0] * mx * (b[1] * my) - b[0] * mx * (a[1] * my);
  }
  return Math.abs(sum) / 2;
}

export function perimeterM(ring: Position[], closed = true): number {
  let total = 0;
  for (let i = 1; i < ring.length; i++) total += distanceM(ring[i - 1] as Position, ring[i] as Position);
  if (closed && ring.length > 2) total += distanceM(ring[ring.length - 1] as Position, ring[0] as Position);
  return total;
}

/** Écart entre le dernier point et le premier : le tour est-il revenu au départ ? */
export function closingGapM(ring: Position[]): number | null {
  if (ring.length < 3) return null;
  return distanceM(ring[ring.length - 1] as Position, ring[0] as Position);
}

export function medianAccuracy(points: Fix[]): number | null {
  if (!points.length) return null;
  const sorted = points.map((p) => p.accuracy).sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const value = sorted.length % 2 ? (sorted[mid] as number) : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
  return Math.round(value * 10) / 10;
}

/** Polygone GeoJSON fermé, prêt pour l'API. */
export function toPolygon(points: Fix[]): { type: "Polygon"; coordinates: Position[][] } {
  const ring = points.map((p) => p.position);
  const first = ring[0] as Position;
  return { type: "Polygon", coordinates: [[...ring, first]] };
}

export function accuracyTone(accuracy: number | null): "good" | "fair" | "poor" | "none" {
  if (accuracy === null) return "none";
  if (accuracy <= 5) return "good";
  if (accuracy <= 10) return "fair";
  return "poor";
}

/** Suivi de la position (navigateur) : dernière position connue, erreurs, disponibilité. */
export function useLiveFix(active: boolean) {
  const supported = Platform.OS === "web" && typeof navigator !== "undefined" && "geolocation" in navigator;
  const [fix, setFix] = useState<Fix | null>(null);
  const [error, setError] = useState<string | null>(null);
  const watch = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (watch.current !== null && supported) navigator.geolocation.clearWatch(watch.current);
    watch.current = null;
  }, [supported]);

  useEffect(() => {
    if (!active || !supported) return stop;
    setError(null);
    watch.current = navigator.geolocation.watchPosition(
      (p) => {
        setError(null);
        setFix({ position: [p.coords.longitude, p.coords.latitude], accuracy: p.coords.accuracy, at: p.timestamp });
      },
      (e) =>
        setError(
          e.code === 1
            ? "Autorisez la localisation pour relever le contour (réglages du navigateur)."
            : "Signal GPS introuvable : placez-vous à découvert et patientez.",
        ),
      { enableHighAccuracy: true, maximumAge: 0 },
    );
    return stop;
  }, [active, supported, stop]);

  return { fix, error, supported };
}
