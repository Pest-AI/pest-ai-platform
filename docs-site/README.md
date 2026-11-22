# PEST AI OS — Portail de documentation développeurs

Site de documentation pour les développeurs actuels et futurs : guides (Docusaurus) et **référence API interactive** (Scalar), générée depuis le code du backend.

## Lancer en local

```bash
cd docs-site
pnpm install
pnpm start          # http://localhost:3000
```

Ou depuis la racine du dépôt : `make docs`.

## Contenu

| Emplacement | Contenu |
|---|---|
| `docs/` | Guides en Markdown (premiers pas, authentification, espaces de travail, rôles, conventions) |
| `static/openapi.yaml` | Schéma OpenAPI de l'API, **généré** : ne pas modifier à la main |
| `docusaurus.config.js` | Configuration du site et de la référence API (`/reference`) |
| `sidebars.js` | Menu des guides |
| `src/css/custom.css` | Couleurs de la charte PEST AI |

## Mettre à jour la référence API

Après toute modification d'une route du backend, depuis la racine :

```bash
make schema       # régénère static/openapi.yaml
```

`make verifier` et la CI refusent un schéma obsolète.

## Déploiement

Vercel (J5). Voir [ADR-0006](../docs/01-architecture/adr/0006-documentation-api.md).
