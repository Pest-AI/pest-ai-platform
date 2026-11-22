# PEST AI OS — Infrastructure

Contiendra la configuration de déploiement :

- `Dockerfile` du backend (image avec GDAL ≥ 3.9 pour GeoDjango)
- `render.yaml` : service web, worker Celery, PostgreSQL + PostGIS, Redis (Render Key Value)
- scripts d'exploitation (sauvegardes, vérifications)

Choix d'hébergement : [ADR-0003](../docs/01-architecture/adr/0003-hebergement-render-vercel.md). Le contenu arrive au **J5** du planning.
