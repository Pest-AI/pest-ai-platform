/**
 * Stockage des jetons et de l'espace actif.
 * - Téléphone : expo-secure-store (Keystore Android / Keychain iOS, chiffré par le système).
 * - Web (aperçu de développement uniquement) : sessionStorage, effacé à la fermeture de l'onglet.
 */
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

export type KeyValueStore = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
};

const secure: KeyValueStore = {
  get: (key) => SecureStore.getItemAsync(key),
  set: (key, value) => SecureStore.setItemAsync(key, value),
  remove: (key) => SecureStore.deleteItemAsync(key),
};

const webSession: KeyValueStore = {
  get: async (key) => globalThis.sessionStorage?.getItem(key) ?? null,
  set: async (key, value) => globalThis.sessionStorage?.setItem(key, value),
  remove: async (key) => globalThis.sessionStorage?.removeItem(key),
};

export const store: KeyValueStore = Platform.OS === "web" ? webSession : secure;

export const KEYS = {
  access: "pestai.access",
  refresh: "pestai.refresh",
  workspace: "pestai.workspace",
} as const;
