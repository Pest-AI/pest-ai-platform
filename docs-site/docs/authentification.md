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

`429` au-delà de **10 tentatives par minute pour un même numéro** (réussies ou non). L'en-tête `Retry-After` donne le nombre de secondes à attendre. Affichez un message clair (« Trop de tentatives… ») et ne relancez pas automatiquement. L'activation d'un compte (`/api/v1/auth/activate/`) suit la même règle, à 20 tentatives par heure et par numéro.

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

## App terrain dans un navigateur (PWA)

L'app terrain publiée sur `terrain.pestai.africa` utilise trois routes dédiées, où le jeton de renouvellement n'est jamais exposé à la page :

| Route | Effet |
|---|---|
| `POST /api/v1/auth/web/token/` | Connexion : renvoie `{"access"}` et pose le cookie `httpOnly` de renouvellement |
| `POST /api/v1/auth/web/refresh/` | Nouveau `access` à partir du cookie (rotation, l'ancien jeton est révoqué) |
| `POST /api/v1/auth/web/logout/` | Révoque le jeton du cookie et efface le cookie (`204`) |

Ces routes n'acceptent que les origines déclarées (`WEB_SESSION_ALLOWED_ORIGINS`) : `403` sinon. Elles sont réservées à l'app terrain ; une intégration serveur ou une app native utilise les routes classiques ci-dessus.

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
