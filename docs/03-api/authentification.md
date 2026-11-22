# Authentification

L'API PEST AI OS utilise des **jetons JWT**. Chaque requête protégée envoie l'en-tête :

```
Authorization: Bearer <jeton_d_acces>
```

## 1. Se connecter

```bash
curl -X POST http://127.0.0.1:8000/api/v1/auth/token/ \
  -H "Content-Type: application/json" \
  -d '{"phone_number": "+221771234567", "password": "votre-mot-de-passe"}'
```

Réponse `200` :

```json
{"refresh": "eyJ…", "access": "eyJ…"}
```

- `access` : à envoyer dans chaque requête. Valable **15 minutes**.
- `refresh` : sert à obtenir un nouveau jeton d'accès. Valable **7 jours**.

Erreur `401` si le numéro ou le mot de passe est faux, ou si le compte est désactivé.

## 2. Appeler une route protégée

```bash
curl http://127.0.0.1:8000/api/v1/me/ \
  -H "Authorization: Bearer <access>"
```

Sans jeton ou avec un jeton expiré : `401`.

## 3. Renouveler le jeton d'accès

```bash
curl -X POST http://127.0.0.1:8000/api/v1/auth/token/refresh/ \
  -H "Content-Type: application/json" \
  -d '{"refresh": "<refresh>"}'
```

La réponse contient un nouveau `access` **et un nouveau `refresh`**. L'ancien `refresh` est invalidé : conservez toujours le dernier reçu.

## 4. Se déconnecter

```bash
curl -X POST http://127.0.0.1:8000/api/v1/auth/logout/ \
  -H "Content-Type: application/json" \
  -d '{"refresh": "<refresh>"}'
```

Le jeton `refresh` ne peut plus être utilisé. Le jeton d'accès expire seul après 15 minutes au plus.

## 5. Profil et mot de passe

| Requête | Corps | Réponse |
|---|---|---|
| `GET /api/v1/me/` | — | Profil |
| `PATCH /api/v1/me/` | `{"first_name": "…", "email": "…", "preferred_language": "wo"}` | Profil mis à jour |
| `POST /api/v1/me/password/` | `{"current_password": "…", "new_password": "…"}` | `204` |

Le numéro de téléphone n'est pas modifiable par `/me/`.

> La référence complète et interactive de l'API sera publiée sur le site de documentation (J4).
