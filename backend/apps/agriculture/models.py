"""Cultures, campagnes, cycles, opérations et récoltes (Database Design v2.2, app agriculture).

- Référentiels : `Crop` (5 cultures du MVP, D-12), `CropVariety`.
- Données d'un espace (mixin SPACE) : `AgriculturalCampaign`, `CropCycle`,
  `AgriculturalOperation`, `HarvestRecord`. Une campagne et un cycle sont deux notions
  distinctes (TAS §6.3.4) : une campagne regroupe des cycles d'un même espace.
- Isolation garantie par PostgreSQL (v2.2, T-01) : clés étrangères composites
  `(x_id, space_key)` entre ces tables, et espace immuable (trigger commun).

Points d'extension prévus par le Design, non créés au J16 (leurs apps n'existent pas encore) :
`AgriculturalCampaign.program` (programmes), `AgriculturalOperation.product` (catalogue),
`source_device` (synchronisation, J18).
"""

from __future__ import annotations

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q

from apps.core.models import (
    ArchivableModel,
    BaseModel,
    ImmutableFieldsMixin,
    SpaceModel,
    SyncModel,
)

# ── Référentiels ─────────────────────────────────────────────────────────


class Crop(BaseModel):
    """Référentiel des cultures. MVP : riz, oignon, tomate, maïs, piment (is_ai_supported)."""

    code = models.CharField(
        max_length=32, unique=True, help_text="rice, onion, tomato, maize, chili…"
    )
    name_fr = models.CharField(max_length=100)
    name_wo = models.CharField(max_length=100, blank=True, default="", help_text="Nom en wolof.")
    name_ff = models.CharField(max_length=100, blank=True, default="", help_text="Nom en pulaar.")
    scientific_name = models.CharField(max_length=150, blank=True, default="")
    is_ai_supported = models.BooleanField(
        default=False, help_text="Vrai pour les 5 cultures du diagnostic MVP."
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "agriculture_crop"
        ordering = ["name_fr"]
        verbose_name = "culture"
        verbose_name_plural = "cultures"

    def __str__(self) -> str:
        return self.name_fr


class CropVariety(BaseModel):
    """Variété d'une culture (référentiel, saisi par l'équipe agronomique)."""

    crop = models.ForeignKey(Crop, on_delete=models.PROTECT, related_name="varieties")
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=32, blank=True, default="")
    cycle_days_min = models.PositiveIntegerField(null=True, blank=True)
    cycle_days_max = models.PositiveIntegerField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "agriculture_crop_variety"
        ordering = ["name"]
        verbose_name = "variété"
        verbose_name_plural = "variétés"
        constraints = [
            models.UniqueConstraint(fields=["crop", "name"], name="variety_name_per_crop"),
            models.CheckConstraint(
                condition=Q(cycle_days_min__isnull=True)
                | Q(cycle_days_max__isnull=True)
                | Q(cycle_days_max__gte=models.F("cycle_days_min")),
                name="variety_cycle_days_order",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.crop} — {self.name}"


# ── Campagnes ────────────────────────────────────────────────────────────


class SeasonType(models.TextChoices):
    """D-18 (validée) : libellés à faire relire par l'agronome."""

    RAINY = "rainy", "Hivernage"
    COLD_DRY = "cold_dry", "Contre-saison froide"
    HOT_DRY = "hot_dry", "Contre-saison chaude"
    OTHER = "other", "Autre"


class CampaignStatus(models.TextChoices):
    PLANNED = "planned", "Prévue"
    ACTIVE = "active", "En cours"
    CLOSED = "closed", "Clôturée"


class AgriculturalCampaign(BaseModel, ArchivableModel, SpaceModel):
    """Campagne agricole d'une organisation ou d'un producteur (période opérationnelle)."""

    Season = SeasonType
    Status = CampaignStatus

    name = models.CharField(max_length=150)
    season_type = models.CharField(max_length=32, choices=SeasonType.choices)
    year = models.PositiveIntegerField()
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    status = models.CharField(
        max_length=32, choices=CampaignStatus.choices, default=CampaignStatus.PLANNED
    )

    class Meta:
        db_table = "agriculture_campaign"
        ordering = ["-start_date", "name"]
        verbose_name = "campagne agricole"
        verbose_name_plural = "campagnes agricoles"
        constraints = [
            *SpaceModel.space_constraints("campaign", target=True),
            # Design : unicité (organization_id, name) ; même règle dans l'espace personnel.
            models.UniqueConstraint(
                fields=["organization", "name"],
                condition=Q(organization__isnull=False),
                name="campaign_name_per_org",
            ),
            models.UniqueConstraint(
                fields=["personal_producer", "name"],
                condition=Q(personal_producer__isnull=False),
                name="campaign_name_per_producer",
            ),
            models.CheckConstraint(
                condition=Q(season_type__in=SeasonType.values), name="campaign_season_valid"
            ),
            models.CheckConstraint(
                condition=Q(status__in=CampaignStatus.values), name="campaign_status_valid"
            ),
            models.CheckConstraint(
                condition=Q(year__gte=2000, year__lte=2100), name="campaign_year_range"
            ),
            models.CheckConstraint(
                condition=Q(end_date__isnull=True) | Q(end_date__gte=models.F("start_date")),
                name="campaign_period_order",
            ),
        ]
        indexes = [
            models.Index(fields=["organization", "status"], name="campaign_org_status"),
            models.Index(fields=["organization", "year"], name="campaign_org_year"),
        ]

    def __str__(self) -> str:
        return self.name


# ── Cycles ───────────────────────────────────────────────────────────────


class CropCycleStatus(models.TextChoices):
    PLANNED = "planned", "Prévu"
    IN_PROGRESS = "in_progress", "En cours"
    HARVESTED = "harvested", "Récolté"
    ABANDONED = "abandoned", "Abandonné"


class CropCycle(ImmutableFieldsMixin, BaseModel, ArchivableModel, SpaceModel, SyncModel):
    """Culture effectivement pratiquée sur une parcelle (ou une unité) pendant une période.

    D-17 : deux cycles peuvent se chevaucher (cultures associées) ; c'est signalé, jamais bloqué.
    """

    IMMUTABLE_FIELDS = ("parcel",)
    Status = CropCycleStatus

    parcel = models.ForeignKey(
        "parcels.Parcel", on_delete=models.PROTECT, related_name="crop_cycles"
    )
    cultivation_unit = models.ForeignKey(
        "parcels.CultivationUnit",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="crop_cycles",
        help_text="Doit appartenir à la même parcelle (garanti en base).",
    )
    campaign = models.ForeignKey(
        AgriculturalCampaign,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="crop_cycles",
        help_text="Même espace que le cycle (garanti en base).",
    )
    operator = models.ForeignKey(
        "actors.Producer",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="crop_cycles",
        help_text="Exploitant du cycle (copie de l'exploitant principal au démarrage).",
    )
    declared_crop = models.ForeignKey(Crop, on_delete=models.PROTECT, related_name="+")
    variety = models.ForeignKey(
        CropVariety, null=True, blank=True, on_delete=models.PROTECT, related_name="crop_cycles"
    )
    confirmed_crop = models.ForeignKey(
        Crop,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="+",
        help_text="Culture confirmée (agronome), si différente ou vérifiée.",
    )
    confirmed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    confirmed_at = models.DateTimeField(null=True, blank=True)
    planned_sowing_date = models.DateField(null=True, blank=True)
    sowing_date = models.DateField(null=True, blank=True)
    transplanting_date = models.DateField(null=True, blank=True)
    expected_harvest_date = models.DateField(null=True, blank=True)
    harvest_end_date = models.DateField(null=True, blank=True)
    declared_area_m2 = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    status = models.CharField(
        max_length=32, choices=CropCycleStatus.choices, default=CropCycleStatus.PLANNED
    )

    class Meta:
        db_table = "agriculture_crop_cycle"
        ordering = ["-created_at"]
        verbose_name = "cycle de culture"
        verbose_name_plural = "cycles de culture"
        constraints = [
            *SpaceModel.space_constraints("crop_cycle", target=True),
            models.CheckConstraint(
                condition=Q(status__in=CropCycleStatus.values), name="crop_cycle_status_valid"
            ),
            models.CheckConstraint(
                condition=Q(harvest_end_date__isnull=True)
                | Q(sowing_date__isnull=True)
                | Q(harvest_end_date__gte=models.F("sowing_date")),
                name="crop_cycle_harvest_after_sowing",
            ),
            models.CheckConstraint(
                condition=Q(declared_area_m2__isnull=True) | Q(declared_area_m2__gt=0),
                name="crop_cycle_area_positive",
            ),
            models.CheckConstraint(
                condition=Q(confirmed_crop__isnull=True) | Q(confirmed_at__isnull=False),
                name="crop_cycle_confirmation_dated",
            ),
        ]
        indexes = [
            models.Index(fields=["organization", "status"], name="crop_cycle_org_status"),
        ]

    def __str__(self) -> str:
        return f"{self.crop} · {self.parcel}"

    @property
    def crop(self) -> Crop:
        """Culture retenue : la culture confirmée si elle existe, sinon la culture déclarée."""
        return self.confirmed_crop or self.declared_crop

    def delete(self, *args, **kwargs):
        raise ValidationError("Un cycle n'est jamais supprimé : archivez-le.")


# ── Opérations et récoltes ───────────────────────────────────────────────


class OperationType(models.TextChoices):
    LAND_PREPARATION = "land_preparation", "Préparation du sol"
    SOWING = "sowing", "Semis"
    TRANSPLANTING = "transplanting", "Repiquage"
    IRRIGATION = "irrigation", "Irrigation"
    FERTILIZATION = "fertilization", "Fertilisation"
    WEEDING = "weeding", "Désherbage"
    PHYTOSANITARY_TREATMENT = "phytosanitary_treatment", "Traitement phytosanitaire"
    OTHER = "other", "Autre"


class RecordSource(models.TextChoices):
    FIELD_AGENT = "field_agent", "Agent de terrain"
    PRODUCER_DECLARED = "producer_declared", "Déclaré par le producteur"
    AGRONOMIST = "agronomist", "Agronome"


class AgriculturalOperation(BaseModel, ArchivableModel, SpaceModel, SyncModel):
    """Opération agricole essentielle réalisée ou planifiée sur un cycle."""

    Type = OperationType
    Source = RecordSource

    crop_cycle = models.ForeignKey(CropCycle, on_delete=models.PROTECT, related_name="operations")
    operation_type = models.CharField(max_length=32, choices=OperationType.choices)
    planned_date = models.DateField(null=True, blank=True)
    performed_date = models.DateField(null=True, blank=True)
    source = models.CharField(max_length=32, choices=RecordSource.choices)
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+"
    )
    product_text = models.CharField(
        max_length=200, blank=True, default="", help_text="Produit utilisé (texte libre)."
    )
    quantity = models.DecimalField(max_digits=12, decimal_places=3, null=True, blank=True)
    quantity_unit = models.CharField(max_length=20, blank=True, default="")
    notes = models.TextField(blank=True, default="")

    class Meta:
        db_table = "agriculture_operation"
        ordering = ["-performed_date", "-planned_date", "-created_at"]
        verbose_name = "opération agricole"
        verbose_name_plural = "opérations agricoles"
        constraints = [
            *SpaceModel.space_constraints("operation"),
            models.CheckConstraint(
                condition=Q(operation_type__in=OperationType.values), name="operation_type_valid"
            ),
            models.CheckConstraint(
                condition=Q(source__in=RecordSource.values), name="operation_source_valid"
            ),
            models.CheckConstraint(
                condition=Q(planned_date__isnull=False) | Q(performed_date__isnull=False),
                name="operation_dated",
            ),
            models.CheckConstraint(
                condition=Q(quantity__isnull=True) | Q(quantity__gte=0),
                name="operation_quantity_positive",
            ),
        ]
        indexes = [
            models.Index(fields=["crop_cycle", "performed_date"], name="operation_cycle_date"),
            models.Index(fields=["organization", "operation_type"], name="operation_org_type"),
        ]


