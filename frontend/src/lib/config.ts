/** Configuration serveur du Web OS. Lue uniquement côté serveur (jamais envoyée au navigateur). */
export const API_BASE_URL = (process.env.API_BASE_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");

export const IS_PRODUCTION = process.env.NODE_ENV === "production";
