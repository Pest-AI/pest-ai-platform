import { createApiClient } from "./api";
import { API_BASE_URL, REQUEST_TIMEOUT_MS } from "./config";
import { store } from "./storage";

/** Client API unique de l'app. */
export const api = createApiClient({ baseUrl: API_BASE_URL, store, timeoutMs: REQUEST_TIMEOUT_MS });
