# Organisations et espaces de travail (X-Workspace)

Un utilisateur peut appartenir à plusieurs organisations (par exemple agronome pour une coopérative et une ONG). À chaque requête, il indique **dans quelle organisation il agit** avec l'en-tête :

```
X-Workspace: org:<uuid-de-l-organisation>
```

Le serveur ne fait jamais confiance à cet en-tête seul : il vérifie l'adhésion active et n'applique que les rôles de **cette** organisation.

## 1. Mettre en place une organisation (Super Admin)

Attribuer le rôle `super_admin` (une fois, en ligne de commande, par un superutilisateur technique) :

```bash
python manage.py grant_super_admin --phone +221770000001 --granted-by +221770000001 \
  --justification "Administration initiale de la plateforme" --days 90
```

Créer l'organisation :

```bash
curl -X POST http://127.0.0.1:8000/api/v1/platform/organizations/ \
  -H "Authorization: Bearer <access>" -H "Content-Type: application/json" \
  -d '{"name": "Coopérative de Podor", "organization_type": "cooperative", "status": "active"}'
```

Désigner son administrateur (le compte doit exister) :

```bash
curl -X POST http://127.0.0.1:8000/api/v1/platform/organizations/<org_id>/admins/ \
  -H "Authorization: Bearer <access>" -H "Content-Type: application/json" \
  -d '{"phone_number": "+221771234567"}'
```

## 2. Accepter une invitation (l'invité)

```bash
curl http://127.0.0.1:8000/api/v1/me/ -H "Authorization: Bearer <access>"
```

La réponse liste les adhésions (`memberships`), avec pour chacune son `status`, ses `roles` et la valeur `workspace` à utiliser. Pour accepter :

```bash
curl -X POST http://127.0.0.1:8000/api/v1/me/memberships/<membership_id>/accept/ \
  -H "Authorization: Bearer <access>"
```

## 3. Agir dans l'organisation

```bash
curl http://127.0.0.1:8000/api/v1/organization/ \
  -H "Authorization: Bearer <access>" -H "X-Workspace: org:<org_id>"

curl http://127.0.0.1:8000/api/v1/memberships/ \
  -H "Authorization: Bearer <access>" -H "X-Workspace: org:<org_id>"
```

Inviter un membre avec un rôle :

```bash
curl -X POST http://127.0.0.1:8000/api/v1/memberships/ \
  -H "Authorization: Bearer <access>" -H "X-Workspace: org:<org_id>" \
  -H "Content-Type: application/json" \
  -d '{"phone_number": "+221772223344", "roles": ["field_agent"]}'
```

## Codes de réponse

| Code | Signification |
|---|---|
| 400 | En-tête `X-Workspace` absent ou mal formé |
| 401 | Jeton absent ou expiré |
| 403 | Pas d'adhésion active dans cette organisation, ou permission manquante |
| 404 | L'objet demandé appartient à une autre organisation |

Les listes sont paginées : `{"count", "next", "previous", "results"}`, 50 éléments par page.
