import { NetworkError, SessionExpiredError, createApiClient } from "../api";
import { KEYS, createWebStore } from "../storage";

const json = (status: number, body: unknown) =>
  new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

type Call = { url: string; init: RequestInit };

/** Faux serveur : le cookie httpOnly est simulé côté « serveur », invisible du client. */
function fakeServer() {
  const calls: Call[] = [];
  let cookie: string | null = null;
  let n = 0;
  const fetchImpl = jest.fn(async (url: string, init: RequestInit = {}) => {
    calls.push({ url, init });
    if (url.endsWith("/api/v1/auth/web/token/")) {
      cookie = `R${++n}`;
      return json(200, { access: `A${n}` });
    }
    if (url.endsWith("/api/v1/auth/web/refresh/")) {
      if (!cookie) return json(401, { detail: "Aucune session." });
      cookie = `R${++n}`;
      return json(200, { access: `A${n}` });
    }
    if (url.endsWith("/api/v1/auth/web/logout/")) {
      cookie = null;
      return json(204, null);
    }
    const auth = (init.headers as Record<string, string>).Authorization;
    return auth ? json(200, { ok: true, auth }) : json(401, {});
  });
  return { fetchImpl: fetchImpl as unknown as typeof fetch, calls, hasCookie: () => cookie !== null };
}

function client(server: ReturnType<typeof fakeServer>, store = createWebStore()) {
  return { store, api: createApiClient({ baseUrl: "", store, fetchImpl: server.fetchImpl, mode: "cookie" }) };
}

/** localStorage minimal (l'environnement de test React Native n'en a pas). */
function installLocalStorage() {
  const data = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
      clear: () => data.clear(),
    },
  });
}

describe("session navigateur (cookie httpOnly)", () => {
  beforeAll(installLocalStorage);
  beforeEach(() => globalThis.localStorage.clear());

  it("se connecte par la route web et ne garde aucun jeton de renouvellement", async () => {
    const server = fakeServer();
    const { api, store } = client(server);
    await api.login("+221771234567", "secret");
    expect(server.calls[0]?.url).toBe("/api/v1/auth/web/token/");
    expect(server.calls[0]?.init.credentials).toBe("same-origin");
    expect(await store.get(KEYS.access)).toBe("A1");
    expect(await store.get(KEYS.refresh)).toBeNull();
    expect(globalThis.localStorage.getItem(KEYS.access)).toBeNull();
  });

  it("après rechargement de la page, redemande le jeton d'accès avec le cookie", async () => {
    const server = fakeServer();
    await client(server).api.login("+221771234567", "secret");
    const { api } = client(server); // nouvelle page : mémoire vide
    const res = await api.request<{ auth: string }>("/api/v1/me/");
    expect(res.auth).toBe("Bearer A2");
    const refresh = server.calls.find((c) => c.url.endsWith("/web/refresh/"));
    expect(refresh?.init.body).toBeUndefined();
  });

  it("sans cookie : session expirée", async () => {
    const { api } = client(fakeServer());
    await expect(api.request("/api/v1/me/")).rejects.toBeInstanceOf(SessionExpiredError);
  });

  it("hors ligne au démarrage : erreur réseau, pas de déconnexion", async () => {
    const fetchImpl = jest.fn(async () => {
      throw new TypeError("offline");
    }) as unknown as typeof fetch;
    const api = createApiClient({ baseUrl: "", store: createWebStore(), fetchImpl, mode: "cookie" });
    await expect(api.request("/api/v1/me/")).rejects.toBeInstanceOf(NetworkError);
  });

  it("déconnexion : route web appelée, mémoire et espace effacés", async () => {
    const server = fakeServer();
    const { api, store } = client(server);
    await api.login("+221771234567", "secret");
    await api.setWorkspace("org:1");
    await api.logout();
    expect(server.calls.at(-1)?.url).toBe("/api/v1/auth/web/logout/");
    expect(server.hasCookie()).toBe(false);
    expect(await store.get(KEYS.access)).toBeNull();
    expect(await api.getWorkspace()).toBeNull();
  });

  it("garde l'espace actif entre deux rechargements", async () => {
    const server = fakeServer();
    await client(server).api.setWorkspace("org:42");
    expect(await client(server).api.getWorkspace()).toBe("org:42");
  });
});
