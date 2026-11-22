---
sidebar_position: 6
title: Conventions de l'API
---

# Conventions de l'API

## Généralités

| Élément | Convention |
|---|---|
| Base | `/api/v1/` (versionnée) |
| Format | JSON (`Content-Type: application/json`) |
| Identifiants | UUID |
| Dates | ISO 8601 en UTC, par exemple `2026-11-22T21:17:57Z` |
| Téléphones | E.164, par exemple `+221771234567` |
| Langues | `fr`, `wo`, `ff` |
| Noms de routes | pluriel, kebab-case : `/field-observations/` |

## Pagination

Les listes sont paginées, 50 éléments par page :

```json
{
  "count": 120,
  "next": "http://127.0.0.1:8000/api/v1/memberships/?page=2",
  "previous": null,
  "results": [ … ]
}
```

## Erreurs

| Code | Signification | Corps |
|---|---|---|
| 400 | Données invalides | `{"champ": ["message"]}` ou `{"detail": "…"}` |
| 401 | Non authentifié ou jeton expiré | `{"detail": "…"}` |
| 403 | Authentifié mais non autorisé | `{"detail": "…"}` |
| 404 | Introuvable (ou appartient à une autre organisation) | `{"detail": "…"}` |
| 405 | Méthode non autorisée sur cette route | `{"detail": "…"}` |

Exemple d'erreur de validation :

```json
{ "email": ["Cette adresse e-mail est déjà utilisée."] }
```

## Suppression

Les données métier ne sont jamais supprimées : elles sont **archivées** (`is_archived`) ou **historisées** (statut `revoked`, date de fin). Les listes n'affichent par défaut que les éléments actifs.
