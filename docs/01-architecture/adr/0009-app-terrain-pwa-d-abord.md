# 0009 — App terrain : publiée d'abord en PWA, puis sur les stores, avec le même code

- **Statut :** Accepté — complète l'ADR-0005 (Expo reste le choix technique)
- **Date :** 24/11/2026
- **Décideurs :** Thierno Bocar Dieng (CEO)

## Contexte

L'app terrain est écrite avec Expo (ADR-0005). Pour démarrer vite, sans compte développeur Google ou Apple ni installation d'APK, le fondateur veut d'abord la proposer **comme une PWA** : un lien ouvert dans le navigateur du téléphone, puis « Ajouter à l'écran d'accueil ». Les stores (Play Store, puis App Store) viennent ensuite.

Dans un navigateur, il n'existe pas de coffre sécurisé comme sur un téléphone : les jetons ne doivent pas être lisibles par la page (risque de vol par un script injecté).

## Décision

1. **Une seule base de code** (`mobile/`), exportée pour le web avec `expo export --platform web`, et compilée plus tard pour Android et iOS.
2. **Adresse : `terrain.pestai.africa`**, projet Vercel séparé du Web OS. Vercel relaie `/api/…` vers l'API : l'app et l'API sont sur la même origine, sans règle CORS.
3. **Session dans le navigateur** : routes dédiées `/api/v1/auth/web/{token,refresh,logout}/`. Le jeton de renouvellement est posé par l'API dans un cookie `httpOnly`, `Secure`, `SameSite=Strict`, limité au chemin `/api/v1/auth/web/`. La page ne garde que le jeton d'accès (15 min), en mémoire. Chaque route vérifie l'en-tête `Origin` (`WEB_SESSION_ALLOWED_ORIGINS`). Sur téléphone, rien ne change (coffre sécurisé).
4. **PWA** : manifeste, icônes, service worker (écrans gardés en cache pour s'ouvrir hors ligne ; les appels `/api/` ne sont jamais mis en cache), carte « Installer » sur Android et explication sur iPhone.

## Options écartées

- **PWA dans le Web OS (Next.js)** : deux codes à maintenir pour le terrain (web et stores).
- **Jetons dans `localStorage`** : lisibles par tout script de la page.
- **Passer par le serveur Next.js du Web OS (BFF)** : couple deux produits qui évoluent à des rythmes différents ; les routes cookie de l'API suffisent.

## Conséquences

- Positives : un simple lien suffit pour tester et déployer ; aucun frais de store au démarrage ; le code des stores est déjà prêt.
- Négatives : sur iPhone, Safari peut effacer les données d'une PWA inutilisée pendant plusieurs semaines et ne synchronise pas en arrière-plan ; le hors-ligne complet (file SQLite) devra avoir une variante navigateur (IndexedDB).
- Actions : sous-domaine `terrain` chez GoDaddy ; variable `WEB_SESSION_ALLOWED_ORIGINS` sur Render ; publication Play Store à décider à la mise en production (J28-J30).
