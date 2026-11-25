/**
 * Stockage local de l'app (clé → texte JSON).
 *
 * - Navigateur (PWA) : IndexedDB, persistant entre deux ouvertures et sans réseau.
 * - Téléphone (app native, pas encore publiée) : en mémoire. La base SQLite native viendra
 *   avec la publication sur les stores ; d'ici là, la version terrain est la PWA.
 */
import { Platform } from "react-native";

export type BlobStore = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
  /** Clés commençant par `prefix`. */
  keys(prefix: string): Promise<string[]>;
  clear(): Promise<void>;
};

export function memoryStore(): BlobStore {
  const data = new Map<string, string>();
  return {
    get: async (k) => data.get(k) ?? null,
    set: async (k, v) => void data.set(k, v),
    remove: async (k) => void data.delete(k),
    keys: async (prefix) => [...data.keys()].filter((k) => k.startsWith(prefix)),
    clear: async () => data.clear(),
  };
}

export function indexedDbStore(name: string): BlobStore {
  const STORE = "cache";
  const open = () =>
    new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(name, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  const run = async <T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>) => {
    const db = await open();
    try {
      return await new Promise<T>((resolve, reject) => {
        const req = fn(db.transaction(STORE, mode).objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    } finally {
      db.close();
    }
  };
  return {
    get: async (k) => ((await run("readonly", (s) => s.get(k))) as string | undefined) ?? null,
    set: async (k, v) => void (await run("readwrite", (s) => s.put(v, k))),
    remove: async (k) => void (await run("readwrite", (s) => s.delete(k))),
    keys: async (prefix) =>
      ((await run("readonly", (s) => s.getAllKeys())) as IDBValidKey[])
        .map(String)
        .filter((k) => k.startsWith(prefix)),
    clear: async () => void (await run("readwrite", (s) => s.clear())),
  };
}

/** Base `name` : IndexedDB dans le navigateur, mémoire ailleurs. */
export function localStore(name: string): BlobStore {
  return Platform.OS === "web" && typeof indexedDB !== "undefined" ? indexedDbStore(name) : memoryStore();
}

/** UUID v4 tiré sur l'appareil (clé d'idempotence des saisies hors ligne). */
export function uuid4(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  const bytes = new Uint8Array(16);
  if (c?.getRandomValues) c.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const h = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
