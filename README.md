# PEST AI OS

Plateforme d'intelligence agricole de **PEST AI** (Ecliptix SAS) pour les petits producteurs d'Afrique de l'Ouest : organisations et coopératives, producteurs, parcelles géolocalisées (AgroID), observations terrain hors ligne, diagnostic assisté par IA avec validation agronomique, et espaces dédiés par rôle.

> **État :** développement du MVP en cours (démarrage du code le 22/11/2026, livraison MVP visée le 05/01/2027).

## Les applications

| Application | Utilisateurs | Dossier | Technologie | Hébergement |
|---|---|---|---|---|
| API centrale | Toutes les applications | [`backend/`](backend/) | Django 5.2 LTS, DRF, PostgreSQL 16 + PostGIS | Render (Docker) |
| Web OS | Console Admin, Espace Coopérative, Espace Agronome, Espace ONG | [`frontend/`](frontend/) | Next.js, TypeScript, Tailwind | Vercel |
| App mobile | Agents de terrain, producteurs | [`mobile/`](mobile/) | React Native (Expo) | APK (EAS) |
| Site de documentation | Développeurs | [`docs-site/`](docs-site/) | Docusaurus + Scalar (OpenAPI) | Vercel (J5) |

## Structure du dépôt

```
pest-ai-platform/
├── backend/          API Django (code, tests, dépendances)
├── frontend/         Web OS Next.js (à partir du J6)
├── mobile/           Application Expo (à partir du J9)
├── docs-site/        Portail de documentation développeurs (guides + référence API)
├── infrastructure/   Dockerfile, render.yaml, scripts (à partir du J5)
├── docs/             Documentation de référence
│   ├── 01-architecture/   Architecture + décisions (ADR)
│   ├── 02-database/       Database Design v2.2, registre de décisions, audit
│   ├── 03-api/ … 05-security/
│   └── 06-developer-guide/  Installation, workflow Git, standards de code
└── .github/          Modèles de PR et d'issues (CI à partir du J1)
```

## Démarrage rapide (backend, macOS)

Guide complet : [docs/06-developer-guide/installation-mac.md](docs/06-developer-guide/installation-mac.md).

```bash
cd backend
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements/dev.txt
cp .env.example .env        # puis compléter les valeurs
python manage.py check
pytest
```

## Contribuer

Lire [CONTRIBUTING.md](CONTRIBUTING.md) avant la première contribution : branches, messages de commit, pull requests, règles de sécurité.

## Documentation de référence

- Architecture : [docs/01-architecture/](docs/01-architecture/)
- Décisions d'architecture (ADR) : [docs/01-architecture/adr/](docs/01-architecture/adr/)
- Base de données (v2.2) : [docs/02-database/](docs/02-database/)
- Guides développeurs : [docs/06-developer-guide/](docs/06-developer-guide/)

---
© Ecliptix SAS — PEST AI. Code propriétaire, tous droits réservés.
