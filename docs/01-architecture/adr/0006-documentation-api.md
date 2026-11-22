# 0006 — Documentation API : OpenAPI + Docusaurus + Scalar

- **Statut :** Accepté
- **Date :** 22/11/2026
- **Décideurs :** Thierno Bocar Dieng (CEO)

## Contexte

L'équipe veut un portail de documentation de qualité, sur le modèle des grands fournisseurs d'API, pour accueillir les développeurs actuels et futurs.

## Décision

- Le backend publie un **schéma OpenAPI 3** généré par **drf-spectacular** : il ne peut pas diverger du code.
- Le portail `docs-site/` utilise **Docusaurus** pour les guides et **Scalar** pour la référence API interactive (essai des requêtes depuis le navigateur).
- Hébergement sur **Vercel**.

## Options écartées

- **Mintlify :** excellent rendu mais payant.
- **Swagger UI seul :** référence technique sans guides.

## Conséquences

- Positives : référence API toujours à jour, guides versionnés avec le code.
- Négatives : chaque endpoint doit être correctement annoté (schémas, exemples, erreurs).
- Actions : schéma et portail au J4, enrichis à chaque fonctionnalité.
