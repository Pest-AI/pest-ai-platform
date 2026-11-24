#!/usr/bin/env node
/**
 * Aperçu local de la version publiée de l'app terrain (PWA), à l'identique de Vercel :
 * sert `dist/`, relaie `/api/…` vers l'API (même origine : le cookie de session fonctionne),
 * renvoie index.html pour les autres chemins, avec les mêmes en-têtes de sécurité.
 *
 *   npm run web:build
 *   npm run web:preview                       # API locale http://127.0.0.1:8000
 *   API_TARGET=https://api-staging.pestai.africa npm run web:preview
 *
 * Ouvrir http://localhost:4173 (ajouté par défaut aux origines autorisées en développement).
 */
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import http from "node:http";
import https from "node:https";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve(process.argv[2] ?? "dist");
const port = Number(process.env.PORT ?? 4173);
const target = new URL(process.env.API_TARGET ?? "http://127.0.0.1:8000");
const vercel = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
const securityHeaders = Object.fromEntries(
  vercel.headers
    .find((h) => h.source === "/(.*)")
    .headers.filter((h) => h.key !== "Strict-Transport-Security")
    .map((h) => [h.key, h.value]),
);
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".ttf": "font/ttf",
  ".svg": "image/svg+xml",
};

if (!existsSync(join(root, "index.html"))) {
  console.error(`Aucune version construite dans ${root} : lancez d'abord « npm run web:build ».`);
  process.exit(1);
}

http
  .createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname.startsWith("/api/")) {
      const client = target.protocol === "https:" ? https : http;
      const upstream = client.request(
        {
          protocol: target.protocol,
          hostname: target.hostname,
          port: target.port || undefined,
          path: url.pathname + url.search,
          method: req.method,
          headers: { ...req.headers, host: target.host },
        },
        (r) => {
          res.writeHead(r.statusCode ?? 502, r.headers);
          r.pipe(res);
        },
      );
      upstream.on("error", () => {
        res.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
        res.end(`API injoignable (${target.origin}).`);
      });
      req.pipe(upstream);
      return;
    }
    let file = normalize(join(root, decodeURIComponent(url.pathname)));
    if (!file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory()) {
      file = existsSync(`${file}.html`) ? `${file}.html` : join(root, "index.html");
    }
    const headers = { ...securityHeaders, "Content-Type": TYPES[extname(file)] ?? "application/octet-stream" };
    if (file.endsWith("sw.js")) headers["Cache-Control"] = "no-cache";
    res.writeHead(200, headers);
    createReadStream(file).pipe(res);
  })
  .listen(port, () => {
    console.log(`PEST AI Terrain : http://localhost:${port}  (API : ${target.origin})`);
  });
