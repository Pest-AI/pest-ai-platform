# 0004 — Web OS en Next.js avec espaces par rôle

- **Statut :** Accepté
- **Date :** 22/11/2026
- **Décideurs :** Thierno Bocar Dieng (CEO)

## Contexte

L'architecture technique prévoit un frontend React. Le Web OS doit servir quatre publics distincts avec des écrans de carte, des tableaux et des formulaires.

## Décision

Une seule application **Next.js** (React, TypeScript), hébergée sur Vercel, avec un espace par rôle :

| Espace | Rôles |
|---|---|
| Console Admin PEST AI | `super_admin` |
| Espace Coopérative | `organization_admin`, `cooperative_manager` |
| Espace Agronome | `agronomist` |
| Espace ONG | `program_manager` (organisation de type ONG ; données agrégées par défaut, sans nominatif) |

Bibliothèques : Tailwind CSS + shadcn/ui (interface), TanStack Query (données), MapLibre (cartes), client API généré depuis le schéma OpenAPI.

## Options écartées

- **Une application par espace :** duplication de l'authentification, du design et du client API.
- **React sans framework (Vite) :** routage, rendu et déploiement à assembler soi-même.

## Conséquences

- Positives : un seul code, une seule authentification ; navigation et permissions selon le rôle et l'espace de travail (`X-Workspace`).
- Négatives : les règles d'accès doivent être appliquées côté API (le frontend ne fait qu'afficher).
- Actions : initialisation au J6.
