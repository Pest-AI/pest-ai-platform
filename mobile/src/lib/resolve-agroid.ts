/**
 * Retrouve une parcelle de l'espace actif par son AgroID (QR code scanné, saisie, lien) :
 * d'abord la copie locale (hors ligne), sinon l'API.
 */
import { NetworkError } from "./api";
import { api } from "./client";
import { loadSnapshot } from "./parcel-cache";

export type Resolved = { id: string } | { notFound: true } | { offline: true };

export async function resolveAgroid(workspace: string, agroid: string): Promise<Resolved> {
  const snapshot = await loadSnapshot(workspace);
  const cached = snapshot?.parcels.find((p) => p.agroid === agroid);
  if (cached) return { id: cached.id };
  try {
    const data = await api.request<{ results: { id: string; agroid: string | null }[] }>("/api/v1/parcels/", {
      workspace,
      query: { q: agroid },
    });
    const match = data.results.find((r) => r.agroid === agroid);
    return match ? { id: match.id } : { notFound: true };
  } catch (e) {
    if (e instanceof NetworkError) return { offline: true };
    throw e;
  }
}
