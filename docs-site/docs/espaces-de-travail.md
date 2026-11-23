---
sidebar_position: 4
title: Espaces de travail (X-Workspace)
---

# Espaces de travail : l'en-tête `X-Workspace`

Un utilisateur peut appartenir à **plusieurs organisations** (par exemple agronome pour une coopérative et pour une ONG). Chaque requête sur une route d'organisation indique **dans quelle organisation il agit** :

```text
X-Workspace: org:<uuid-de-l-organisation>
```

Le serveur ne fait jamais confiance à cet en-tête seul : il vérifie l'adhésion active et n'applique que les rôles de **cette** organisation.

## Trouver la bonne valeur

`GET /api/v1/me/` liste vos adhésions ; chacune donne directement la valeur à utiliser :

```json
{
  "memberships": [
    {
      "organization_name": "Coopérative de Podor",
      "status": "active",
      "roles": ["organization_admin"],
      "workspace": "org:fabc6323-4881-44a6-933a-fcd38de7c875"
    }
  ]
}
```

Un client (Web OS, mobile) propose à l'utilisateur de choisir son espace, puis envoie `X-Workspace` à chaque requête.

## Codes de réponse

| Code | Signification |
|---|---|
| 400 | En-tête `X-Workspace` absent ou mal formé |
| 401 | Jeton absent ou expiré |
| 403 | Pas d'adhésion active dans cette organisation, organisation inactive, ou permission manquante |
| 404 | L'objet demandé appartient à une autre organisation |

## Cycle de vie d'une organisation

### 1. Création (Super Admin)

```bash
curl -X POST http://127.0.0.1:8000/api/v1/platform/organizations/ \
  -H "Authorization: Bearer <access>" -H "Content-Type: application/json" \
  -d '{"name": "Coopérative de Podor", "organization_type": "cooperative", "status": "active"}'
```

Types : `cooperative`, `union`, `ngo`, `company`, `institution`, `public_agency`, `pest_ai`.

### 2. Désignation de l'administrateur (Super Admin)

```bash
curl -X POST http://127.0.0.1:8000/api/v1/platform/organizations/<org_id>/admins/ \
  -H "Authorization: Bearer <access>" -H "Content-Type: application/json" \
  -d '{"phone_number": "+221771234567"}'
```

### 3. Acceptation de l'invitation (l'invité)

```bash
curl -X POST http://127.0.0.1:8000/api/v1/me/memberships/<membership_id>/accept/ \
  -H "Authorization: Bearer <access>"
```

### 4. Gestion des membres (Organization Admin ou Cooperative Manager)

```bash
# Lister
curl http://127.0.0.1:8000/api/v1/memberships/ \
  -H "Authorization: Bearer <access>" -H "X-Workspace: org:<org_id>"

# Inviter avec un rôle (prénom et nom requis si la personne n'a pas encore de compte)
curl -X POST http://127.0.0.1:8000/api/v1/memberships/ \
  -H "Authorization: Bearer <access>" -H "X-Workspace: org:<org_id>" \
  -H "Content-Type: application/json" \
  -d '{"phone_number": "+221772223344", "first_name": "Moussa", "last_name": "Diop", "roles": ["field_agent"]}'
```

Si aucun compte n'existe pour ce numéro, il est créé **sans mot de passe** et la réponse contient `activation_code` (par exemple `7FCC-NP1Y`), **affiché une seule fois**. Le gérant le transmet à la personne (appel, WhatsApp). Un nouveau code s'obtient avec `POST /api/v1/memberships/<id>/activation-code/` (l'ancien est annulé).

### 5. Activation du compte (la personne invitée, sans jeton)

```bash
curl -X POST http://127.0.0.1:8000/api/v1/auth/activate/ \
  -H "Content-Type: application/json" \
  -d '{"phone_number": "+221772223344", "code": "7FCC-NP1Y", "new_password": "<mot de passe choisi>"}'
```

Réponse `204` : la personne se connecte puis accepte l'invitation (étape 3). Le code est valable 7 jours, à usage unique, annulé après 5 essais erronés ; la route est limitée à 20 appels par heure et par adresse. Le message d'erreur est identique quel que soit le motif. Ce mécanisme sera remplacé par un SMS automatique avec la vérification OTP.

Adhésion : `invited` → `active` ↔ `suspended` → `revoked`. Une adhésion n'est jamais supprimée.
