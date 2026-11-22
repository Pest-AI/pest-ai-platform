---
slug: /
sidebar_position: 1
title: Bienvenue
---

# Documentation développeurs PEST AI OS

PEST AI OS est la plateforme d'intelligence agricole de **PEST AI** (Ecliptix SAS) pour les petits producteurs d'Afrique de l'Ouest : organisations et coopératives, producteurs, parcelles géolocalisées, observations terrain hors ligne, diagnostic assisté par IA avec validation agronomique.

Ce portail s'adresse aux développeurs qui construisent ou intègrent PEST AI OS : le Web OS, l'application mobile ou un service partenaire.

## Par où commencer

| Vous voulez… | Lire |
|---|---|
| Lancer l'API sur votre machine | [Premiers pas](premiers-pas.md) |
| Vous connecter et appeler l'API | [Authentification](authentification.md) |
| Comprendre le multi-organisation (`X-Workspace`) | [Espaces de travail](espaces-de-travail.md) |
| Savoir qui a le droit de faire quoi | [Rôles et permissions](roles-et-permissions.md) |
| Connaître les formats, la pagination, les erreurs | [Conventions de l'API](conventions.md) |
| Essayer chaque route depuis le navigateur | [Référence API](pathname:///reference) |

## En résumé

```text
Base URL (local)   http://127.0.0.1:8000/api/v1
Authentification   Authorization: Bearer <jeton d'accès>      (POST /auth/token/)
Espace de travail  X-Workspace: org:<uuid>                    (routes d'organisation)
Format             JSON, dates ISO 8601 en UTC, identifiants UUID
```

La référence API est générée automatiquement depuis le code du serveur : elle est toujours à jour.
