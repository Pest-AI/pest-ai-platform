---
sidebar_position: 3
title: Authentification
---

# Authentification

L'API utilise des **jetons JWT**. Chaque requête protégée envoie l'en-tête :

```text
Authorization: Bearer <jeton_d_acces>
```

## Se connecter

L'identifiant est le **numéro de téléphone** au format international (`+221…`). Les espaces sont acceptés.

```bash
curl -X POST http://127.0.0.1:8000/api/v1/auth/token/ \
  -H "Content-Type: application/json" \
  -d '{"phone_number": "+221771234567", "password": "votre-mot-de-passe"}'
```

Réponse `200` :

```json
{ "refresh": "eyJ…", "access": "eyJ…" }
```

| Jeton | Rôle | Durée |
|---|---|---|
| `access` | À envoyer dans chaque requête | 15 minutes |
| `refresh` | Obtenir un nouveau jeton d'accès | 7 jours |

`401` si le numéro ou le mot de passe est faux, ou si le compte est désactivé.

## Renouveler le jeton d'accès

```bash
curl -X POST http://127.0.0.1:8000/api/v1/auth/token/refresh/ \
  -H "Content-Type: application/json" \
  -d '{"refresh": "<refresh>"}'
```

La réponse contient un nouveau `access` **et un nouveau `refresh`**. L'ancien `refresh` est invalidé : conservez toujours le dernier reçu.

## Se déconnecter

```bash
curl -X POST http://127.0.0.1:8000/api/v1/auth/logout/ \
  -H "Content-Type: application/json" \
  -d '{"refresh": "<refresh>"}'
```

## Profil et mot de passe

| Requête | Corps | Réponse |
|---|---|---|
| `GET /api/v1/me/` | — | Profil et adhésions |
| `PATCH /api/v1/me/` | `{"first_name": "…", "email": "…", "preferred_language": "wo"}` | Profil mis à jour |
| `POST /api/v1/me/password/` | `{"current_password": "…", "new_password": "…"}` | `204` |

Le numéro de téléphone n'est pas modifiable par `/me/`. Langues : `fr` (défaut), `wo`, `ff`.

## Bonnes pratiques côté client

- Stocker les jetons de façon sécurisée (mobile : `expo-secure-store` ; web : jamais dans `localStorage` sans précaution).
- Sur `401`, tenter **une** fois le renouvellement, puis renvoyer vers l'écran de connexion.
- Ne jamais journaliser un jeton ni un mot de passe.
