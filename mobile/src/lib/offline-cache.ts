/**
 * Lectures disponibles sans réseau : la dernière réponse de chaque lecture utile au terrain
 * (référentiels, producteurs, fiches parcelle et cycle) est gardée sur le téléphone.
 * Effacée à la déconnexion avec le reste du cache (`clearParcelCache`).
 */
import { NetworkError, type ApiClient } from "./api";
import { localStore, type BlobStore } from "./local-db";

let store: BlobStore = localStore("pestai-terrain");
const PREFIX = "get:";

/** Pour les tests. */
export function setOfflineStore(next: BlobStore) {
  store = next;
}

type Entry<T> = { saved_at: string; data: T };
export type Cached<T> = { data: T; offline: boolean; savedAt: string };

function key(workspace: string | null | undefined, path: string, query?: Record<string, string | number | undefined>) {
  const q = query
    ? Object.entries(query)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}=${v}`)
        .join("&")
    : "";
  return `${PREFIX}${workspace ?? "-"}:${path}?${q}`;
}

/** Lecture réseau gardée en copie ; sans réseau, la dernière copie (sinon NetworkError). */
export async function cachedGet<T>(
  api: ApiClient,
  path: string,
  options: { workspace?: string | null; query?: Record<string, string | number | undefined> } = {},
): Promise<Cached<T>> {
  const k = key(options.workspace, path, options.query);
  try {
    const data = await api.request<T>(path, options);
    const savedAt = new Date().toISOString();
    store.set(k, JSON.stringify({ saved_at: savedAt, data } satisfies Entry<T>)).catch(() => undefined);
    return { data, offline: false, savedAt };
  } catch (e) {
    if (!(e instanceof NetworkError)) throw e;
    const raw = await store.get(k).catch(() => null);
    if (!raw) throw e;
    const entry = JSON.parse(raw) as Entry<T>;
    return { data: entry.data, offline: true, savedAt: entry.saved_at };
  }
}

/** Dernière copie seulement (sans appel réseau). */
export async function cachedOnly<T>(
  path: string,
  options: { workspace?: string | null; query?: Record<string, string | number | undefined> } = {},
): Promise<T | null> {
  const raw = await store.get(key(options.workspace, path, options.query)).catch(() => null);
  return raw ? (JSON.parse(raw) as Entry<T>).data : null;
}

/** Copie écrite directement (listes assemblées par l'app). */
export async function putCached<T>(workspace: string | null, path: string, data: T): Promise<void> {
  const entry: Entry<T> = { saved_at: new Date().toISOString(), data };
  await store.set(key(workspace, path), JSON.stringify(entry)).catch(() => undefined);
}
