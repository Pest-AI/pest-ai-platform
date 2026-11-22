# 04 — DevOps

| Document | Contenu |
|---|---|
| [deploiement-staging.md](deploiement-staging.md) | Mise en ligne du staging : Render (API + PostgreSQL), Vercel (portail), sous-domaines `pestai.africa` |

Fichiers d'infrastructure : [`render.yaml`](../../render.yaml), [`infrastructure/backend/Dockerfile`](../../infrastructure/backend/Dockerfile), [`backend/entrypoint.sh`](../../backend/entrypoint.sh). Choix d'hébergement : [ADR-0003](../01-architecture/adr/0003-hebergement-render-vercel.md).

À venir : production (J28), sauvegardes, supervision (J26).
