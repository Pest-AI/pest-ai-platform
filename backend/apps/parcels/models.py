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

import uuid

from django.conf import settings
from django.contrib.gis.db import models
from django.core.exceptions import ValidationError
from django.db.models import Q

from apps.core.models import ArchivableModel, BaseModel, ImmutableFieldsMixin, SyncModel
from apps.parcels import agroid as agroid_format
from apps.parcels import site_referentials as ref
from apps.parcels import soil_parameters as soil_ref


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
    import_batch = models.ForeignKey(
        "parcels.ParcelImport",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="parcels",
        editable=False,
        help_text="Import de fichier qui a créé la parcelle (J15b), le cas échéant.",
    )

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
    MANUAL_COORDINATES = "manual_coordinates", "Coordonnées saisies"
    IMPORT_GEOJSON = "import_geojson", "Import GeoJSON"
    IMPORT_KML = "import_kml", "Import KML"
    IMPORT_SHAPEFILE = "import_shapefile", "Import Shapefile"
    IMPORT_CSV = "import_csv", "Import CSV"
    IMPORT_XLSX = "import_xlsx", "Import Excel"
    IMPORT_JSON = "import_json", "Import JSON"
    IMPORT_GPX = "import_gpx", "Import GPX"


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


# ── Relations foncières et accès (J12, MVP-37) ───────────────────────────
#
# Règles communes (F-09, D-06, D-07) :
# - propriété et exploitation sont deux relations distinctes : l'une ne vaut jamais l'autre ;
# - chaque relation est datée ; un changement clôt la ligne (end_date) et en crée une nouvelle :
#   l'historique n'est jamais écrasé ni supprimé (PostgreSQL refuse la suppression) ;
# - aucune de ces relations n'ouvre d'accès : la visibilité vient uniquement de
#   ParcelOrganizationLink (organisations) et de ProducerParcelAccess (espace personnel).


class TenureType(models.TextChoices):
    TITLED_PROPERTY = "titled_property", "Titre foncier"
    COMMUNAL_ALLOCATION = "communal_allocation", "Affectation communale (domaine national)"
    CUSTOMARY_RIGHT = "customary_right", "Droit coutumier"
    FAMILY_LAND = "family_land", "Terre familiale"
    LEASE = "lease", "Bail"
    COMMUNAL = "communal", "Terre communautaire"
    OTHER = "other", "Autre"
    UNKNOWN = "unknown", "Inconnu"


class OwnershipVerification(models.TextChoices):
    DECLARED = "declared", "Déclarée"
    DOCUMENTED = "documented", "Justifiée par un document"
    DISPUTED = "disputed", "Contestée"


def _one_recorder():
    return Q(recorded_by_organization__isnull=False, recorded_by_producer__isnull=True) | Q(
        recorded_by_organization__isnull=True, recorded_by_producer__isnull=False
    )


def _period_ok():
    return Q(end_date__isnull=True) | Q(end_date__gte=models.F("start_date"))


