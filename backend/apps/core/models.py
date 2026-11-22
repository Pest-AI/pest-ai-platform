"""Modèles abstraits communs : mixins du Database Design v2.2.

Aucune table n'est créée ici. Les modèles métier héritent de ces classes :

    class Parcel(BaseModel, ArchivableModel, SyncModel):
        ...

| Mixin du Design v2.2 | Classe                | Disponible |
|----------------------|-----------------------|------------|
| BASE                 | BaseModel             | J1         |
| ARCH                 | ArchivableModel       | J1         |
| SYNC                 | SyncModel             | J1 (source_device au J18, avec Device) |
| TENANT               | TenantModel           | J3                    |
| SPACE                | SpaceModel            | J10, avec Producer |
"""

import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import F


def _has_field(model, name: str) -> bool:
    return any(f.name == name for f in model._meta.get_fields())


class CoreQuerySet(models.QuerySet):
    """QuerySet commun à tous les modèles PEST AI OS."""

    def active(self):
        """Lignes non archivées (modèles ARCH uniquement)."""
        return self.filter(is_archived=False)

    def for_organization(self, organization):
        """Lignes de l'organisation du contexte vérifié (modèles TENANT uniquement)."""
        return self.filter(organization=organization)

    def update(self, **kwargs):
        # Une mise à jour en masse est aussi une modification : row_version +1 (mixin SYNC).
        if _has_field(self.model, "row_version") and "row_version" not in kwargs:
            kwargs["row_version"] = F("row_version") + 1
        return super().update(**kwargs)

    update.alters_data = True


class ActiveManager(models.Manager.from_queryset(CoreQuerySet)):
    """Gestionnaire qui n'expose que les lignes non archivées."""

    def get_queryset(self):
        return super().get_queryset().filter(is_archived=False)


class BaseModel(models.Model):
    """Mixin BASE : identifiant UUID, dates et auteurs de création et de modification.

    Les auteurs (`created_by`, `updated_by`) ne sont jamais déduits automatiquement :
    la couche service les renseigne explicitement.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
        editable=False,
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
        editable=False,
    )

    objects = CoreQuerySet.as_manager()

    class Meta:
        abstract = True


class ArchivableModel(models.Model):
    """Mixin ARCH : archivage logique, jamais de suppression physique.

    - `objects` renvoie toutes les lignes, archivées comprises ;
    - `active_objects` ne renvoie que les lignes non archivées.

    Archiver et restaurer passent par `apps.core.services`.
    """

    is_archived = models.BooleanField(default=False)
    archived_at = models.DateTimeField(null=True, blank=True)
    archived_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    archive_reason = models.TextField(blank=True, default="")

    objects = CoreQuerySet.as_manager()
    active_objects = ActiveManager()

    class Meta:
        abstract = True


class SyncModel(models.Model):
    """Mixin SYNC : traçabilité de la saisie hors ligne et verrou optimiste.

    `row_version` vaut 1 à la création et augmente de 1 à chaque modification
    (Design v2.2), que la modification passe par `save()` ou par `QuerySet.update()`.
    L'incrément est fait par PostgreSQL (expression F), donc sûr en cas d'accès
    concurrents. La détection des conflits de synchronisation arrive au J18.

    Le champ `source_device` (appareil d'origine) sera ajouté au J18 avec le modèle Device.
    """

    client_created_at = models.DateTimeField(null=True, blank=True)
    server_received_at = models.DateTimeField(null=True, blank=True)
    row_version = models.PositiveIntegerField(default=1, editable=False)

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        if self._state.adding:
            super().save(*args, **kwargs)
            return
        self.row_version = F("row_version") + 1
        update_fields = kwargs.get("update_fields")
        if update_fields is not None:
            kwargs["update_fields"] = {*update_fields, "row_version"}
        super().save(*args, **kwargs)
        self.refresh_from_db(fields=["row_version"])


class TenantModel(models.Model):
    """Mixin TENANT : rattachement à une organisation propriétaire (isolation).

    - `organization` est fixée à la création à partir du contexte X-Workspace vérifié,
      jamais lue dans le corps de la requête ;
    - elle n'est plus modifiable ensuite (contrôle applicatif ci-dessous ; trigger
      PostgreSQL ajouté avec la première table métier TENANT, Design v2.2 T-04) ;
    - les vues lisent via `Model.objects.for_organization(request.workspace.organization)` :
      un objet d'une autre organisation renvoie donc 404.
    """

    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.PROTECT,
        related_name="+",
    )

    objects = CoreQuerySet.as_manager()

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        if not self._state.adding:
            stored = (
                type(self)
                ._base_manager.filter(pk=self.pk)
                .values_list("organization_id", flat=True)
                .first()
            )
            if stored is not None and stored != self.organization_id:
                raise ValidationError(
                    {"organization": "L'organisation propriétaire ne peut pas être modifiée."}
                )
        super().save(*args, **kwargs)


class ImmutableFieldsMixin(models.Model):
    """Refuse la modification de certains champs après la création.

    Déclarer `IMMUTABLE_FIELDS = ("reference", ...)` dans le modèle.
    Contrôle applicatif ; les tables TENANT et SPACE recevront en plus le trigger
    PostgreSQL équivalent (Design v2.2, T-04).
    """

    IMMUTABLE_FIELDS: tuple[str, ...] = ()

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        if not self._state.adding and self.IMMUTABLE_FIELDS:
            attnames = [self._meta.get_field(name).attname for name in self.IMMUTABLE_FIELDS]
            stored = type(self)._base_manager.filter(pk=self.pk).values(*attnames).first()
            if stored is not None:
                changed = [
                    name
                    for name, attname in zip(self.IMMUTABLE_FIELDS, attnames, strict=True)
                    if stored[attname] != getattr(self, attname)
                ]
                if changed:
                    message = "Ce champ ne peut pas être modifié après la création."
                    raise ValidationError({name: message for name in changed})
        super().save(*args, **kwargs)
