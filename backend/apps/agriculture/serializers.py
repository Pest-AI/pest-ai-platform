"""Sérialiseurs du domaine Agriculture. L'espace n'est jamais lu dans le corps de la requête."""

from decimal import Decimal

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.agriculture.models import (
    AgriculturalCampaign,
    AgriculturalOperation,
    CampaignStatus,
    Crop,
    CropCycle,
    CropCycleStatus,
    CropVariety,
    HarvestRecord,
    MeasurementMethod,
    OperationType,
    RecordSource,
    SeasonType,
)

# ── Référentiel ──────────────────────────────────────────────────────────


class CropVarietySerializer(serializers.ModelSerializer):
    class Meta:
        model = CropVariety
        fields = ["id", "name", "code", "cycle_days_min", "cycle_days_max"]


class CropSerializer(serializers.ModelSerializer):
    varieties = serializers.SerializerMethodField()

    class Meta:
        model = Crop
        fields = [
            "id",
            "code",
            "name_fr",
            "name_wo",
            "name_ff",
            "scientific_name",
            "is_ai_supported",
            "varieties",
        ]

    @extend_schema_field(CropVarietySerializer(many=True))
    def get_varieties(self, crop):
        active = [v for v in crop.varieties.all() if v.is_active]
        return CropVarietySerializer(active, many=True).data


class CropRefSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    code = serializers.CharField()
    name_fr = serializers.CharField()


# ── Campagnes ────────────────────────────────────────────────────────────


class CampaignSerializer(serializers.ModelSerializer):
    cycle_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = AgriculturalCampaign
        fields = [
            "id",
            "name",
            "season_type",
            "year",
            "start_date",
            "end_date",
            "status",
            "cycle_count",
            "is_archived",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class CampaignWriteSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=150)
    season_type = serializers.ChoiceField(choices=SeasonType.choices)
    year = serializers.IntegerField(min_value=2000, max_value=2100)
    start_date = serializers.DateField()
    end_date = serializers.DateField(required=False, allow_null=True)
    status = serializers.ChoiceField(choices=CampaignStatus.choices, required=False)


class CampaignUpdateSerializer(CampaignWriteSerializer):
    name = serializers.CharField(max_length=150, required=False)
    season_type = serializers.ChoiceField(choices=SeasonType.choices, required=False)
    year = serializers.IntegerField(min_value=2000, max_value=2100, required=False)
    start_date = serializers.DateField(required=False)


class AgricultureArchiveSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=500, help_text="Motif de l'archivage.")


# ── Cycles ───────────────────────────────────────────────────────────────


class ParcelRefSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    agroid = serializers.CharField(allow_null=True)
    local_name = serializers.CharField()


class ProducerRefSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    name = serializers.CharField()


class CampaignRefSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    name = serializers.CharField()


class UnitRefSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    code = serializers.CharField()


class CycleOverlapSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    crop = serializers.CharField()
    status = serializers.CharField()