class ParcelOwnership(ImmutableFieldsMixin, BaseModel, SyncModel):
    """Propriété ou droit foncier sur une parcelle, historisé (BASE, SYNC)."""

    Tenure = TenureType
    Verification = OwnershipVerification

    IMMUTABLE_FIELDS = (
        "parcel",
        "owner_producer",
        "owner_organization",
        "owner_name",
        "tenure_type",
        "share_percent",
        "start_date",
        "recorded_by_organization",
        "recorded_by_producer",
    )

    parcel = models.ForeignKey(Parcel, on_delete=models.PROTECT, related_name="ownerships")
    owner_producer = models.ForeignKey(
        "actors.Producer", null=True, blank=True, on_delete=models.PROTECT, related_name="+"
    )
    owner_organization = models.ForeignKey(
        "organizations.Organization",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="+",
    )
    owner_name = models.CharField(max_length=200, blank=True, default="")
    tenure_type = models.CharField(max_length=32, choices=TenureType.choices)
    share_percent = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    verification_status = models.CharField(
        max_length=32, choices=OwnershipVerification.choices, default=OwnershipVerification.DECLARED
    )
    recorded_by_organization = models.ForeignKey(
        "organizations.Organization",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="+",
    )
    recorded_by_producer = models.ForeignKey(
        "actors.Producer", null=True, blank=True, on_delete=models.PROTECT, related_name="+"
    )
    notes = models.TextField(blank=True, default="")

    class Meta:
        db_table = "parcels_ownership"
        verbose_name = "propriété de parcelle"
        verbose_name_plural = "propriétés de parcelles"
        constraints = [
            models.CheckConstraint(condition=_one_recorder(), name="ownership_one_recorder"),
            # Exactement un propriétaire : producteur, organisation ou nom déclaré (D-07).
            models.CheckConstraint(
                condition=(
                    Q(owner_producer__isnull=False, owner_organization__isnull=True, owner_name="")
                    | Q(
                        owner_producer__isnull=True, owner_organization__isnull=False, owner_name=""
                    )
                    | Q(owner_producer__isnull=True, owner_organization__isnull=True)
                    & ~Q(owner_name="")
                ),
                name="ownership_one_owner",
            ),
            models.CheckConstraint(condition=_period_ok(), name="ownership_period_order"),
            models.CheckConstraint(
                condition=Q(tenure_type__in=TenureType.values), name="ownership_tenure_valid"
            ),
            models.CheckConstraint(
                condition=Q(verification_status__in=OwnershipVerification.values),
                name="ownership_verification_valid",
            ),
            models.CheckConstraint(
                condition=Q(share_percent__isnull=True)
                | Q(share_percent__gt=0, share_percent__lte=100),
                name="ownership_share_range",
            ),
        ]
        indexes = [
            models.Index(
                fields=["parcel"], condition=Q(end_date__isnull=True), name="ownership_current_idx"
            ),
            models.Index(fields=["owner_producer"], name="ownership_owner_idx"),
        ]

    @property
    def is_current(self) -> bool:
        return self.end_date is None


class OperatorRole(models.TextChoices):
    PRIMARY = "primary", "Exploitant principal"
    CO_OPERATOR = "co_operator", "Co-exploitant"


class ArrangementType(models.TextChoices):
    OWNER_OPERATED = "owner_operated", "Exploitée par le propriétaire"
    RENTAL = "rental", "Location"
    SHARECROPPING = "sharecropping", "Métayage"
    LOAN = "loan", "Prêt"
    OTHER = "other", "Autre"
    UNKNOWN = "unknown", "Inconnu"


class RentType(models.TextChoices):
    """Contrepartie d'une location, d'un métayage ou d'un prêt (J18d)."""

    CASH = "cash", "En argent"
    HARVEST_SHARE = "harvest_share", "Part de la récolte"
    IN_KIND = "in_kind", "En nature"
    FREE = "free", "Gratuit"
    UNKNOWN = "unknown", "Ne sait pas"


class OperatorVerification(models.TextChoices):
    DECLARED = "declared", "Déclarée"
    CONFIRMED_BY_ORGANIZATION = "confirmed_by_organization", "Confirmée par l'organisation"
    DISPUTED = "disputed", "Contestée"


