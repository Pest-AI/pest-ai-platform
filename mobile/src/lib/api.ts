/**
 * Client de l'API PEST AI pour l'app mobile.
 *
 * Contrairement au Web OS (BFF, ADR-0008), l'app native parle directement à l'API :
 * - jetons JWT gardés dans le stockage sécurisé du téléphone (jamais en clair) ;
 * - jeton d'accès renouvelé automatiquement sur une réponse 401, une seule fois à la fois
 *   (le jeton de rafraîchissement est à usage unique : rotation + liste noire côté API) ;
 * - délai maximal par requête : sans réponse, l'erreur est « réseau indisponible » ;
 * - en-tête X-Workspace passé explicitement pour toute route d'espace.
 */
import { apiErrorMessage } from "./errors";
import { KEYS, type KeyValueStore } from "./storage";

/** Message affiché quand l'API limite les tentatives de connexion (429). */
export const TOO_MANY_ATTEMPTS = "Trop de tentatives. Patientez une minute avant de réessayer.";

export class NetworkError extends Error {
  constructor(message = "Connexion impossible. Vérifiez votre réseau et réessayez.") {
    super(message);
    this.name = "NetworkError";
  }
}

export class SessionExpiredError extends Error {
  constructor() {
    super("Votre session a expiré. Reconnectez-vous.");
    this.name = "SessionExpiredError";
  }
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    super(apiErrorMessage(body));
    this.name = "ApiError";
  }
}

type Options = {
  method?: "GET" | "POST" | "PATCH";
  body?: unknown;
  workspace?: string | null;
  auth?: boolean;
  query?: Record<string, string | number | undefined>;
};

export type ApiClient = ReturnType<typeof createApiClient>;

export function createApiClient({
  baseUrl,
  store,
  fetchImpl = fetch,
  timeoutMs = 20_000,
}: {
  baseUrl: string;
  store: KeyValueStore;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}) {
  let refreshing: Promise<boolean> | null = null;

  async function send(path: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetchImpl(`${baseUrl}${path}`, { ...init, signal: controller.signal });
    } catch {
      throw new NetworkError();
    } finally {
      clearTimeout(timer);
    }
  }

  async function readJson(response: Response): Promise<unknown> {
    const text = await response.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  /** Renouvelle le jeton d'accès. Une seule tentative à la fois, partagée par les appels en cours. */
  function refreshTokens(): Promise<boolean> {
    if (!refreshing) {
      refreshing = (async () => {
        const refresh = await store.get(KEYS.refresh);
        if (!refresh) return false;
        const response = await send("/api/v1/auth/token/refresh/", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ refresh }),
        });
        if (!response.ok) return false;
        const tokens = (await readJson(response)) as { access?: string; refresh?: string } | null;
        if (!tokens?.access) return false;
        await store.set(KEYS.access, tokens.access);
        if (tokens.refresh) await store.set(KEYS.refresh, tokens.refresh);
        return true;
      })().finally(() => {
        refreshing = null;
      });
    }
    return refreshing;
  }

  async function clearSession() {
    await Promise.all([store.remove(KEYS.access), store.remove(KEYS.refresh), store.remove(KEYS.workspace)]);
  }

  async function request<T>(path: string, options: Options = {}, retried = false): Promise<T> {
    const { method = "GET", body, workspace, auth = true, query } = options;
    const headers: Record<string, string> = { Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (workspace) headers["X-Workspace"] = workspace;
    if (auth) {
      const access = await store.get(KEYS.access);
      if (!access) throw new SessionExpiredError();
      headers.Authorization = `Bearer ${access}`;
    }
    const search = query
      ? new URLSearchParams(
          Object.entries(query)
            .filter((entry): entry is [string, string | number] => entry[1] !== undefined && entry[1] !== "")
            .map(([k, v]) => [k, String(v)]),
        ).toString()
      : "";
    const response = await send(`${path}${search ? `?${search}` : ""}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (response.status === 401 && auth) {
      if (!retried && (await refreshTokens())) return request<T>(path, options, true);
      await clearSession();
      throw new SessionExpiredError();
    }
    const data = await readJson(response);
    if (!response.ok) throw new ApiError(response.status, data);
    return data as T;
  }

  return {
    request,
    clearSession,

    /** Connexion par numéro E.164 et mot de passe ; les jetons vont dans le stockage sécurisé. */
    async login(phoneNumber: string, password: string) {
      try {
        const tokens = await request<{ access: string; refresh: string }>("/api/v1/auth/token/", {
          method: "POST",
          auth: false,
          body: { phone_number: phoneNumber, password },
        });
        await store.set(KEYS.access, tokens.access);
        await store.set(KEYS.refresh, tokens.refresh);
      } catch (error) {
        if (error instanceof ApiError && (error.status === 400 || error.status === 401)) {
          throw new ApiError(error.status, { detail: "Numéro de téléphone ou mot de passe incorrect." });
        }
        if (error instanceof ApiError && error.status === 429) {
          throw new ApiError(429, { detail: TOO_MANY_ATTEMPTS });
        }
        throw error;
      }
    },

    /** Déconnexion : le jeton de rafraîchissement est invalidé côté API (si le réseau le permet). */
    async logout() {
      const refresh = await store.get(KEYS.refresh);
      if (refresh) {
        try {
          await request("/api/v1/auth/logout/", { method: "POST", auth: false, body: { refresh } });
        } catch {
          // Hors ligne : le jeton expirera de lui-même ; la session locale est effacée dans tous les cas.
        }
      }
      await clearSession();
    },

    async hasSession() {
      return Boolean(await store.get(KEYS.refresh));
    },

    getWorkspace: () => store.get(KEYS.workspace),
    setWorkspace: (workspace: string) => store.set(KEYS.workspace, workspace),
  };
}
