import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

/** Fonds de carte de la vue d'ensemble (tuiles chargées par le navigateur). */
const MAP_TILES = ["https://server.arcgisonline.com", "https://*.basemaps.cartocdn.com"];

/**
 * Politique de sécurité du contenu (CSP). Le navigateur n'appelle jamais l'API directement
 * (ADR-0008) : connect-src reste limité au site et aux tuiles de carte.
 * - 'unsafe-inline' sur les scripts : nécessaire aux scripts d'hydratation de Next.js sans nonce ;
 *   à durcir avec des nonces (proxy) avant la production.
 * - 'unsafe-eval' uniquement en développement (rechargement à chaud).
 * - worker-src blob: : la carte (MapLibre) crée ses workers depuis un blob.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${MAP_TILES.join(" ")}`,
  "font-src 'self' data:",
  `connect-src 'self' ${MAP_TILES.join(" ")}${isDev ? " ws:" : ""}`,
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]),
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Import de parcelles : le fichier (10 Mo au plus côté API) transite par une action serveur.
  experimental: { serverActions: { bodySizeLimit: "11mb" } },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