class ParcelOperatorAssignment(ImmutableFieldsMixin, BaseModel, SyncModel):
    """Exploitant effectif d'une parcelle, historisé (BASE, SYNC). D-06 : un seul principal."""

    Role = OperatorRole
    Arrangement = ArrangementType
    Verification = OperatorVerification

    IMMUTABLE_FIELDS = (
        "parcel",
        "producer",
        "operator_role",
        "arrangement_type",
        "start_date",
        "recorded_by_organization",
        "recorded_by_producer",
    )

    parcel = models.ForeignKey(Parcel, on_delete=models.PROTECT, related_name="operators")
    producer = models.ForeignKey("actors.Producer", on_delete=models.PROTECT, related_name="+")
    operator_role = models.CharField(max_length=32, choices=OperatorRole.choices)
    arrangement_type = models.CharField(
        max_length=32, choices=ArrangementType.choices, default=ArrangementType.UNKNOWN
    )
    verification_status = models.CharField(
        max_length=32, choices=OperatorVerification.choices, default=OperatorVerification.DECLARED
    )
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    recorded_by_organization = models.ForeignKey(
        "organizations.Organization",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="+",
    )
    recorded_by_producer = models.ForeignKey(
        "actors.Producer", null=True, blank=True, on_delete=models.PROTECT, related_name="+"
    )
    # Conditions d'exploitation (J18d) : location, métayage ou prêt.
    rent_type = models.CharField(max_length=32, choices=RentType.choices, blank=True, default="")
    rent_amount_xof = models.PositiveIntegerField(
        null=True, blank=True, help_text="Loyer en FCFA par campagne (en argent)."
    )
    harvest_share_percent = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True
    )
    agreement_end_date = models.DateField(
        null=True, blank=True, help_text="Fin de l'accord, si connue."
    )

    class Meta:
        db_table = "parcels_operator_assignment"
        verbose_name = "exploitant de parcelle"
        verbose_name_plural = "exploitants de parcelles"
        constraints = [
            models.UniqueConstraint(
                fields=["parcel"],
                condition=Q(end_date__isnull=True, operator_role="primary"),
                name="operator_one_primary",
            ),
            models.UniqueConstraint(
                fields=["parcel", "producer"],
                condition=Q(end_date__isnull=True),
                name="operator_once_per_parcel",
            ),
            models.CheckConstraint(condition=_one_recorder(), name="operator_one_recorder"),
            models.CheckConstraint(condition=_period_ok(), name="operator_period_order"),
            models.CheckConstraint(
                condition=Q(operator_role__in=OperatorRole.values), name="operator_role_valid"
            ),
            models.CheckConstraint(
                condition=Q(arrangement_type__in=ArrangementType.values),
                name="operator_arrangement_valid",
            ),
            models.CheckConstraint(
                condition=Q(rent_type__in=["", *RentType.values]), name="operator_rent_type_valid"
            ),
            models.CheckConstraint(
                condition=Q(harvest_share_percent__isnull=True)
                | Q(harvest_share_percent__gt=0, harvest_share_percent__lte=100),
                name="operator_harvest_share_range",
            ),
            models.CheckConstraint(
                condition=Q(verification_status__in=OperatorVerification.values),
                name="operator_verification_valid",
            ),
            # Une déclaration du producteur reste « declared » tant qu'aucune organisation ne
            # l'a confirmée : il ne peut pas se la confirmer lui-même.
            models.CheckConstraint(
                condition=Q(recorded_by_producer__isnull=True)
                | ~Q(verification_status="confirmed_by_organization"),
                name="operator_self_not_confirmed",
            ),
        ]
        indexes = [
            models.Index(
                fields=["producer"], condition=Q(end_date__isnull=True), name="operator_current_idx"
            ),
        ]


class LinkType(models.TextChoices):
    REGISTERING = "registering", "Organisation d'enregistrement"
    SUPPORTING = "supporting", "Organisation d'accompagnement"


class LinkStatus(models.TextChoices):
    PENDING_PRODUCER_CONSENT = "pending_producer_consent", "En attente de l'accord du producteur"
    ACTIVE = "active", "Actif"
    ENDED = "ended", "Terminé"


