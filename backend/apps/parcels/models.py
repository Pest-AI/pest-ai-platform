"""Domaine Parcelles (Database Design v2.2, domaine 4 « Parcelles, AgroID et géographie »).

- `Parcel` : parcelle identifiée par un AgroID permanent (F-08, D-05). Elle ne porte ni
  propriétaire ni exploitant : ce sont des relations historisées séparées (J12).
- `ParcelGeometry` : versions successives du contour. Toute modification crée une version ;
  une seule est « courante » ; aucune n'est modifiée ni supprimée (append-only).

Garanties tenues par PostgreSQL lui-même (migration 0002), en plus du code :
- un AgroID attribué ne change jamais et une parcelle n'est jamais supprimée : un AgroID
  ne peut donc jamais être réattribué ;
- une version de géométrie n'est jamais supprimée et son contour ne change jamais ;
- contour valide (ST_IsValid) en WGS 84 (SRID 4326).

Reportés :
- `administrative_zone`, `agroecological_zone` (FK vers `geo.GeographicZone`) avec l'app `geo` ;
- `source_device` (mixin SYNC) au J18 avec le modèle Device ;
- propriété, exploitation, liens aux organisations et accès personnels au J12.
"""

from __future__ import annotations

from django.conf import settings
from django.contrib.gis.db import models
from django.core.exceptions import ValidationError
from django.db.models import Q

from apps.core.models import ArchivableModel, BaseModel, ImmutableFieldsMixin, SyncModel
from apps.parcels import agroid as agroid_format


class ParcelRegistrationChannel(models.TextChoices):
    ORGANIZATION = "organization", "Enregistrée par une organisation"
    PRODUCER_SELF = "producer_self", "Déclarée par le producteur"


class ParcelStatus(models.TextChoices):
    DRAFT = "draft", "Brouillon (hors ligne, sans AgroID)"
    PENDING_VALIDATION = "pending_validation", "En attente de validation"
    ACTIVE = "active", "Active"
    RETIRED = "retired", "Retirée (AgroID conservé)"


class Parcel(BaseModel, ArchivableModel, SyncModel):
    """Parcelle agricole (BASE, ARCH, SYNC). Jamais supprimée physiquement."""

    Channel = ParcelRegistrationChannel
    Status = ParcelStatus

    agroid = models.CharField(
        max_length=15,
        null=True,
        blank=True,
        editable=False,
        help_text="PAI-SN-XXXXXXXX. Attribué par le serveur, jamais modifié ni réutilisé.",
    )
    agroid_assigned_at = models.DateTimeField(null=True, blank=True, editable=False)
    country_code = models.CharField(max_length=2, default="SN")
    local_name = models.CharField(max_length=150, blank=True, default="")
    registration_channel = models.CharField(
        max_length=32, choices=ParcelRegistrationChannel.choices
    )
    registered_by_organization = models.ForeignKey(
        "organizations.Organization",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="+",
    )
    registered_by_producer = models.ForeignKey(
        "actors.Producer",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="+",
    )
    status = models.CharField(
        max_length=32, choices=ParcelStatus.choices, default=ParcelStatus.DRAFT
    )
    # Dénormalisés depuis la géométrie courante (lecture rapide, filtres de carte).
    current_area_m2 = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    centroid = models.PointField(srid=4326, null=True, blank=True)

    class Meta:
        db_table = "parcels_parcel"
        verbose_name = "parcelle"
        verbose_name_plural = "parcelles"
        constraints = [
            models.UniqueConstraint(
                fields=["agroid"],
                condition=Q(agroid__isnull=False),
                name="parcel_agroid_uniq",
            ),
            models.CheckConstraint(
                condition=Q(agroid__isnull=True) | Q(agroid__regex=agroid_format.PATTERN),
                name="parcel_agroid_format",
            ),
            models.CheckConstraint(
                condition=Q(country_code__regex=r"^[A-Z]{2}$"), name="parcel_country_code"
            ),
            models.CheckConstraint(
                condition=Q(status__in=ParcelStatus.values), name="parcel_status_valid"
            ),
            models.CheckConstraint(
                condition=Q(registration_channel__in=ParcelRegistrationChannel.values),
                name="parcel_channel_valid",
            ),
            # Une parcelle active ou retirée a toujours son AgroID.
            models.CheckConstraint(
                condition=~Q(status__in=["active", "retired"]) | Q(agroid__isnull=False),
                name="parcel_active_has_agroid",
            ),
            # Exactement une origine, cohérente avec le canal d'enregistrement.
            models.CheckConstraint(
                condition=(
                    Q(
                        registration_channel="organization",
                        registered_by_organization__isnull=False,
                        registered_by_producer__isnull=True,
                    )
                    | Q(
                        registration_channel="producer_self",
                        registered_by_organization__isnull=True,
                        registered_by_producer__isnull=False,
                    )
                ),
                name="parcel_registration_origin",
            ),
            models.CheckConstraint(
                condition=Q(current_area_m2__isnull=True) | Q(current_area_m2__gt=0),
                name="parcel_area_positive",
            ),
        ]
        indexes = [
            models.Index(fields=["status"], name="parcel_status_idx"),
            models.Index(fields=["registered_by_organization"], name="parcel_reg_org_idx"),
        ]

    def __str__(self) -> str:
        return self.agroid or f"Brouillon {str(self.id)[:8]}"

    def save(self, *args, **kwargs):
        # Contrôle applicatif ; PostgreSQL refuse aussi (trigger, migration 0002).
        if not self._state.adding:
            stored = type(self)._base_manager.filter(pk=self.pk).values_list("agroid", flat=True)
            stored = stored.first()
            if stored and stored != self.agroid:
                raise ValidationError({"agroid": "Un AgroID attribué ne peut jamais changer."})
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError("Une parcelle n'est jamais supprimée : retirez-la (AgroID conservé).")


