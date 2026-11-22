# PEST AI OS — Infrastructure

| Fichier | Rôle |
|---|---|
| [`backend/Dockerfile`](backend/Dockerfile) | Image de production de l'API (Python 3.12, GDAL 3.10, gunicorn, WhiteNoise) |
| [`../render.yaml`](../render.yaml) | Blueprint Render : base PostgreSQL 16 + service API (racine du dépôt, emplacement attendu par Render) |
| [`../backend/entrypoint.sh`](../backend/entrypoint.sh) | Démarrage du conteneur : migrations, compte initial, gunicorn |
| [`../docs-site/vercel.json`](../docs-site/vercel.json) | Déploiement du portail sur Vercel |

Guide pas à pas : [docs/04-devops/deploiement-staging.md](../docs/04-devops/deploiement-staging.md).

La CI construit l'image et la démarre réellement à chaque modification (job « Image Docker » de `.github/workflows/backend.yml`).