class ParcelOrganizationLink(ImmutableFieldsMixin, BaseModel):
    """Organisation qui suit une parcelle, historisée (BASE). Seule source de visibilité
    d'une parcelle pour une organisation."""

    Type = LinkType
    Status = LinkStatus

    IMMUTABLE_FIELDS = ("parcel", "organization", "link_type", "start_date", "granted_by")

    parcel = models.ForeignKey(Parcel, on_delete=models.PROTECT, related_name="organization_links")
    organization = models.ForeignKey(
        "organizations.Organization", on_delete=models.PROTECT, related_name="parcel_links"
    )
    link_type = models.CharField(max_length=32, choices=LinkType.choices)
    status = models.CharField(max_length=32, choices=LinkStatus.choices)
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    granted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+"
    )
    consented_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    consented_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "parcels_organization_link"
        verbose_name = "lien parcelle – organisation"
        verbose_name_plural = "liens parcelles – organisations"
        constraints = [
            models.UniqueConstraint(
                fields=["parcel", "organization"],
                condition=Q(end_date__isnull=True),
                name="parcel_link_one_open",
            ),
            models.CheckConstraint(condition=_period_ok(), name="parcel_link_period_order"),
            models.CheckConstraint(
                condition=Q(link_type__in=LinkType.values), name="parcel_link_type_valid"
            ),
            models.CheckConstraint(
                condition=Q(status__in=LinkStatus.values), name="parcel_link_status_valid"
            ),
            # Un lien terminé a une date de fin, et inversement.
            models.CheckConstraint(
                condition=Q(status="ended", end_date__isnull=False)
                | ~Q(status="ended") & Q(end_date__isnull=True),
                name="parcel_link_ended_has_end",
            ),
        ]
        indexes = [
            models.Index(
                fields=["organization"],
                condition=Q(end_date__isnull=True),
                name="parcel_link_org_open_idx",
            ),
        ]


class AccessLevel(models.TextChoices):
    VIEW = "view", "Consultation"
    MANAGE = "manage", "Gestion"


class AccessBasis(models.TextChoices):
    SELF_REGISTERED = "self_registered", "Parcelle déclarée par le producteur"
    GRANTED_BY_ORGANIZATION = "granted_by_organization", "Accordé par une organisation"
    VERIFIED_CLAIM = "verified_claim", "Revendication vérifiée (hors MVP)"


class ProducerParcelAccess(ImmutableFieldsMixin, BaseModel):
    """Accès PERSONNEL d'un producteur à une parcelle (BASE). Explicite, historisé, révocable.
    N'ouvre aucun accès aux données de l'espace d'une organisation (D-02)."""

    Level = AccessLevel
    Basis = AccessBasis

    IMMUTABLE_FIELDS = (
        "producer",
        "parcel",
        "access_level",
        "basis",
        "granted_by_organization",
        "granted_by",
        "start_date",
    )

    producer = models.ForeignKey(
        "actors.Producer", on_delete=models.PROTECT, related_name="parcel_accesses"
    )
    parcel = models.ForeignKey(Parcel, on_delete=models.PROTECT, related_name="personal_accesses")
    access_level = models.CharField(max_length=32, choices=AccessLevel.choices)
    basis = models.CharField(max_length=32, choices=AccessBasis.choices)
    granted_by_organization = models.ForeignKey(
        "organizations.Organization",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="+",
    )
    granted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+"
    )
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    revocation_reason = models.TextField(blank=True, default="")

    class Meta:
        db_table = "parcels_producer_access"
        verbose_name = "accès personnel à une parcelle"
        verbose_name_plural = "accès personnels aux parcelles"
        constraints = [
            models.UniqueConstraint(
                fields=["producer", "parcel"],
                condition=Q(end_date__isnull=True),
                name="producer_access_one_open",
            ),
            models.CheckConstraint(
                condition=~Q(basis="granted_by_organization")
                | Q(granted_by_organization__isnull=False),
                name="producer_access_org_basis",
            ),
            models.CheckConstraint(condition=_period_ok(), name="producer_access_period_order"),
            models.CheckConstraint(
                condition=Q(access_level__in=AccessLevel.values),
                name="producer_access_level_valid",
            ),
            models.CheckConstraint(
                condition=Q(basis__in=AccessBasis.values), name="producer_access_basis_valid"
            ),
        ]
        indexes = [
            models.Index(
                fields=["producer"],
                condition=Q(end_date__isnull=True),
                name="producer_access_open_idx",
            ),
            models.Index(fields=["parcel"], name="producer_access_parcel_idx"),
        ]


