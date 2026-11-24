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
| SPACE                | SpaceModel            | J16, avec les campagnes |
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

    def for_workspace(self, workspace):
        """Lignes de l'espace du contexte vérifié (modèles SPACE uniquement) : l'organisation
        active, ou le producteur de l'espace personnel. Jamais l'autre espace."""
        if workspace.kind == "personal":
            return self.filter(personal_producer=workspace.producer, organization__isnull=True)
        return self.filter(organization=workspace.organization, personal_producer__isnull=True)

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


SPACE_FORBID_CHANGE_SQL = """
CREATE OR REPLACE FUNCTION core_space_forbid_change() RETURNS trigger AS $$
BEGIN
    IF NEW.organization_id IS DISTINCT FROM OLD.organization_id
       OR NEW.personal_producer_id IS DISTINCT FROM OLD.personal_producer_id THEN
        RAISE EXCEPTION 'L''espace d''un enregistrement ne peut pas changer (%).', TG_TABLE_NAME
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
"""


def space_trigger_sql(table: str) -> tuple[str, str]:
    """Trigger commun d'immutabilité de l'espace (Design v2.2) pour une table SPACE :
    (SQL d'installation, SQL de retrait) à passer à `migrations.RunSQL`."""
    name = f"{table}_space_immutable"
    return (
        SPACE_FORBID_CHANGE_SQL + f"CREATE TRIGGER {name} BEFORE UPDATE ON {table} "
        "FOR EACH ROW EXECUTE FUNCTION core_space_forbid_change();",
        f"DROP TRIGGER IF EXISTS {name} ON {table};",
    )


def space_foreign_key_sql(table: str, column: str, target: str) -> tuple[str, str]:
    """Clé étrangère composite d'espace (Design v2.2, T-01) : `table.column` ne peut viser
    qu'une ligne du même espace (`(column, space_key) → target(id, space_key)`)."""
    name = f"{table}_{column}_same_space"[:63]
    return (
        f"ALTER TABLE {table} ADD CONSTRAINT {name} FOREIGN KEY ({column}, space_key) "
        f"REFERENCES {target} (id, space_key) DEFERRABLE INITIALLY IMMEDIATE;",
        f"ALTER TABLE {table} DROP CONSTRAINT IF EXISTS {name};",
    )


class SpaceModel(models.Model):
    """Mixin SPACE : espace de données, organisation OU espace personnel d'un producteur.

    - exactement un des deux champs est renseigné (CHECK), par le serveur, à partir du
      contexte X-Workspace vérifié, jamais à partir du corps de la requête ;
    - l'espace ne change jamais (contrôle applicatif ci-dessous + trigger PostgreSQL commun,
      à installer par chaque table avec `space_trigger_sql`) ;
    - `space_key`, calculé par PostgreSQL (« org:<uuid> » ou « personal:<uuid> »), sert de second
      membre aux clés étrangères composites (`space_foreign_key_sql`) : un enregistrement ne
      peut référencer qu'un objet du même espace ;
    - les vues lisent via `Model.objects.for_workspace(request.workspace)`.

    Chaque modèle concret déclare, dans `Meta.constraints`, `space_constraints(name)`.
    """

    organization = models.ForeignKey(
        "organizations.Organization",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="+",
        editable=False,
    )
    personal_producer = models.ForeignKey(
        "actors.Producer",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="+",
        editable=False,
    )
    space_key = models.GeneratedField(
        expression=models.Case(
            models.When(
                organization__isnull=False,
                then=models.functions.Concat(
                    models.Value("org:"),
                    models.functions.Cast("organization", models.CharField(max_length=36)),
                ),
            ),
            default=models.functions.Concat(
                models.Value("personal:"),
                models.functions.Cast("personal_producer", models.CharField(max_length=36)),
            ),
        ),
        output_field=models.CharField(max_length=45),
        db_persist=True,
    )

    objects = CoreQuerySet.as_manager()

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        if not self._state.adding:
            stored = (
                type(self)
                ._base_manager.filter(pk=self.pk)
                .values_list("organization_id", "personal_producer_id")
                .first()
            )
            if stored is not None and stored != (self.organization_id, self.personal_producer_id):
                raise ValidationError("L'espace d'un enregistrement ne peut pas changer.")
        super().save(*args, **kwargs)

    @staticmethod
    def space_constraints(prefix: str, *, target: bool = False) -> list:
        """CHECK « un seul espace » et, pour une cible de FK composite, UNIQUE (id, space_key)."""
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(organization__isnull=False, personal_producer__isnull=True)
                    | models.Q(organization__isnull=True, personal_producer__isnull=False)
                ),
                name=f"{prefix}_one_space",
            )
        ]
        if target:
            constraints.append(
                models.UniqueConstraint(fields=["id", "space_key"], name=f"{prefix}_id_space")
            )
        return constraints

    def set_space(self, workspace) -> None:
        """Fixe l'espace à partir du contexte vérifié (création uniquement)."""
        if workspace.kind == "personal":
            self.organization, self.personal_producer = None, workspace.producer
        else:
            self.organization, self.personal_producer = workspace.organization, None


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
