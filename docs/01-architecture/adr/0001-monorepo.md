# 0001 — Monorepo unique `pest-ai-platform`

- **Statut :** Accepté
- **Date :** 22/11/2026
- **Décideurs :** Thierno Bocar Dieng (CEO)

## Contexte

PEST AI OS comprend une API, une application web, une application mobile et un portail de documentation. L'équipe technique est réduite et les applications partagent le même contrat d'API.

## Décision

Un seul dépôt GitHub `Pest-AI/pest-ai-platform` contient toutes les applications, chacune dans son dossier : `backend/`, `frontend/`, `mobile/`, `docs-site/`, `infrastructure/`, `docs/`.

## Options écartées

- **Un dépôt par application :** plus de coordination (versions de l'API, PR multiples) pour une petite équipe.

## Conséquences

- Positives : une PR peut modifier l'API et ses clients ensemble ; documentation centralisée ; un seul endroit pour les nouveaux développeurs.
- Négatives : la CI doit cibler les dossiers modifiés pour rester rapide.
- Actions : CI par dossier (filtres de chemins dans GitHub Actions) à partir du J1.