class ParcelSiteProfile(ImmutableFieldsMixin, BaseModel, SyncModel):
    """Profil de site d'une parcelle : sol, eau et irrigation, accès (J18d, addendum v2.3).

    Historisé : chaque mise à jour ajoute une version complète ; la plus récente est le
    profil courant. Une version ne se modifie ni ne se supprime (garanti par PostgreSQL).
    """

    Evidence = ref.Evidence
    IMMUTABLE_FIELDS = (
        "parcel",
        *ref.SITE_FIELDS,
        "scheme_name",
        "distance_to_village_km",
        "other_detail",
        "evidence",
        "observed_on",
        "recorded_by_organization",
        "recorded_by_producer",
        "notes",
    )

    parcel = models.ForeignKey(Parcel, on_delete=models.PROTECT, related_name="site_profiles")
    soil_local_type = models.CharField(max_length=32, blank=True, default="")
    soil_texture = models.CharField(max_length=32, blank=True, default="")
    salinity = models.CharField(max_length=32, blank=True, default="")
    flooding = models.CharField(max_length=32, blank=True, default="")
    slope = models.CharField(max_length=32, blank=True, default="")
    perceived_fertility = models.CharField(max_length=32, blank=True, default="")
    water_regime = models.CharField(max_length=32, blank=True, default="")
    water_source = models.CharField(max_length=32, blank=True, default="")
    irrigation_method = models.CharField(max_length=32, blank=True, default="")
    scheme_type = models.CharField(max_length=32, blank=True, default="")
    scheme_name = models.CharField(
        max_length=150, blank=True, default="", help_text="Périmètre, casier ou maille."
    )
    pump_access = models.CharField(max_length=32, blank=True, default="")
    water_availability = models.CharField(max_length=32, blank=True, default="")
    road_access = models.CharField(max_length=32, blank=True, default="")
    distance_to_village_km = models.DecimalField(
        max_digits=5, decimal_places=1, null=True, blank=True
    )
    other_detail = models.CharField(
        max_length=200, blank=True, default="", help_text="Précision quand « Autre » est choisi."
    )
    evidence = models.CharField(max_length=32, choices=ref.Evidence.choices)
    observed_on = models.DateField()
    recorded_by_organization = models.ForeignKey(
        "organizations.Organization",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="+",
    )
    recorded_by_producer = models.ForeignKey(
        "actors.Producer", null=True, blank=True, on_delete=models.PROTECT, related_name="+"
    )
    notes = models.TextField(blank=True, default="")

    class Meta:
        db_table = "parcels_site_profile"
        verbose_name = "profil de site de parcelle"
        verbose_name_plural = "profils de site de parcelles"
        constraints = [
            models.CheckConstraint(condition=_one_recorder(), name="site_one_recorder"),
            models.CheckConstraint(
                condition=Q(evidence__in=ref.Evidence.values), name="site_evidence_valid"
            ),
            models.CheckConstraint(
                condition=Q(distance_to_village_km__isnull=True)
                | Q(distance_to_village_km__gte=0, distance_to_village_km__lte=500),
                name="site_distance_range",
            ),
            *[
                models.CheckConstraint(
                    condition=Q(**{f"{field}__in": ["", *choices.values]}),
                    name=f"site_{field}_valid",
                )
                for field, choices in ref.SITE_FIELDS.items()
            ],
        ]
        indexes = [models.Index(fields=["parcel", "-created_at"], name="site_parcel_recent_idx")]


