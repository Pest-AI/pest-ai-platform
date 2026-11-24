/**
 * Stockage des jetons et de l'espace actif.
 * - Téléphone : expo-secure-store (Keystore Android / Keychain iOS, chiffré par le système).
 * - Navigateur (PWA) : jeton d'accès en mémoire seulement (perdu au rechargement, puis redemandé
 *   grâce au cookie httpOnly de l'API) ; aucun jeton de renouvellement côté page ; l'espace actif,
 *   qui n'est pas un secret, en localStorage.
 */
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

export type KeyValueStore = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
};

export const KEYS = {
  access: "pestai.access",
  refresh: "pestai.refresh",
  workspace: "pestai.workspace",
} as const;

const secure: KeyValueStore = {
  get: (key) => SecureStore.getItemAsync(key),
  set: (key, value) => SecureStore.setItemAsync(key, value),
  remove: (key) => SecureStore.deleteItemAsync(key),
};

export function createWebStore(): KeyValueStore {
  const memory = new Map<string, string>();
  const persistent = (key: string) => key === KEYS.workspace;
  const local = () => {
    try {
      return globalThis.localStorage ?? null;
    } catch {
      return null; // Navigation privée ou stockage bloqué : l'espace sera redemandé.
    }
  };
  return {
    async get(key) {
      if (persistent(key)) return local()?.getItem(key) ?? null;
      return memory.get(key) ?? null;
    },
    async set(key, value) {
      if (key === KEYS.refresh) return; // Jamais dans la page : il vit dans le cookie httpOnly.
      if (persistent(key)) local()?.setItem(key, value);
      else memory.set(key, value);
    },
    async remove(key) {
      if (persistent(key)) local()?.removeItem(key);
      memory.delete(key);
    },
  };
}

export const store: KeyValueStore = Platform.OS === "web" ? createWebStore() : secure;
