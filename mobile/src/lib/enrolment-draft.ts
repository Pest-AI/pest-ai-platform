/**
 * Brouillon de l'enrôlement en cours, gardé sur le téléphone à chaque changement : un appel,
 * une batterie vide ou une fausse manœuvre ne font pas perdre un relevé de contour.
 * Un brouillon par espace ; effacé quand la parcelle est enregistrée ou abandonnée.
 */
import { localStore, type BlobStore } from "./local-db";

let store: BlobStore = localStore("pestai-brouillons");

/** Pour les tests. */
export function setDraftStore(next: BlobStore) {
  store = next;
}

export type DraftMeta = { step: number; saved_at: string; label: string };

const key = (workspace: string) => `enrolement:${workspace}`;

export async function loadDraft<T>(workspace: string): Promise<(T & { meta: DraftMeta }) | null> {
  const raw = await store.get(key(workspace)).catch(() => null);
  return raw ? (JSON.parse(raw) as T & { meta: DraftMeta }) : null;
}

export async function saveDraft<T extends object>(workspace: string, draft: T, meta: DraftMeta) {
  await store.set(key(workspace), JSON.stringify({ ...draft, meta })).catch(() => undefined);
}

export async function clearDraft(workspace: string) {
  await store.remove(key(workspace)).catch(() => undefined);
}