class CultivationUnitStatus(models.TextChoices):
    ACTIVE = "active", "Active"
    RETIRED = "retired", "Retirée"


class CultivationUnit(BaseModel, ArchivableModel, SyncModel):
    """Subdivision d'une parcelle consacrée à une culture (BASE, ARCH, SYNC). F-10, D-16 :
    au MVP, une unité est déclarée par son code et sa surface ; son contour est facultatif."""

    Status = CultivationUnitStatus

    parcel = models.ForeignKey(Parcel, on_delete=models.PROTECT, related_name="units")
    code = models.CharField(max_length=16)
    name = models.CharField(max_length=100, blank=True, default="")
    geometry = models.MultiPolygonField(srid=4326, null=True, blank=True)
    area_m2 = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    status = models.CharField(
        max_length=32, choices=CultivationUnitStatus.choices, default=CultivationUnitStatus.ACTIVE
    )
    valid_from = models.DateField(null=True, blank=True)
    valid_to = models.DateField(null=True, blank=True)

    class Meta:
        db_table = "parcels_cultivation_unit"
        verbose_name = "unité de culture"
        verbose_name_plural = "unités de culture"
        ordering = ["parcel", "code"]
        constraints = [
            models.UniqueConstraint(fields=["parcel", "code"], name="unit_code_per_parcel"),
            # Cible de la FK composite CropCycle (cultivation_unit, parcel) : une unité citée
            # par un cycle appartient forcément à la parcelle du cycle (J16).
            models.UniqueConstraint(fields=["id", "parcel"], name="unit_id_parcel"),
            models.CheckConstraint(
                condition=Q(status__in=CultivationUnitStatus.values), name="unit_status_valid"
            ),
            models.CheckConstraint(
                condition=Q(area_m2__isnull=True) | Q(area_m2__gt=0), name="unit_area_positive"
            ),
            models.CheckConstraint(
                condition=Q(valid_to__isnull=True)
                | Q(valid_from__isnull=True)
                | Q(valid_to__gte=models.F("valid_from")),
                name="unit_period_order",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.parcel} · {self.code}"


# ── Import de parcelles par fichier (J15b) ───────────────────────────────


class ImportFormat(models.TextChoices):
    KML = "kml", "KML"
    KMZ = "kmz", "KMZ"
    SHAPEFILE = "shapefile", "Shapefile (.zip)"
    GEOJSON = "geojson", "GeoJSON"
    CSV = "csv", "CSV"
    XLSX = "xlsx", "Excel (.xlsx)"
    JSON = "json", "JSON"
    GPX = "gpx", "GPX"


class ImportStatus(models.TextChoices):
    PREVIEWED = "previewed", "Aperçu (rien n'est encore créé)"
    COMMITTED = "committed", "Importé"
    DISCARDED = "discarded", "Abandonné"


class ParcelImport(BaseModel):
    """Import d'un fichier de parcelles (BASE) : aperçu d'abord, création à la confirmation.

    Le fichier n'est pas conservé (seulement son nom, sa taille et son empreinte SHA-256) ;
    les entités lues sont gardées le temps de l'aperçu. Jamais supprimé : trace de qui a
    importé quoi, et quelles parcelles en sont issues (`parcels`).
    """

    Format = ImportFormat
    Status = ImportStatus

    organization = models.ForeignKey(
        "organizations.Organization", on_delete=models.PROTECT, related_name="parcel_imports"
    )
    file_name = models.CharField(max_length=255)
    file_format = models.CharField(max_length=16, choices=ImportFormat.choices)
    file_size = models.PositiveIntegerField()
    file_sha256 = models.CharField(max_length=64)
    status = models.CharField(
        max_length=16, choices=ImportStatus.choices, default=ImportStatus.PREVIEWED
    )
    columns = models.JSONField(default=list, help_text="Attributs trouvés dans le fichier.")
    mapping = models.JSONField(default=dict, help_text="Colonnes retenues (nom, exploitant).")
    features = models.JSONField(
        default=list, help_text="Entités lues (géométrie EWKT et attributs), le temps de l'aperçu."
    )
    producer_rows = models.JSONField(
        default=list,
        help_text="Modèle « Coopérative » (J15d) : lignes de l'onglet Producteurs, le temps de "
        "l'aperçu.",
    )
    summary = models.JSONField(default=dict)
    committed_at = models.DateTimeField(null=True, blank=True)
    committed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="+",
    )
    parcels_created = models.PositiveIntegerField(default=0)
    producers_created = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "parcels_import"
        verbose_name = "import de parcelles"
        verbose_name_plural = "imports de parcelles"
        ordering = ["-created_at"]
        constraints = [
            models.CheckConstraint(
                condition=Q(file_format__in=ImportFormat.values), name="parcel_import_format"
            ),
            models.CheckConstraint(
                condition=Q(status__in=ImportStatus.values), name="parcel_import_status"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.file_name} ({self.get_status_display()})"


class SoilTest(BaseModel, SyncModel):
    """Mesure du sol sur une parcelle (J20c) : kit de terrain de l'agent, laboratoire ou
    capteur. Historisée : chaque mesure s'ajoute, aucune ne se modifie ni ne se supprime
    (garanti par PostgreSQL). Les valeurs sont dans `SoilTestValue`, une par paramètre."""

    Method = soil_ref.SoilTestMethod

    parcel = models.ForeignKey(Parcel, on_delete=models.PROTECT, related_name="soil_tests")
    cultivation_unit = models.ForeignKey(
        "parcels.CultivationUnit",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="soil_tests",
    )
    method = models.CharField(max_length=32, choices=soil_ref.SoilTestMethod.choices)
    device_model = models.CharField(
        max_length=100, blank=True, default="", help_text="Modèle du kit ou du capteur."
    )
    measured_at = models.DateTimeField()
    depth_cm = models.PositiveSmallIntegerField(
        null=True, blank=True, help_text="Profondeur de la sonde ou du prélèvement."
    )
    position = models.PointField(srid=4326, null=True, blank=True)
    recorded_by_organization = models.ForeignKey(
        "organizations.Organization",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="+",
    )
    recorded_by_producer = models.ForeignKey(
        "actors.Producer", null=True, blank=True, on_delete=models.PROTECT, related_name="+"
    )
    notes = models.TextField(blank=True, default="")

    class Meta:
        db_table = "parcels_soil_test"
        verbose_name = "mesure du sol"
        verbose_name_plural = "mesures du sol"
        constraints = [
            models.CheckConstraint(condition=_one_recorder(), name="soil_test_one_recorder"),
            models.CheckConstraint(
                condition=Q(method__in=soil_ref.SoilTestMethod.values),
                name="soil_test_method_valid",
            ),
            models.CheckConstraint(
                condition=Q(depth_cm__isnull=True) | Q(depth_cm__lte=200),
                name="soil_test_depth_range",
            ),
        ]
        indexes = [
            models.Index(fields=["parcel", "-measured_at"], name="soil_test_parcel_recent_idx")
        ]


class SoilTestValue(models.Model):
    """Valeur d'un paramètre pour une mesure du sol ; unité fixée par le référentiel."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    soil_test = models.ForeignKey(SoilTest, on_delete=models.PROTECT, related_name="values")
    parameter = models.CharField(max_length=32)
    value = models.DecimalField(max_digits=10, decimal_places=3)
    unit = models.CharField(max_length=16, blank=True, default="")

    class Meta:
        db_table = "parcels_soil_test_value"
        verbose_name = "valeur mesurée du sol"
        constraints = [
            models.UniqueConstraint(fields=["soil_test", "parameter"], name="soil_value_once"),
        ]
        # Paramètre contrôlé par le service (référentiel) : un nouveau paramètre ne demande pas
        # de migration.
