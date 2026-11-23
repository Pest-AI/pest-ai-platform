# Journal des versions

Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/). Une version par fin de semaine du planning MVP.

## [Non publié] — Semaine 2 : Web OS

### Ajouté
- Web OS Next.js : connexion sécurisée (jetons en cookies httpOnly), choix de l'espace de travail.
- Design validé (J7) : thème PEST AI (Montserrat, Inter, IBM Plex Mono auto-hébergées), logo officiel, navigation latérale, puce AgroID.
- Console Admin : liste des organisations pour le super-admin.
- API : champ `is_platform_admin` sur `GET /api/v1/me/`.
- Connexion : un numéro sénégalais saisi sans indicatif est complété avec +221.
- Espace Coopérative, « Membres et invitations » : liste de l'équipe, invitation par numéro (création du compte si besoin), attribution et retrait des rôles, suspension, réactivation, retrait.
- Comptes créés par invitation : code d'activation (7 jours, usage unique, haché, 5 essais) et page publique « Activer mon compte » ; route `POST /api/v1/auth/activate/` limitée en fréquence.
- Invitations à accepter sur la page de choix de l'espace.
- Matrice des permissions : le gérant de coopérative invite et gère les rôles (jamais un administrateur).
- Console Admin : création d'une organisation et désignation de son administrateur (compte créé avec code d'activation si besoin).

### Modifié
- Refonte visuelle du Web OS (référence AI Studio) : barre latérale vert forêt, menu mobile en tiroir, navigation calée sur les modules du MVP, indicateurs en cartes, listes responsives, textes raccourcis.
- Connexion et activation : nouvelle mise en page mobile / tablette / ordinateur avec visuel de parcelles ; vue d'ensemble avec parcours « Pour démarrer » ; choix de l'espace en liste.

## [0.0.1] — Semaine 1 : socle backend

### Ajouté
- Monorepo documenté : README, CONTRIBUTING, 7 décisions d'architecture (ADR), guides développeurs.
- Backend Django 5.2 LTS + PostgreSQL 16 / PostGIS : paramètres par environnement, CI GitHub, `make verifier`.
- Mixins communs du Database Design v2.2 : BASE, ARCH, SYNC, TENANT.
- Comptes : connexion par numéro de téléphone, JWT (connexion, renouvellement, déconnexion), `/me`.
- Organisations, adhésions, 7 rôles système, en-tête `X-Workspace` (400 / 403 / 404), rôle `super_admin` justifié et journalisé.
- Documentation API : schéma OpenAPI, référence interactive Scalar (`/api/docs/`), portail développeurs Docusaurus, aux couleurs de la charte.
- Déploiement : image Docker de production, Blueprint Render (staging), configuration Vercel.