class CaptureMethod(models.TextChoices):
    GPS_WALK = "gps_walk", "Contour marché au GPS"
    GPS_POINTS = "gps_points", "Points GPS"
    MANUAL_DRAWING = "manual_drawing", "Tracé sur la carte"
    IMPORT_GEOJSON = "import_geojson", "Import GeoJSON"
    IMPORT_KML = "import_kml", "Import KML"


class GeometryValidationStatus(models.TextChoices):
    PENDING = "pending", "À contrôler"
    VALID = "valid", "Valide"
    FLAGGED = "flagged", "Signalée"
    REJECTED = "rejected", "Refusée"


class ParcelGeometry(ImmutableFieldsMixin, BaseModel, SyncModel):
    """Version du contour d'une parcelle (BASE, SYNC). Append-only."""

    CaptureMethod = CaptureMethod
    ValidationStatus = GeometryValidationStatus

    IMMUTABLE_FIELDS = (
        "parcel",
        "version",
        "geometry",
        "area_m2",
        "perimeter_m",
        "centroid",
        "capture_method",
        "gps_accuracy_m",
        "captured_by",
        "captured_at",
    )

    parcel = models.ForeignKey(Parcel, on_delete=models.PROTECT, related_name="geometries")
    version = models.PositiveIntegerField()
    geometry = models.MultiPolygonField(srid=4326)
    area_m2 = models.DecimalField(max_digits=14, decimal_places=2)
    perimeter_m = models.DecimalField(max_digits=12, decimal_places=2)
    centroid = models.PointField(srid=4326)
    capture_method = models.CharField(max_length=32, choices=CaptureMethod.choices)
    gps_accuracy_m = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    captured_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+"
    )
    captured_at = models.DateTimeField()
    validation_status = models.CharField(
        max_length=32,
        choices=GeometryValidationStatus.choices,
        default=GeometryValidationStatus.PENDING,
    )
    validation_report = models.JSONField(null=True, blank=True)
    validated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    validated_at = models.DateTimeField(null=True, blank=True)
    is_current = models.BooleanField(default=False)
    valid_from = models.DateTimeField(null=True, blank=True)
    valid_to = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "parcels_parcel_geometry"
        verbose_name = "géométrie de parcelle"
        verbose_name_plural = "géométries de parcelles"
        ordering = ["parcel", "-version"]
        constraints = [
            models.UniqueConstraint(fields=["parcel", "version"], name="parcel_geom_version_uniq"),
            models.UniqueConstraint(
                fields=["parcel"],
                condition=Q(is_current=True),
                name="parcel_geom_one_current",
            ),
            models.CheckConstraint(condition=Q(version__gte=1), name="parcel_geom_version_pos"),
            models.CheckConstraint(condition=Q(area_m2__gt=0), name="parcel_geom_area_positive"),
            models.CheckConstraint(
                condition=Q(capture_method__in=CaptureMethod.values),
                name="parcel_geom_capture_valid",
            ),
            models.CheckConstraint(
                condition=Q(validation_status__in=GeometryValidationStatus.values),
                name="parcel_geom_status_valid",
            ),
            models.CheckConstraint(
                condition=Q(gps_accuracy_m__isnull=True) | Q(gps_accuracy_m__gte=0),
                name="parcel_geom_accuracy_pos",
            ),
            models.CheckConstraint(
                condition=Q(valid_to__isnull=True)
                | Q(valid_from__isnull=True)
                | Q(valid_to__gte=models.F("valid_from")),
                name="parcel_geom_period_order",
            ),
        ]
        indexes = [
            models.Index(fields=["parcel", "is_current"], name="parcel_geom_current_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.parcel} v{self.version}"

    def delete(self, *args, **kwargs):
        raise ValidationError("Une version de géométrie n'est jamais supprimée.")
