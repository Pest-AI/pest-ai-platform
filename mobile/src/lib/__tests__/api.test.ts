import { ApiError, NetworkError, SessionExpiredError, TOO_MANY_ATTEMPTS, createApiClient } from "../api";
import { KEYS, type KeyValueStore } from "../storage";

function memoryStore(initial: Record<string, string> = {}): KeyValueStore & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    get: async (k) => data[k] ?? null,
    set: async (k, v) => {
      data[k] = v;
    },
    remove: async (k) => {
      delete data[k];
    },
  };
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("client API mobile", () => {
  it("connecte et range les jetons dans le stockage sécurisé", async () => {
    const store = memoryStore();
    const fetchImpl = jest.fn(async () => json(200, { access: "A1", refresh: "R1" }));
    const api = createApiClient({ baseUrl: "https://api.test", store, fetchImpl });
    await api.login("+221771234567", "secret");
    expect(store.data[KEYS.access]).toBe("A1");
    expect(store.data[KEYS.refresh]).toBe("R1");
  });

  it("traduit un refus de connexion en message clair", async () => {
    const api = createApiClient({
      baseUrl: "https://api.test",
      store: memoryStore(),
      fetchImpl: async () => json(401, { detail: "No active account" }),
    });
    await expect(api.login("+221771234567", "x")).rejects.toThrow("Numéro de téléphone ou mot de passe incorrect.");
  });

  it("explique la limite de tentatives (429)", async () => {
    const api = createApiClient({
      baseUrl: "https://api.test",
      store: memoryStore(),
      fetchImpl: async () => json(429, { detail: "Request was throttled." }),
    });
    await expect(api.login("+221771234567", "x")).rejects.toThrow(TOO_MANY_ATTEMPTS);
  });

  it("envoie X-Workspace et le jeton d'accès", async () => {
    const store = memoryStore({ [KEYS.access]: "A1", [KEYS.refresh]: "R1" });
    const fetchImpl = jest.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => json(200, { ok: true }));
    const api = createApiClient({ baseUrl: "https://api.test", store, fetchImpl });
    await api.request("/api/v1/producers/", { workspace: "org:123", query: { q: "Ba", page: 2 } });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toBe("https://api.test/api/v1/producers/?q=Ba&page=2");
    expect((init?.headers as Record<string, string>)["X-Workspace"]).toBe("org:123");
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer A1");
  });

  it("renouvelle le jeton une seule fois pour des appels simultanés", async () => {
    const store = memoryStore({ [KEYS.access]: "OLD", [KEYS.refresh]: "R1" });
    let refreshCalls = 0;
    const fetchImpl = jest.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      if (String(url).endsWith("/auth/token/refresh/")) {
        refreshCalls += 1;
        return json(200, { access: "NEW", refresh: "R2" });
      }
      const auth = (init?.headers as Record<string, string>).Authorization;
      return auth === "Bearer NEW" ? json(200, { ok: true }) : json(401, { detail: "expired" });
    });
    const api = createApiClient({ baseUrl: "https://api.test", store, fetchImpl });
    await Promise.all([api.request("/a/"), api.request("/b/"), api.request("/c/")]);
    expect(refreshCalls).toBe(1);
    expect(store.data[KEYS.refresh]).toBe("R2");
  });

  it("efface la session si le renouvellement échoue", async () => {
    const store = memoryStore({ [KEYS.access]: "OLD", [KEYS.refresh]: "R1", [KEYS.workspace]: "org:1" });
    const api = createApiClient({ baseUrl: "https://api.test", store, fetchImpl: async () => json(401, {}) });
    await expect(api.request("/a/")).rejects.toBeInstanceOf(SessionExpiredError);
    expect(store.data).toEqual({});
  });

  it("signale l'absence de réseau", async () => {
    const store = memoryStore({ [KEYS.access]: "A1" });
    const api = createApiClient({
      baseUrl: "https://api.test",
      store,
      fetchImpl: async () => {
        throw new TypeError("Network request failed");
      },
    });
    await expect(api.request("/a/")).rejects.toBeInstanceOf(NetworkError);
  });

  it("abandonne une requête trop longue", async () => {
    const store = memoryStore({ [KEYS.access]: "A1" });
    const fetchImpl = (_url: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
      });
    const api = createApiClient({ baseUrl: "https://api.test", store, fetchImpl, timeoutMs: 20 });
    await expect(api.request("/lent/")).rejects.toBeInstanceOf(NetworkError);
  });

  it("remonte le message d'erreur de l'API", async () => {
    const api = createApiClient({
      baseUrl: "https://api.test",
      store: memoryStore({ [KEYS.access]: "A1" }),
      fetchImpl: async () => json(403, { detail: "Accès refusé." }),
    });
    await expect(api.request("/a/")).rejects.toEqual(expect.any(ApiError));
    await expect(api.request("/a/")).rejects.toThrow("Accès refusé.");
  });

  it("se déconnecte même hors ligne", async () => {
    const store = memoryStore({ [KEYS.access]: "A1", [KEYS.refresh]: "R1" });
    const api = createApiClient({
      baseUrl: "https://api.test",
      store,
      fetchImpl: async () => {
        throw new TypeError("offline");
      },
    });
    await api.logout();
    expect(store.data).toEqual({});
  });
});