class CropCycleSerializer(serializers.ModelSerializer):
    parcel = serializers.SerializerMethodField()
    crop = serializers.SerializerMethodField(help_text="Culture confirmée, sinon déclarée.")
    declared_crop = CropRefSerializer(read_only=True)
    confirmed_crop = CropRefSerializer(read_only=True, allow_null=True)
    variety = CropVarietySerializer(read_only=True, allow_null=True)
    campaign = serializers.SerializerMethodField()
    operator = serializers.SerializerMethodField()
    cultivation_unit = serializers.SerializerMethodField()
    total_harvest_kg = serializers.DecimalField(
        max_digits=14, decimal_places=2, read_only=True, allow_null=True, default=None
    )

    class Meta:
        model = CropCycle
        fields = [
            "id",
            "parcel",
            "cultivation_unit",
            "campaign",
            "operator",
            "crop",
            "declared_crop",
            "confirmed_crop",
            "confirmed_at",
            "variety",
            "planned_sowing_date",
            "sowing_date",
            "transplanting_date",
            "expected_harvest_date",
            "harvest_end_date",
            "declared_area_m2",
            "status",
            "total_harvest_kg",
            "is_archived",
            "row_version",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    @extend_schema_field(ParcelRefSerializer)
    def get_parcel(self, cycle):
        p = cycle.parcel
        return {"id": p.pk, "agroid": p.agroid, "local_name": p.local_name}

    @extend_schema_field(CropRefSerializer)
    def get_crop(self, cycle):
        c = cycle.crop
        return {"id": c.pk, "code": c.code, "name_fr": c.name_fr}

    @extend_schema_field(CampaignRefSerializer(allow_null=True))
    def get_campaign(self, cycle):
        c = cycle.campaign
        return {"id": c.pk, "name": c.name} if c else None

    @extend_schema_field(ProducerRefSerializer(allow_null=True))
    def get_operator(self, cycle):
        o = cycle.operator
        return {"id": o.pk, "name": f"{o.first_name} {o.last_name}".strip()} if o else None

    @extend_schema_field(UnitRefSerializer(allow_null=True))
    def get_cultivation_unit(self, cycle):
        u = cycle.cultivation_unit
        return {"id": u.pk, "code": u.code} if u else None


class OperationSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgriculturalOperation
        fields = [
            "id",
            "operation_type",
            "planned_date",
            "performed_date",
            "source",
            "product_text",
            "quantity",
            "quantity_unit",
            "notes",
            "created_at",
        ]
        read_only_fields = fields


class HarvestSerializer(serializers.ModelSerializer):
    class Meta:
        model = HarvestRecord
        fields = [
            "id",
            "harvest_date",
            "quantity_kg",
            "original_quantity",
            "original_unit",
            "harvested_area_m2",
            "measurement_method",
            "notes",
            "created_at",
        ]
        read_only_fields = fields


class CropCycleDetailSerializer(CropCycleSerializer):
    operations = serializers.SerializerMethodField()
    harvests = serializers.SerializerMethodField()
    overlaps = serializers.SerializerMethodField(
        help_text="D-17 : cycles du même espace qui se chevauchent (signalés, jamais bloqués)."
    )

    class Meta(CropCycleSerializer.Meta):
        fields = [*CropCycleSerializer.Meta.fields, "operations", "harvests", "overlaps"]
        read_only_fields = fields

    @extend_schema_field(OperationSerializer(many=True))
    def get_operations(self, cycle):
        return OperationSerializer(cycle.operations.filter(is_archived=False), many=True).data

    @extend_schema_field(HarvestSerializer(many=True))
    def get_harvests(self, cycle):
        return HarvestSerializer(cycle.harvests.filter(is_archived=False), many=True).data

    @extend_schema_field(CycleOverlapSerializer(many=True))
    def get_overlaps(self, cycle):
        from apps.agriculture.services import overlapping_cycles

        return [
            {"id": o.pk, "crop": o.crop.name_fr, "status": o.status}
            for o in overlapping_cycles(cycle)
        ]


DATE_FIELDS = (
    "planned_sowing_date",
    "sowing_date",
    "transplanting_date",
    "expected_harvest_date",
    "harvest_end_date",
)


class CropCycleCreateSerializer(serializers.Serializer):
    parcel = serializers.UUIDField()
    cultivation_unit = serializers.UUIDField(required=False, allow_null=True)
    campaign = serializers.UUIDField(required=False, allow_null=True)
    declared_crop = serializers.SlugRelatedField(
        slug_field="code", queryset=Crop.objects.all(), help_text="Code de la culture (rice…)."
    )
    variety = serializers.PrimaryKeyRelatedField(
        queryset=CropVariety.objects.filter(is_active=True), required=False, allow_null=True
    )
    operator = serializers.UUIDField(
        required=False,
        allow_null=True,
        help_text="Exploitant du cycle ; par défaut, l'exploitant principal de la parcelle.",
    )
    planned_sowing_date = serializers.DateField(required=False, allow_null=True)
    sowing_date = serializers.DateField(required=False, allow_null=True)
    transplanting_date = serializers.DateField(required=False, allow_null=True)
    expected_harvest_date = serializers.DateField(required=False, allow_null=True)
    harvest_end_date = serializers.DateField(required=False, allow_null=True)
    declared_area_m2 = serializers.DecimalField(
        max_digits=14, decimal_places=2, min_value=Decimal("0.01"), required=False, allow_null=True
    )
    status = serializers.ChoiceField(
        choices=[CropCycleStatus.PLANNED, CropCycleStatus.IN_PROGRESS], required=False
    )


class CropCycleUpdateSerializer(serializers.Serializer):
    campaign = serializers.UUIDField(required=False, allow_null=True)
    variety = serializers.PrimaryKeyRelatedField(
        queryset=CropVariety.objects.filter(is_active=True), required=False, allow_null=True
    )
    planned_sowing_date = serializers.DateField(required=False, allow_null=True)
    sowing_date = serializers.DateField(required=False, allow_null=True)
    transplanting_date = serializers.DateField(required=False, allow_null=True)
    expected_harvest_date = serializers.DateField(required=False, allow_null=True)
    harvest_end_date = serializers.DateField(required=False, allow_null=True)
    declared_area_m2 = serializers.DecimalField(
        max_digits=14, decimal_places=2, min_value=Decimal("0.01"), required=False, allow_null=True
    )
    status = serializers.ChoiceField(choices=CropCycleStatus.choices, required=False)


class ConfirmCropSerializer(serializers.Serializer):
    crop = serializers.SlugRelatedField(slug_field="code", queryset=Crop.objects.all())


class OperationCreateSerializer(serializers.Serializer):
    operation_type = serializers.ChoiceField(choices=OperationType.choices)
    planned_date = serializers.DateField(required=False, allow_null=True)
    performed_date = serializers.DateField(required=False, allow_null=True)
    source = serializers.ChoiceField(
        choices=RecordSource.choices,
        required=False,
        help_text="Organisation : field_agent par défaut. Espace personnel : producer_declared.",
    )
    product_text = serializers.CharField(max_length=200, required=False, allow_blank=True)
    quantity = serializers.DecimalField(
        max_digits=12, decimal_places=3, min_value=0, required=False, allow_null=True
    )
    quantity_unit = serializers.CharField(max_length=20, required=False, allow_blank=True)
    notes = serializers.CharField(required=False, allow_blank=True)


class HarvestCreateSerializer(serializers.Serializer):
    harvest_date = serializers.DateField()
    quantity_kg = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=0)
    original_quantity = serializers.DecimalField(
        max_digits=12, decimal_places=3, min_value=0, required=False, allow_null=True
    )
    original_unit = serializers.CharField(max_length=20, required=False, allow_blank=True)
    harvested_area_m2 = serializers.DecimalField(
        max_digits=14, decimal_places=2, min_value=Decimal("0.01"), required=False, allow_null=True
    )
    measurement_method = serializers.ChoiceField(choices=MeasurementMethod.choices)
    notes = serializers.CharField(required=False, allow_blank=True)
