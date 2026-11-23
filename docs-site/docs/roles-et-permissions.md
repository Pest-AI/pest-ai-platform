---
sidebar_position: 5
title: Rôles et permissions
---

# Rôles et permissions

PEST AI OS a **7 rôles système**, non personnalisables au MVP. Un membre peut cumuler plusieurs rôles dans une organisation ; ses rôles ne s'appliquent que dans **cette** organisation.

| Code | Nom | Portée | Espace applicatif |
|---|---|---|---|
| `super_admin` | Super Admin | plateforme | Console Admin PEST AI |
| `organization_admin` | Organization Admin | organisation | Espace Coopérative |
| `cooperative_manager` | Cooperative Manager | organisation | Espace Coopérative |
| `field_agent` | Field Agent | organisation | Application mobile |
| `agronomist` | Agronomist | organisation | Espace Agronome |
| `producer` | Producer | organisation | Application mobile |
| `program_manager` | Program Manager | organisation | Espace ONG |

## `super_admin`

Rôle de portée **plateforme**, attribué avec une justification et de préférence pour une durée limitée. Il peut **consulter** une organisation sans en être membre (lecture seule) : chaque accès de ce type est journalisé.

## Permissions

Les permissions suivent le format `domaine.action` (par exemple `memberships.manage`). Chaque route déclare la permission qu'elle exige ; une action non déclarée est refusée par défaut.

| Permission | Accordée à |
|---|---|
| `organization.view` | Tous les rôles d'organisation |
| `organization.manage` | `organization_admin` |
| `memberships.view` | `organization_admin`, `cooperative_manager` |
| `memberships.manage` | `organization_admin`, `cooperative_manager` |
| `roles.assign` | `organization_admin`, `cooperative_manager` |
| `platform.organizations.view` / `.manage` | `super_admin` |

:::info Règles complémentaires (validées le 23/11/2026)
- Seul un `organization_admin` peut attribuer le rôle `organization_admin`, ou modifier, suspendre ou retirer un administrateur (403 sinon).
- Personne ne peut suspendre ni retirer sa propre adhésion, ni retirer ses propres rôles.
:::

:::note Matrice en cours d'extension
Cette matrice couvre le domaine organisations. Elle s'étendra avec chaque domaine (parcelles, observations, diagnostics…).
:::
