/** Adresse de l'API (EXPO_PUBLIC_API_BASE_URL, intégrée au moment du build ; défaut : staging). */
export const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL ?? "https://api-staging.pestai.africa").replace(
  /\/+$/,
  "",
);

/** Délai maximal d'une requête : au-delà, on considère le réseau comme indisponible. */
export const REQUEST_TIMEOUT_MS = 20_000;
