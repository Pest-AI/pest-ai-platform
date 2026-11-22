# 0003 — Hébergement : Render (Docker) et Vercel, fichiers sur Cloudflare R2

- **Statut :** Accepté
- **Date :** 22/11/2026
- **Décideurs :** Thierno Bocar Dieng (CEO)

## Contexte

Il faut héberger l'API, la base PostGIS, un worker asynchrone, le Web OS et le site de documentation, à coût maîtrisé et sans équipe d'exploitation dédiée.

## Décision

- **Backend sur Render, en mode Docker**, pour maîtriser GDAL (≥ 3.9) dans l'image. Base **Render PostgreSQL** avec l'extension PostGIS, **Render Key Value** (Redis) pour Celery.
- **Web OS et site de documentation sur Vercel.**
- **Photos et fichiers sur Cloudflare R2** (compatible S3, sans frais de sortie).
- Deux environnements : **staging** (J5) et **production** (J28).

## Options écartées

- **Render en mode Python natif :** GDAL non garanti dans l'environnement d'exécution.
- **VPS autogéré :** charge d'exploitation trop lourde pour l'équipe actuelle.

## Conséquences

- Positives : déploiement automatique depuis GitHub, HTTPS géré, sauvegardes de la base.
- Négatives : dépendance à des fournisseurs ; coûts à suivre quand l'usage augmente.
- Actions : `Dockerfile` et `render.yaml` dans `infrastructure/` (J5).
