# App `organizations` — organisations, adhésions, rôles

Le cœur multi-organisation de PEST AI OS (Database Design v2.2, domaine 1).

## Modèles

| Modèle | Rôle | Règles clés |
|---|---|---|
| `Organization` | Coopérative, union, ONG, entreprise, institution, agence publique, PEST AI | Statut `pending` → `active` / `suspended` / `closed`. Archivage logique (adhésions actives suspendues). `parent_organization` ne donne **aucun** droit implicite. |
| `OrganizationMembership` | Appartenance d'un utilisateur à une organisation | `invited` → `active` ↔ `suspended` → `revoked`. Jamais supprimée. Une seule adhésion ouverte par (utilisateur, organisation). |
| `Role` | Les **7 rôles système** | Verrouillés en base (CHECK). `super_admin` = portée plateforme ; les 6 autres = portée organisation. |
| `Permission`, `RolePermission` | Autorisations `domaine.action` et matrice rôle × permission | Une permission `personal` n'est jamais donnée par un rôle. |
| `MembershipRole` | Rôle(s) d'un membre dans une organisation | Cumul possible. Historisé (`revoked_at`). |
| `PlatformRoleAssignment` | Attribution de `super_admin` | Justification obligatoire, durée limitée recommandée, chaque usage journalisé. |

Les 7 rôles et leurs permissions sont **chargés automatiquement après chaque `migrate`** (et par `python manage.py seed_roles`).

## Les 7 rôles

| Code | Nom | Portée | Espace |
|---|---|---|---|
| `super_admin` | Super Admin | plateforme | Console Admin PEST AI |
| `organization_admin` | Organization Admin | organisation | Espace Coopérative |
| `cooperative_manager` | Cooperative Manager | organisation | Espace Coopérative |
| `field_agent` | Field Agent | organisation | App mobile |
| `agronomist` | Agronomist | organisation | Espace Agronome |
| `producer` | Producer | organisation | App mobile (attribuable quand le profil Producteur existera, J10) |
| `program_manager` | Program Manager | organisation | Espace ONG |

> **Matrice des permissions : proposition technique à valider.** Le Design v2.2 fixe le format et les portées, pas la matrice complète. La matrice actuelle (`constants.py`) couvre le domaine organisations ; chaque domaine ajoutera ses permissions.

## Contrôle d'accès (`apps/core/workspace.py`, `apps/core/permissions.py`)

Chaque route d'organisation exige l'en-tête **`X-Workspace: org:<uuid>`** :

| Situation | Réponse |
|---|---|
| En-tête absent ou mal formé | **400** |
| Pas d'adhésion active dans cette organisation (ou organisation inactive) | **403**, journalisé |
| Permission manquante pour l'action | **403**, journalisé |
| Objet d'une autre organisation dans l'URL | **404** (les listes sont toujours filtrées) |
| `super_admin` qui consulte une organisation sans en être membre | Lecture seule, journalisée (`cross_org_access`) |

Dans une vue :

```python
permission_classes = [IsAuthenticated, WorkspacePermission]
required_permissions = {"GET": "memberships.view", "POST": "memberships.manage"}
```

Une méthode absente de `required_permissions` est refusée (refus par défaut).

## API

| Méthode | Route | Qui |
|---|---|---|
| GET | `/api/v1/organizations/` | Toute personne connectée : ses organisations (choix de l'espace) |
| GET / PATCH | `/api/v1/organization/` | Membre (lecture) / `organization_admin` (modification) |
| GET / POST | `/api/v1/memberships/` | Liste / invitation de membres |
| POST | `/api/v1/memberships/<id>/suspend/`, `reactivate/`, `revoke/` | `organization_admin` |
| POST | `/api/v1/memberships/<id>/roles/` · `roles/<code>/revoke/` | `organization_admin` |
| POST | `/api/v1/me/memberships/<id>/accept/` | L'invité lui-même |
| GET / POST / PATCH | `/api/v1/platform/organizations/` | `super_admin` |
| POST | `/api/v1/platform/organizations/<id>/archive/` · `admins/` | `super_admin` |

Guide pas à pas : [docs/03-api/organisations-et-espaces.md](../../../docs/03-api/organisations-et-espaces.md).

## Commandes

```bash
python manage.py seed_roles            # (re)charge les rôles et permissions — automatique après migrate
python manage.py grant_super_admin --phone +221… --granted-by +221… --justification "…" --days 90
```

## Événements de sécurité

Accès refusés, accès inter-organisations et changements de rôles / adhésions sont journalisés (`pestai.security`). Ils seront enregistrés dans le journal d'audit en base au J26.
