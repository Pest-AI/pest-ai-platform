# App `core` — socle commun

Briques réutilisées par toutes les apps métier. Elle ne crée **aucune table** : ses modèles sont abstraits.

## Mixins (Database Design v2.2)

| Mixin v2.2 | Classe | Champs | Disponible |
|---|---|---|---|
| BASE | `BaseModel` | `id` (UUID), `created_at`, `updated_at`, `created_by`, `updated_by` | J1 |
| ARCH | `ArchivableModel` | `is_archived`, `archived_at`, `archived_by`, `archive_reason` | J1 |
| SYNC | `SyncModel` | `client_created_at`, `server_received_at`, `row_version` | J1 — `source_device` au J18 (modèle Device) |
| TENANT | `TenantModel` | `organization` (immuable), `objects.for_organization(org)` | J3 |
| SPACE | `SpaceModel` | `organization` ou `personal_producer`, `space_key` généré | J10, avec Producer |

Exemple :

```python
from apps.core.models import ArchivableModel, BaseModel, ImmutableFieldsMixin, SyncModel


class Parcel(ImmutableFieldsMixin, BaseModel, ArchivableModel, SyncModel):
    IMMUTABLE_FIELDS = ("agroid",)
    ...
```

> Placer `ImmutableFieldsMixin` **en premier** dans la liste des parents : son contrôle doit s'exécuter avant l'enregistrement.

## Règles de comportement

- **Auteurs.** `created_by` / `updated_by` ne sont jamais déduits automatiquement : les services les renseignent explicitement.
- **Archivage.** `objects` renvoie toutes les lignes ; `active_objects` (ou `objects.active()`) seulement les lignes non archivées. Archiver et restaurer passent par `apps.core.services.archive(obj, by=user, reason=...)` et `restore(obj, by=user)`. Aucune suppression physique.
- **row_version.** Vaut 1 à la création, +1 à chaque modification, par `save()` comme par `QuerySet.update()`. L'incrément est calculé par PostgreSQL (sûr en cas d'accès concurrents). `bulk_update()` ne l'incrémente pas : ne pas l'utiliser sur les modèles SYNC. La détection des conflits de synchronisation arrive au J18.
- **Champs immuables.** `IMMUTABLE_FIELDS` refuse toute modification après la création (`ValidationError`). Les tables TENANT et SPACE recevront aussi le trigger PostgreSQL équivalent.

## Tests

Les mixins sont testés via des modèles concrets de test (`backend/tests/testapp/`), installés uniquement dans les paramètres de test. Tests : `apps/core/tests/`.
