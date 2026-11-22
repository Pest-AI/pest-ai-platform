---
sidebar_position: 2
title: Premiers pas
---

# Premiers pas

Objectif : faire tourner l'API sur votre poste et réussir votre première requête authentifiée.

## 1. Installer l'environnement

Le guide détaillé (macOS) est dans le dépôt : [`docs/06-developer-guide/installation-mac.md`](https://github.com/Pest-AI/pest-ai-platform/blob/main/docs/06-developer-guide/installation-mac.md). En résumé :

```bash
git clone https://github.com/Pest-AI/pest-ai-platform.git
cd pest-ai-platform/backend
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements/dev.txt
cp .env.example .env          # puis compléter DJANGO_SECRET_KEY et DATABASE_URL
python manage.py migrate      # crée les tables et charge les 7 rôles
python manage.py createsuperuser
```

## 2. Démarrer le serveur

Depuis la racine du dépôt :

```bash
make serveur
```

Vérifier que l'API répond :

```bash
curl http://127.0.0.1:8000/api/v1/health/
# {"status": "ok", "service": "pest-ai-os-api", "version": "0.0.1-dev"}
```

## 3. Première requête authentifiée

```bash
curl -X POST http://127.0.0.1:8000/api/v1/auth/token/ \
  -H "Content-Type: application/json" \
  -d '{"phone_number": "+221771234567", "password": "votre-mot-de-passe"}'
```

Copiez la valeur `access`, puis :

```bash
curl http://127.0.0.1:8000/api/v1/me/ -H "Authorization: Bearer <access>"
```

## 4. Explorer l'API dans le navigateur

Avec le serveur lancé :

- **Référence interactive du serveur** : [http://127.0.0.1:8000/api/docs/](http://127.0.0.1:8000/api/docs/)
- **Schéma OpenAPI brut** : [http://127.0.0.1:8000/api/schema/](http://127.0.0.1:8000/api/schema/)

Dans la référence, cliquez sur une route, renseignez le jeton (`Authentication` → `Bearer`) et, pour les routes d'organisation, l'en-tête `X-Workspace`, puis **Send**.

## 5. Lancer ce site de documentation en local

```bash
cd docs-site
pnpm install
pnpm start        # http://localhost:3000
```
