"""Sérialiseurs de l'API Parcelles.

Les contours circulent en **GeoJSON** (RFC 7946) : coordonnées `[longitude, latitude]` en
WGS 84. En entrée, `Polygon`, `MultiPolygon` ou `Feature` ; en sortie, toujours `MultiPolygon`.
"""

from decimal import Decimal

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.parcels import geometry as geo
from apps.parcels import validation
from apps.parcels.models import (
    AccessLevel,
    ArrangementType,
    CaptureMethod,
    CultivationUnit,
    OperatorRole,
    OwnershipVerification,
    Parcel,
    ParcelGeometry,
    ParcelOperatorAssignment,
    ParcelOwnership,
    TenureType,
)

GEOJSON_HELP = (
    "Contour GeoJSON : Polygon, MultiPolygon ou Feature, coordonnées [longitude, latitude] "
    "en WGS 84, anneau fermé (le dernier point répète le premier)."
)


def _producer_name(producer) -> str:
    return f"{producer.first_name} {producer.last_name}".strip() if producer else ""


# ── Lecture ──────────────────────────────────────────────────────────────


class ValidationSummarySerializer(serializers.Serializer):
    status = serializers.CharField(help_text="pending, valid, flagged ou rejected.")
    flags = serializers.ListField(child=serializers.CharField())
    labels = serializers.ListField(child=serializers.CharField(), help_text="Motifs lisibles.")
    overlaps = serializers.ListField(
        child=serializers.DictField(),
        help_text="Chevauchements : AgroID seulement si la parcelle voisine est visible "
        "dans l'espace actif, sinon « Parcelle hors de votre périmètre ».",
    )
    review = serializers.DictField(allow_null=True)


def validation_summary(version: ParcelGeometry, visible_ids: set[str]) -> dict:
    """Résumé du contrôle, sans révéler les parcelles hors du périmètre de l'espace."""
    report = version.validation_report or {}
    flags = report.get("flags", [])
    overlaps = []
    for hit in report.get("overlaps", []):
        visible = hit["parcel_id"] in visible_ids
        overlaps.append(
            {
                "parcel_id": hit["parcel_id"] if visible else None,
                "agroid": (
                    Parcel.objects.filter(pk=hit["parcel_id"])
                    .values_list("agroid", flat=True)
                    .first()
                    if visible
                    else None
                ),
                "label": None if visible else "Parcelle hors de votre périmètre",
                "overlap_m2": hit["overlap_m2"],
                "percent": hit["percent"],
            }
        )
    review = report.get("review")
    return {
        "status": version.validation_status,
        "flags": flags,
        "labels": [validation.FLAG_LABELS.get(f, f) for f in flags],
        "overlaps": overlaps,
        "review": {k: review[k] for k in ("decision", "note", "at")} if review else None,
    }


class GeometryVersionSerializer(serializers.ModelSerializer):
    geometry = serializers.SerializerMethodField()
    validation = serializers.SerializerMethodField()

    class Meta:
        model = ParcelGeometry
        fields = [
            "id",
            "version",
            "is_current",
            "geometry",
            "area_m2",
            "perimeter_m",
            "capture_method",
            "gps_accuracy_m",
            "captured_at",
            "valid_from",
            "valid_to",
            "validation",
        ]
        read_only_fields = fields

    @extend_schema_field(OpenApiTypes.OBJECT)
    def get_geometry(self, obj) -> dict:
        return geo.to_geojson(obj.geometry)

    @extend_schema_field(ValidationSummarySerializer)
    def get_validation(self, obj) -> dict:
        return validation_summary(obj, self.context.get("visible_ids", set()))


