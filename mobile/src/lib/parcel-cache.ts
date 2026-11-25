/**
 * Parcelles disponibles hors ligne (lecture) : l'app garde une copie des parcelles de l'espace
 * actif, prise à la dernière synchronisation, avec sa date (indicateur de fraîcheur).
 *
 * - Navigateur (PWA) : IndexedDB, base « pestai-terrain ».
 * - Téléphone : en mémoire pour l'instant (voir local-db.ts).
 * - Effacée à la déconnexion (données personnelles des exploitants).
 */
import type { ApiClient } from "./api";
import type { Bbox, MultiPolygon, Position } from "./geo";
import { localStore, memoryStore, type BlobStore } from "./local-db";

export type CachedParcel = {
  id: string;
  agroid: string | null;
  local_name: string;
  status: string;
  area_m2: string | null;
  validation_status: string | null;
  centroid: Position | null;
  operator_name: string | null;
  geometry: MultiPolygon | null;
};

export type ParcelSnapshot = {
  workspace: string;
  /** Nom de l'espace, pour l'afficher hors ligne. */
  label?: string;
  synced_at: string;
  total: number;
  /** Plus de parcelles que ce que l'app garde hors ligne (1 000). */
  truncated: boolean;
  parcels: CachedParcel[];
};

export const OFFLINE_LIMIT = 1000;
const MAX_PAGES = OFFLINE_LIMIT / 50;
const KEY_PREFIX = "parcels:";

// ── Stockage ────────────────────────────────────────────────────────────

export { memoryStore, type BlobStore };

let store: BlobStore = localStore("pestai-terrain");

/** Pour les tests. */
export function setParcelStore(next: BlobStore) {
  store = next;
}

export async function loadSnapshot(workspace: string): Promise<ParcelSnapshot | null> {
  try {
    const raw = await store.get(KEY_PREFIX + workspace);
    return raw ? (JSON.parse(raw) as ParcelSnapshot) : null;
  } catch {
    return null; // Cache illisible ou indisponible (navigation privée) : on repartira du réseau.
  }
}

export async function clearParcelCache(): Promise<void> {
  try {
    await store.clear();
  } catch {
    // Rien à effacer.
  }
}

// ── Synchronisation ─────────────────────────────────────────────────────

type Summary = { count: number; bbox: Bbox | null };
type Feature = {
  id: string;
  geometry: MultiPolygon;
  properties: { agroid: string | null; local_name: string; status: string; area_m2: string; validation_status: string };
};
type ListItem = {
  id: string;
  agroid: string | null;
  local_name: string;
  status: string;
  current_area_m2: string | null;
  centroid: Position | null;
  primary_operator: { name?: string } | null;
};
type Page = { count: number; next: string | null; results: ListItem[] };

function widen([a, b, c, d]: Bbox): Bbox {
  const padX = Math.max((c - a) * 0.05, 0.001);
  const padY = Math.max((d - b) * 0.05, 0.001);
  return [Math.max(-180, a - padX), Math.max(-90, b - padY), Math.min(180, c + padX), Math.min(90, d + padY)];
}

/** Télécharge les parcelles de l'espace (contours + liste) et les garde pour le hors-ligne. */
export async function syncParcels(
  api: ApiClient,
  workspace: string,
  now = new Date(),
  label?: string,
): Promise<ParcelSnapshot> {
  const summary = await api.request<Summary>("/api/v1/parcels/summary/", { workspace });
  const byId = new Map<string, CachedParcel>();
  if (summary.count > 0 && summary.bbox) {
    const collection = await api.request<{ features: Feature[] }>("/api/v1/parcels/map/", {
      workspace,
      query: { bbox: widen(summary.bbox).map((v) => v.toFixed(6)).join(",") },
    });
    for (const f of collection.features) {
      byId.set(f.id, {
        id: f.id,
        agroid: f.properties.agroid,
        local_name: f.properties.local_name,
        status: f.properties.status,
        area_m2: f.properties.area_m2,
        validation_status: f.properties.validation_status,
        centroid: null,
        operator_name: null,
        geometry: f.geometry,
      });
    }
  }
  let truncated = false;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const data = await api.request<Page>("/api/v1/parcels/", { workspace, query: { page } });
    for (const p of data.results) {
      if (p.status === "retired") continue;
      const known = byId.get(p.id);
      byId.set(p.id, {
        id: p.id,
        agroid: p.agroid,
        local_name: p.local_name,
        status: p.status,
        area_m2: p.current_area_m2 ?? known?.area_m2 ?? null,
        validation_status: known?.validation_status ?? null,
        centroid: p.centroid,
        operator_name: p.primary_operator?.name ?? null,
        geometry: known?.geometry ?? null,
      });
    }
    if (!data.next) break;
    if (page === MAX_PAGES) truncated = true;
  }
  const snapshot: ParcelSnapshot = {
    workspace,
    label,
    synced_at: now.toISOString(),
    total: summary.count,
    truncated,
    parcels: [...byId.values()]
      .filter((p) => p.status !== "retired")
      .sort((a, b) => (a.agroid ?? "~").localeCompare(b.agroid ?? "~")),
  };
  try {
    await store.set(KEY_PREFIX + workspace, JSON.stringify(snapshot));
  } catch {
    // Stockage plein ou refusé : la copie reste en mémoire pour cette session.
  }
  return snapshot;
}

/** « à l'instant », « il y a 12 min », « il y a 3 h », « le 24/11 à 14:05 ». */
export function freshness(iso: string, now = new Date()): string {
  const then = new Date(iso);
  const minutes = Math.floor((now.getTime() - then.getTime()) / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  if (minutes < 24 * 60) return `il y a ${Math.floor(minutes / 60)} h`;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `le ${pad(then.getDate())}/${pad(then.getMonth() + 1)} à ${pad(then.getHours())}:${pad(then.getMinutes())}`;
}

/** Données à rafraîchir si elles ont plus de 10 minutes. */
export function isStale(iso: string, now = new Date()): boolean {
  return now.getTime() - new Date(iso).getTime() > 10 * 60_000;
}
