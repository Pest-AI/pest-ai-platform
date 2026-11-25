import { useAutoSync } from "@/lib/auto-sync";

/** Envoi automatique des saisies en attente (monté une fois, dans la session). */
export function AutoSync() {
  useAutoSync();
  return null;
}