class OwnershipSerializer(serializers.ModelSerializer):
    owner_display = serializers.SerializerMethodField()
    is_current = serializers.BooleanField(read_only=True)

    class Meta:
        model = ParcelOwnership
        fields = [
            "id",
            "owner_display",
            "owner_producer",
            "owner_organization",
            "owner_name",
            "tenure_type",
            "share_percent",
            "start_date",
            "end_date",
            "is_current",
            "verification_status",
            "notes",
        ]
        read_only_fields = fields

    def get_owner_display(self, obj) -> str:
        if obj.owner_producer_id:
            return _producer_name(obj.owner_producer)
        if obj.owner_organization_id:
            return obj.owner_organization.name
        return obj.owner_name


class OperatorSerializer(serializers.ModelSerializer):
    producer_name = serializers.SerializerMethodField()
    is_current = serializers.SerializerMethodField()

    class Meta:
        model = ParcelOperatorAssignment
        fields = [
            "id",
            "producer",
            "producer_name",
            "operator_role",
            "arrangement_type",
            "verification_status",
            "start_date",
            "end_date",
            "is_current",
        ]
        read_only_fields = fields

    def get_producer_name(self, obj) -> str:
        return _producer_name(obj.producer)

    def get_is_current(self, obj) -> bool:
        return obj.end_date is None


class CultivationUnitSerializer(serializers.ModelSerializer):
    class Meta:
        model = CultivationUnit
        fields = ["id", "code", "name", "area_m2", "status", "valid_from", "valid_to"]
        read_only_fields = fields


class ParcelListSerializer(serializers.ModelSerializer):
    """Ligne de liste (sans contour : voir /parcels/map/ pour la carte)."""

    centroid = serializers.SerializerMethodField(help_text="[longitude, latitude] ou null.")
    primary_operator = serializers.SerializerMethodField()

    class Meta:
        model = Parcel
        fields = [
            "id",
            "agroid",
            "local_name",
            "status",
            "registration_channel",
            "current_area_m2",
            "centroid",
            "primary_operator",
            "created_at",
        ]
        read_only_fields = fields

    def get_centroid(self, obj) -> list[float] | None:
        return [round(obj.centroid.x, 7), round(obj.centroid.y, 7)] if obj.centroid else None

    @extend_schema_field(OpenApiTypes.OBJECT)
    def get_primary_operator(self, obj) -> dict | None:
        current = next(
            (
                a
                for a in obj.operators.all()
                if a.end_date is None and a.operator_role == OperatorRole.PRIMARY
            ),
            None,
        )
        if current is None:
            return None
        return {"producer": str(current.producer_id), "name": _producer_name(current.producer)}


class ParcelDetailSerializer(ParcelListSerializer):
    """Fiche parcelle dans l'espace actif."""

    current_geometry = serializers.SerializerMethodField()
    owners = serializers.SerializerMethodField()
    operators = serializers.SerializerMethodField()
    units = serializers.SerializerMethodField()
    access = serializers.SerializerMethodField(
        help_text="Droits de l'espace actif sur cette parcelle : view ou manage."
    )

    class Meta(ParcelListSerializer.Meta):
        fields = [
            *ParcelListSerializer.Meta.fields,
            "agroid_assigned_at",
            "country_code",
            "current_geometry",
            "owners",
            "operators",
            "units",
            "access",
            "updated_at",
            "row_version",
        ]
        read_only_fields = fields

    @extend_schema_field(GeometryVersionSerializer(allow_null=True))
    def get_current_geometry(self, obj):
        current = obj.geometries.filter(is_current=True).first()
        return GeometryVersionSerializer(current, context=self.context).data if current else None

    def _filtered(self, rows):
        keep = self.context.get("relation_filter")
        return [r for r in rows if keep(r)] if keep else list(rows)

    @extend_schema_field(OwnershipSerializer(many=True))
    def get_owners(self, obj):
        rows = obj.ownerships.filter(end_date__isnull=True).select_related(
            "owner_producer", "owner_organization"
        )
        return OwnershipSerializer(self._filtered(rows), many=True).data

    @extend_schema_field(OperatorSerializer(many=True))
    def get_operators(self, obj):
        rows = obj.operators.filter(end_date__isnull=True).select_related("producer")
        return OperatorSerializer(self._filtered(rows), many=True).data

    @extend_schema_field(CultivationUnitSerializer(many=True))
    def get_units(self, obj):
        return CultivationUnitSerializer(obj.units.order_by("code"), many=True).data

    def get_access(self, obj) -> str:
        return self.context.get("access_level", AccessLevel.VIEW)


