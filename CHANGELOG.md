# Journal des versions

Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/). Une version par fin de semaine du planning MVP.

## [Non publié] — Semaine 2 : Web OS

### Ajouté
- Web OS Next.js : connexion sécurisée (jetons en cookies httpOnly), choix de l'espace de travail.
- Design validé (J7) : thème PEST AI (Montserrat, Inter, IBM Plex Mono auto-hébergées), logo officiel, navigation latérale, puce AgroID.
- Console Admin : liste des organisations pour le super-admin.
- API : champ `is_platform_admin` sur `GET /api/v1/me/`.
- Connexion : un numéro sénégalais saisi sans indicatif est complété avec +221.

## [0.0.1] — Semaine 1 : socle backend

### Ajouté
- Monorepo documenté : README, CONTRIBUTING, 7 décisions d'architecture (ADR), guides développeurs.
- Backend Django 5.2 LTS + PostgreSQL 16 / PostGIS : paramètres par environnement, CI GitHub, `make verifier`.
- Mixins communs du Database Design v2.2 : BASE, ARCH, SYNC, TENANT.
- Comptes : connexion par numéro de téléphone, JWT (connexion, renouvellement, déconnexion), `/me`.
- Organisations, adhésions, 7 rôles système, en-tête `X-Workspace` (400 / 403 / 404), rôle `super_admin` justifié et journalisé.
- Documentation API : schéma OpenAPI, référence interactive Scalar (`/api/docs/`), portail développeurs Docusaurus, aux couleurs de la charte.
- Déploiement : image Docker de production, Blueprint Render (staging), configuration Vercel.
