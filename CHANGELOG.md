# Journal des versions

Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/). Une version par fin de semaine du planning MVP.

## [Non publié] — Semaine 3 : parcelles et AgroID

### Ajouté
- **Parcelles (J11)** : app `parcels` ; `Parcel` avec AgroID `PAI-SN-XXXXXXXX` (tirage cryptographique base32 Crockford, attribué par le serveur, brouillon hors ligne sans AgroID, D-05) ; `ParcelGeometry` versionnée (MultiPolygon WGS 84, surface et périmètre calculés par PostGIS, une seule version courante) ; services de création, d'attribution, de nouveau contour et de retrait ; recherche par AgroID tolérante aux erreurs de saisie.
- Garanties PostgreSQL : AgroID attribué non modifiable, parcelles et versions de contour jamais supprimées, contour valide en SRID 4326.
- **Règles foncières (J12)** : propriété (`ParcelOwnership`, propriétaire non enregistré par son nom), exploitation (`ParcelOperatorAssignment`, un seul principal), suivi par les organisations (`ParcelOrganizationLink`, accord du producteur pour ses parcelles), accès personnels (`ProducerParcelAccess`), unités de culture ; historique daté, jamais réécrit ni supprimé ; aucun accès déduit de la propriété ou de l'exploitation.
- **API Parcelles (J13)** : `/api/v1/parcels/` dans les deux espaces (liste filtrable par AgroID, statut, exploitant et emprise ; carte GeoJSON `/map/?bbox=` ; fiche ; historique ; nouveau contour ; revue des contours signalés ; propriétaires, exploitants, unités ; retrait) ; demandes de suivi par AgroID et accord du producteur (`/api/v1/me/parcel-links/`) ; accès personnel accordé par l'organisation ; 404 hors périmètre ; nouvelles permissions `parcels.*` ; guide « Parcelles et AgroID » avec exemples GeoJSON.
- **Contrôle des contours (J12, D-19)** : surface hors bornes, précision GPS insuffisante et chevauchement > 5 % signalés (parcelle « en attente de validation ») avec rapport détaillé ; revue humaine (confirmer ou refuser) ; seuils réglables.

## [Non publié] — Semaine 2 : Web OS

### Ajouté
- Web OS Next.js : connexion sécurisée (jetons en cookies httpOnly), choix de l'espace de travail.
- Design validé (J7) : thème PEST AI (polices auto-hébergées), logo officiel, navigation latérale, puce AgroID.
- Console Admin : liste des organisations pour le super-admin.
- API : champ `is_platform_admin` sur `GET /api/v1/me/`.
- Connexion : un numéro sénégalais saisi sans indicatif est complété avec +221.
- Espace Coopérative, « Membres et invitations » : liste de l'équipe, invitation par numéro (création du compte si besoin), attribution et retrait des rôles, suspension, réactivation, retrait.
- Comptes créés par invitation : code d'activation (7 jours, usage unique, haché, 5 essais) et page publique « Activer mon compte » ; route `POST /api/v1/auth/activate/` limitée en fréquence.
- Invitations à accepter sur la page de choix de l'espace.
- Matrice des permissions : le gérant de coopérative invite et gère les rôles (jamais un administrateur).
- Console Admin : création d'une organisation et désignation de son administrateur (compte créé avec code d'activation si besoin).

- **Producteurs (J9)** : app `actors` (`Producer`, `ProducerContact`, `ProducerOrganizationAssignment` historisé) ; producteur rattaché (cas A) ou indépendant (cas B, `/api/v1/me/producer/`) ; API `/api/v1/producers/` (liste et recherche, fiche, création, modification, rattachement d'une fiche existante, clôture du rattachement) ; détection des doublons à la création (D-28, réponse 409) ; permissions `producers.view|create|manage`.
- Espace personnel : `X-Workspace: personal` ouvert par un profil producteur actif, avec les 9 permissions `personal.*` (D-11) ; route `/api/v1/workspace/` (rôles et permissions de l'espace).
- Rôle `producer` attribuable à un membre dont la fiche est rattachée à l'organisation.
- Web OS : page Producteurs (liste, recherche, fiche, création avec gestion des doublons, modification, retrait) ; indicateur et étape « producteurs » sur la vue d'ensemble.

- **App mobile (J10)** : projet Expo dans `mobile/` (connexion, choix de l'espace, registre des producteurs avec recherche et appel direct, fiche producteur) ; jetons dans le trousseau du téléphone, renouvellement unique en cas d'expiration, délai réseau de 20 s, bandeau hors ligne, déconnexion avec confirmation ; icônes aux couleurs PEST AI ; CI « Mobile » (types de l'API, TypeScript, tests).
- **App terrain en PWA (J10b)** : même code que l'app mobile, publié sur `terrain.pestai.africa` (Vercel, relais `/api/` vers l'API) ; installable (manifeste, icônes, service worker, proposition d'installation Android et iPhone) ; s'ouvre hors ligne ; session navigateur par cookie httpOnly via `POST /api/v1/auth/web/{token,refresh,logout}/` (jeton d'accès en mémoire, contrôle d'origine) ; ADR-0009.
- **Tests de bout en bout (J10)** : Playwright dans `frontend/e2e` (sécurité, parcours connecté, déconnexion ; création de données uniquement sur demande) ; workflow manuel « E2E staging ».
- **Sécurité (J10)** : en-têtes HTTP du Web OS (CSP, anti-iframe, HSTS…), refus des routes de session appelées depuis un autre site, `check --deploy` en CI, limite de 10 tentatives de connexion par minute et par numéro (429 + message clair), revue documentée dans `docs/05-security/revue-securite-j10.md`.

### Modifié
- Limitation de l'activation de compte : par numéro de téléphone au lieu de l'adresse IP (le Web OS appelle l'API depuis des adresses partagées).
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