class ParcelHistorySerializer(serializers.Serializer):
    geometries = GeometryVersionSerializer(many=True)
    owners = OwnershipSerializer(many=True)
    operators = OperatorSerializer(many=True)


# ── Écriture ─────────────────────────────────────────────────────────────


class GeometryInputMixin(serializers.Serializer):
    geometry = serializers.JSONField(help_text=GEOJSON_HELP)
    capture_method = serializers.ChoiceField(
        choices=CaptureMethod.choices, default=CaptureMethod.MANUAL_DRAWING
    )
    gps_accuracy_m = serializers.DecimalField(
        max_digits=6, decimal_places=2, min_value=0, required=False, allow_null=True
    )
    captured_at = serializers.DateTimeField(required=False, allow_null=True)


class ParcelCreateSerializer(GeometryInputMixin):
    local_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    geometry = serializers.JSONField(required=False, allow_null=True, help_text=GEOJSON_HELP)


class ParcelUpdateSerializer(serializers.Serializer):
    local_name = serializers.CharField(max_length=150, allow_blank=True)


class NewGeometrySerializer(GeometryInputMixin):
    pass


class ReviewSerializer(serializers.Serializer):
    decision = serializers.ChoiceField(choices=["valid", "rejected"])
    note = serializers.CharField(required=False, allow_blank=True, max_length=1000)


class ReasonSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=500)


class EndRelationSerializer(serializers.Serializer):
    end_date = serializers.DateField()


class OwnershipCreateSerializer(serializers.Serializer):
    tenure_type = serializers.ChoiceField(choices=TenureType.choices)
    start_date = serializers.DateField()
    owner_producer = serializers.UUIDField(required=False, allow_null=True)
    owner_organization = serializers.UUIDField(required=False, allow_null=True)
    owner_name = serializers.CharField(max_length=200, required=False, allow_blank=True)
    share_percent = serializers.DecimalField(
        max_digits=5, decimal_places=2, required=False, allow_null=True
    )
    verification_status = serializers.ChoiceField(
        choices=OwnershipVerification.choices, default=OwnershipVerification.DECLARED
    )
    notes = serializers.CharField(required=False, allow_blank=True)


class OperatorCreateSerializer(serializers.Serializer):
    producer = serializers.UUIDField()
    operator_role = serializers.ChoiceField(choices=OperatorRole.choices)
    arrangement_type = serializers.ChoiceField(
        choices=ArrangementType.choices, default=ArrangementType.UNKNOWN
    )
    start_date = serializers.DateField()
    replace_primary = serializers.BooleanField(default=False)


class UnitCreateSerializer(serializers.Serializer):
    code = serializers.CharField(max_length=16)
    name = serializers.CharField(max_length=100, required=False, allow_blank=True)
    area_m2 = serializers.DecimalField(
        max_digits=14, decimal_places=2, min_value=Decimal("0.01"), required=False, allow_null=True
    )


class LinkRequestSerializer(serializers.Serializer):
    agroid = serializers.CharField(help_text="AgroID communiqué par le producteur.")


class PersonalAccessSerializer(serializers.Serializer):
    producer = serializers.UUIDField()


class LinkRequestStatusSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    agroid = serializers.CharField()
    status = serializers.CharField()
    start_date = serializers.DateField()


class PendingLinkSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    organization = serializers.CharField(help_text="Nom de l'organisation qui demande.")
    parcel_id = serializers.UUIDField()
    agroid = serializers.CharField()
    local_name = serializers.CharField()
    requested_at = serializers.DateField()
