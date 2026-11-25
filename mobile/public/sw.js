/*
 * Service worker de PEST AI Terrain (PWA).
 * - Écrans et fichiers de l'app gardés en cache : l'app s'ouvre même sans réseau.
 * - Les appels à l'API (/api/…) ne passent JAMAIS par le cache : données et session toujours
 *   fraîches, rien de personnel stocké ici.
 * - Pages : réseau d'abord (mise à jour immédiate), cache si hors ligne.
 * - Fichiers versionnés (/_expo/, /assets/) : cache d'abord (leur nom change à chaque version).
 * - Tous les écrans (un fichier par écran, liste « precache.json » écrite au build) sont
 *   téléchargés dès la première visite : un écran jamais ouvert s'ouvre aussi hors ligne.
 */
const VERSION = "terrain-v2";
const SHELL = ["/", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function networkFirstPage(request) {
  try {
    const response = await fetch(request);
    if (response.ok) (await caches.open(VERSION)).put("/", response.clone());
    return response;
  } catch {
    return (await caches.match("/")) || Response.error();
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) (await caches.open(VERSION)).put(request, response.clone());
  return response;
}

// Au premier chargement, le service worker n'existait pas encore : la page lui envoie la liste
// des fichiers déjà téléchargés pour qu'ils soient disponibles hors ligne dès la visite suivante.
self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type !== "precache" || !Array.isArray(data.urls)) return;
  const urls = data.urls.filter((u) => {
    try {
      const url = new URL(u, self.location.origin);
      return url.origin === self.location.origin && !url.pathname.startsWith("/api/");
    } catch {
      return false;
    }
  });
  event.waitUntil(
    caches
      .open(VERSION)
      .then(async (cache) => {
        await cache.addAll(urls).catch(() => undefined);
        // Tous les écrans de cette version (absent en développement : rien à faire).
        const response = await fetch("/precache.json", { cache: "no-store" }).catch(() => null);
        if (!response || !response.ok) return;
        const screens = (await response.json()).filter((u) => typeof u === "string" && u.startsWith("/_expo/"));
        const missing = [];
        for (const u of screens) if (!(await cache.match(u))) missing.push(u);
        await cache.addAll(missing);
      })
      .catch(() => undefined),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // tuiles, polices externes : navigateur
  if (url.pathname.startsWith("/api/")) return; // API : jamais en cache
  if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(request));
    return;
  }
  if (url.pathname.startsWith("/_expo/") || url.pathname.startsWith("/assets/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(cacheFirst(request));
  }
});
