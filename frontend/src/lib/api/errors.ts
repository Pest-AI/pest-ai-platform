/**
 * Message lisible à partir d'une réponse d'erreur de l'API (DRF) :
 * {"detail": "…"}, {"detail": ["…"]}, {"champ": ["…"]} ou ["…"].
 */
export function apiErrorMessage(body: unknown, fallback = "Une erreur est survenue. Réessayez."): string {
  const first = (value: unknown): string | null => {
    if (typeof value === "string") return value;
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = first(item);
        if (found) return found;
      }
      return null;
    }
    if (value && typeof value === "object") {
      const record = value as Record<string, unknown>;
      if ("detail" in record) return first(record.detail);
      for (const key of Object.keys(record)) {
        const found = first(record[key]);
        if (found) return found;
      }
    }
    return null;
  };
  return first(body) ?? fallback;
}