class MeasurementMethod(models.TextChoices):
    DECLARED = "declared", "Déclarée"
    WEIGHED = "weighed", "Pesée"
    ESTIMATED = "estimated", "Estimée"


class HarvestRecord(BaseModel, ArchivableModel, SpaceModel, SyncModel):
    """Enregistrement de récolte d'un cycle (plusieurs possibles). Base future du SFA."""

    Method = MeasurementMethod

    crop_cycle = models.ForeignKey(CropCycle, on_delete=models.PROTECT, related_name="harvests")
    harvest_date = models.DateField()
    quantity_kg = models.DecimalField(
        max_digits=12, decimal_places=2, help_text="Quantité normalisée en kg."
    )
    original_quantity = models.DecimalField(max_digits=12, decimal_places=3, null=True, blank=True)
    original_unit = models.CharField(
        max_length=20, blank=True, default="", help_text="Ex. sac de 50 kg."
    )
    harvested_area_m2 = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    measurement_method = models.CharField(max_length=32, choices=MeasurementMethod.choices)
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+"
    )
    notes = models.TextField(blank=True, default="")

    class Meta:
        db_table = "agriculture_harvest"
        ordering = ["-harvest_date", "-created_at"]
        verbose_name = "récolte"
        verbose_name_plural = "récoltes"
        constraints = [
            *SpaceModel.space_constraints("harvest"),
            models.CheckConstraint(condition=Q(quantity_kg__gte=0), name="harvest_quantity_kg"),
            models.CheckConstraint(
                condition=Q(measurement_method__in=MeasurementMethod.values),
                name="harvest_method_valid",
            ),
            models.CheckConstraint(
                condition=Q(harvested_area_m2__isnull=True) | Q(harvested_area_m2__gt=0),
                name="harvest_area_positive",
            ),
        ]
        indexes = [
            models.Index(fields=["crop_cycle", "harvest_date"], name="harvest_cycle_date"),
        ]
