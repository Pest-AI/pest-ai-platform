# 0008 — Session du Web OS : jetons en cookies httpOnly, via le serveur Next.js

- **Statut :** Accepté
- **Date :** 23/11/2026
- **Décideurs :** Thierno Bocar Dieng (CEO)

## Contexte

L'API utilise des jetons JWT (accès 15 min, rafraîchissement 7 jours). Dans un navigateur, stocker ces jetons dans `localStorage` les expose à tout script exécuté dans la page (faille XSS, dépendance compromise) : un jeton volé donne accès au compte.

## Décision

- Le navigateur ne parle qu'au serveur **Next.js** du Web OS ; c'est lui qui appelle l'API (modèle « backend for frontend »).
- Les jetons sont conservés dans des **cookies `httpOnly`, `SameSite=Lax`, `Secure` en production**, illisibles par JavaScript.
- Connexion, déconnexion et choix de l'espace passent par des routes serveur (`/api/session/*`) appelées par des formulaires.
- Le **proxy Next.js** (`src/proxy.ts`) protège les pages et renouvelle le jeton d'accès avant son expiration.
- Les redirections sont construites sur l'origine réelle du navigateur (en-têtes `Host` / `X-Forwarded-*`), pour ne jamais perdre les cookies.
- L'application mobile (Expo) n'est pas concernée : elle stocke ses jetons dans `expo-secure-store`.

## Options écartées

- **Jetons dans `localStorage`** : exposés au vol par script.
- **Appels directs du navigateur vers l'API avec cookies cross-site** : CORS avec identifiants, CSRF à gérer côté API, plus complexe pour un gain nul.

## Conséquences

- Positives : aucun jeton accessible au code de la page ; pas de CORS entre le Web OS et l'API ; renouvellement transparent.
- Négatives : chaque appel passe par le serveur Next.js (léger surcoût de latence).
- Actions : appliquer `SameSite=Lax` + formulaires POST (protection CSRF de base) ; réexaminer si des actions sensibles exigent un jeton anti-CSRF dédié.
