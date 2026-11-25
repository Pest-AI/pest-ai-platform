"""Sérialiseurs de l'API Parcelles.

Les contours circulent en **GeoJSON** (RFC 7946) : coordonnées `[longitude, latitude]` en
WGS 84. En entrée, `Polygon`, `MultiPolygon` ou `Feature` ; en sortie, toujours `MultiPolygon`.
"""

from decimal import Decimal

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.parcels import geometry as geo
from apps.parcels import site_referentials as site_ref
from apps.parcels import soil_parameters as soil_ref
from apps.parcels import validation
from apps.parcels.models import (
    AccessLevel,
    ArrangementType,
    CaptureMethod,
    CultivationUnit,
    ImportStatus,
    OperatorRole,
    OwnershipVerification,
    Parcel,
    ParcelGeometry,
    ParcelOperatorAssignment,
    ParcelOwnership,
    ParcelSiteProfile,
    RentType,
    SoilTest,
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
            "rent_type",
            "rent_amount_xof",
            "harvest_share_percent",
            "agreement_end_date",
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


class UnitCheckSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=["valid", "flagged", "not_applicable"])
    flags = serializers.ListField(child=serializers.CharField())
    labels = serializers.ListField(child=serializers.CharField())


class CultivationUnitSerializer(serializers.ModelSerializer):
    geometry = serializers.SerializerMethodField(
        help_text="Contour GeoJSON (MultiPolygon), ou null si l'unité est déclarée sans contour."
    )
    check = serializers.SerializerMethodField(
        help_text="Contrôle D-16 : inclusion dans la parcelle à 1 m près, chevauchement d'unités."
    )

    class Meta:
        model = CultivationUnit
        fields = [
            "id",
            "code",
            "name",
            "area_m2",
            "status",
            "valid_from",
            "valid_to",
            "geometry",
            "check",
        ]
        read_only_fields = fields

    @extend_schema_field(OpenApiTypes.OBJECT)
    def get_geometry(self, obj):
        return geo.to_geojson(obj.geometry) if obj.geometry is not None else None

    @extend_schema_field(UnitCheckSerializer)
    def get_check(self, obj):
        if obj.status != "active":
            return {"status": "not_applicable", "flags": [], "labels": []}
        return validation.check_unit(obj)


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


# ── Profil de site (J18d) ────────────────────────────────────────────────


class SiteProfileSerializer(serializers.ModelSerializer):
    """Version du profil de site : sol, eau et irrigation, accès."""

    class Meta:
        model = ParcelSiteProfile
        fields = [
            "id",
            *site_ref.SITE_FIELDS,
            "scheme_name",
            "distance_to_village_km",
            "other_detail",
            "evidence",
            "observed_on",
            "notes",
            "created_at",
        ]
        read_only_fields = fields


def _site_write_fields():
    fields = {
        name: serializers.ChoiceField(choices=choices.choices, required=False, allow_blank=True)
        for name, choices in site_ref.SITE_FIELDS.items()
    }
    fields.update(
        scheme_name=serializers.CharField(max_length=150, required=False, allow_blank=True),
        distance_to_village_km=serializers.DecimalField(
            max_digits=5,
            decimal_places=1,
            min_value=Decimal("0"),
            max_value=Decimal("500"),
            required=False,
            allow_null=True,
        ),
        other_detail=serializers.CharField(max_length=200, required=False, allow_blank=True),
        notes=serializers.CharField(required=False, allow_blank=True),
        evidence=serializers.ChoiceField(
            choices=site_ref.Evidence.choices, default=site_ref.Evidence.DECLARED
        ),
        observed_on=serializers.DateField(required=False),
    )
    return fields


SiteProfileWriteSerializer = type(
    "SiteProfileWriteSerializer",
    (serializers.Serializer,),
    {
        **_site_write_fields(),
        "__doc__": "Nouvelle version complète du profil de site (la précédente est conservée).",
    },
)


def _soil_value(code, value) -> str:
    param = soil_ref.BY_CODE.get(code)
    if param is None:
        return str(value.normalize())
    return str(value.quantize(Decimal(1).scaleb(-param.decimals)))


class SoilUnitRefSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    code = serializers.CharField()


class SoilValueSerializer(serializers.Serializer):
    parameter = serializers.CharField()
    label = serializers.CharField()
    value = serializers.CharField(help_text="Valeur décimale, au nombre de décimales du paramètre.")
    unit = serializers.CharField(allow_blank=True)
    unusual = serializers.BooleanField(help_text="Hors de la plage habituelle (à vérifier).")


class SoilTestSerializer(serializers.ModelSerializer):
    """Mesure du sol (J20c) avec ses valeurs, dans l'ordre du référentiel."""

    values = serializers.SerializerMethodField()
    position = serializers.SerializerMethodField()
    cultivation_unit = serializers.SerializerMethodField()

    class Meta:
        model = SoilTest
        fields = [
            "id",
            "method",
            "device_model",
            "measured_at",
            "depth_cm",
            "position",
            "cultivation_unit",
            "values",
            "notes",
            "created_at",
        ]
        read_only_fields = fields

    @extend_schema_field(SoilValueSerializer(many=True))
    def get_values(self, obj):
        order = {p.code: i for i, p in enumerate(soil_ref.PARAMETERS)}
        rows = sorted(obj.values.all(), key=lambda v: order.get(v.parameter, 99))
        return [
            {
                "parameter": v.parameter,
                "label": (
                    soil_ref.BY_CODE[v.parameter].label
                    if v.parameter in soil_ref.BY_CODE
                    else v.parameter
                ),
                "value": _soil_value(v.parameter, v.value),
                "unit": v.unit,
                "unusual": v.parameter in soil_ref.BY_CODE
                and soil_ref.is_unusual(v.parameter, v.value),
            }
            for v in rows
        ]

    @extend_schema_field(serializers.ListField(child=serializers.FloatField(), allow_null=True))
    def get_position(self, obj):
        return [obj.position.x, obj.position.y] if obj.position else None

    @extend_schema_field(SoilUnitRefSerializer(allow_null=True))
    def get_cultivation_unit(self, obj):
        unit = obj.cultivation_unit
        return {"id": unit.pk, "code": unit.code} if unit else None


class SoilTestWriteSerializer(serializers.Serializer):
    """Nouvelle mesure du sol. `values` : {code du paramètre: valeur}, unités du référentiel
    (`/parcels/site-referentials/`, clé `soil_parameters`)."""

    values = serializers.DictField(
        child=serializers.DecimalField(max_digits=10, decimal_places=3, allow_null=True)
    )
    method = serializers.ChoiceField(
        choices=soil_ref.SoilTestMethod.choices, default=soil_ref.SoilTestMethod.FIELD_KIT
    )
    device_model = serializers.CharField(max_length=100, required=False, allow_blank=True)
    measured_at = serializers.DateTimeField(required=False)
    depth_cm = serializers.IntegerField(min_value=0, max_value=200, required=False, allow_null=True)
    position = serializers.ListField(
        child=serializers.FloatField(), min_length=2, max_length=2, required=False, allow_null=True
    )
    cultivation_unit = serializers.UUIDField(required=False, allow_null=True)
    notes = serializers.CharField(required=False, allow_blank=True)


class SoilParameterSerializer(serializers.Serializer):
    code = serializers.CharField()
    label = serializers.CharField()
    unit = serializers.CharField(allow_blank=True)
    min = serializers.CharField()
    max = serializers.CharField()
    usual_min = serializers.CharField()
    usual_max = serializers.CharField()
    decimals = serializers.IntegerField()
    kit = serializers.BooleanField(help_text="Mesuré par le kit de terrain.")


class SiteHistorySerializer(serializers.Serializer):
    current = SiteProfileSerializer(allow_null=True)
    history = SiteProfileSerializer(many=True)


class ReferentialItemSerializer(serializers.Serializer):
    value = serializers.CharField()
    label = serializers.CharField()


class SiteReferentialsSerializer(serializers.Serializer):
    """Listes du profil de site (proposées, à valider par l'agronome)."""

    fields = serializers.DictField(child=ReferentialItemSerializer(many=True))
    evidence = ReferentialItemSerializer(many=True)
    tenure_types = ReferentialItemSerializer(many=True)
    rent_types = ReferentialItemSerializer(many=True)
    soil_parameters = SoilParameterSerializer(many=True)
    soil_test_methods = ReferentialItemSerializer(many=True)


class CompletenessBlockSerializer(serializers.Serializer):
    key = serializers.CharField()
    label = serializers.CharField()
    done = serializers.BooleanField()


class CompletenessSerializer(serializers.Serializer):
    percent = serializers.IntegerField()
    blocks = CompletenessBlockSerializer(many=True)


class LeaseTermsSerializer(serializers.Serializer):
    """Conditions d'une location, d'un métayage ou d'un prêt (J18d)."""

    rent_type = serializers.ChoiceField(choices=RentType.choices, required=False, allow_blank=True)
    rent_amount_xof = serializers.IntegerField(
        min_value=0, max_value=100_000_000, required=False, allow_null=True
    )
    harvest_share_percent = serializers.DecimalField(
        max_digits=5,
        decimal_places=2,
        min_value=Decimal("0.01"),
        max_value=Decimal("100"),
        required=False,
        allow_null=True,
    )
    agreement_end_date = serializers.DateField(required=False, allow_null=True)


class ParcelDetailSerializer(ParcelListSerializer):
    """Fiche parcelle dans l'espace actif."""

    current_geometry = serializers.SerializerMethodField()
    owners = serializers.SerializerMethodField()
    operators = serializers.SerializerMethodField()
    units = serializers.SerializerMethodField()
    access = serializers.SerializerMethodField(
        help_text="Droits de l'espace actif sur cette parcelle : view ou manage."
    )
    site_profile = serializers.SerializerMethodField(
        help_text="Profil de site courant (sol, eau, accès), ou null."
    )
    completeness = serializers.SerializerMethodField(
        help_text="Taux de complétude de la fiche AgroID et blocs renseignés."
    )
    latest_soil_test = serializers.SerializerMethodField(
        help_text="Dernière mesure du sol (kit, laboratoire ou capteur), ou null."
    )
    soil_test_count = serializers.SerializerMethodField()

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
            "site_profile",
            "completeness",
            "latest_soil_test",
            "soil_test_count",
            "updated_at",
            "row_version",
        ]
        read_only_fields = fields

    @extend_schema_field(SiteProfileSerializer(allow_null=True))
    def get_site_profile(self, obj):
        from apps.parcels.services import current_site_profile

        current = current_site_profile(obj)
        return SiteProfileSerializer(current).data if current else None

    @extend_schema_field(SoilTestSerializer(allow_null=True))
    def get_latest_soil_test(self, obj):
        from apps.parcels.services import latest_soil_test

        latest = latest_soil_test(obj)
        return SoilTestSerializer(latest).data if latest else None

    def get_soil_test_count(self, obj) -> int:
        return obj.soil_tests.count()

    @extend_schema_field(CompletenessSerializer)
    def get_completeness(self, obj):
        from apps.parcels.services import completeness

        return completeness(obj)

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


class ParcelSummarySerializer(serializers.Serializer):
    count = serializers.IntegerField(help_text="Parcelles non retirées.")
    by_status = serializers.DictField(child=serializers.IntegerField())
    total_area_m2 = serializers.DecimalField(max_digits=16, decimal_places=2)
    to_review = serializers.IntegerField(help_text="Contours courants signalés ou à contrôler.")
    bbox = serializers.ListField(
        child=serializers.FloatField(),
        allow_null=True,
        help_text="[minLon, minLat, maxLon, maxLat] des points centraux, ou null.",
    )


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


class EnrolmentOwnershipSerializer(serializers.Serializer):
    """Foncier déclaré à l'enrôlement (J18b) : l'exploitant est-il le propriétaire ?"""

    owner = serializers.ChoiceField(
        choices=[("operator", "L'exploitant"), ("other", "Une autre personne")],
        help_text="`operator` : l'exploitant désigné est propriétaire ; `other` : `owner_name`.",
    )
    owner_name = serializers.CharField(max_length=200, required=False, allow_blank=True)
    tenure_type = serializers.ChoiceField(choices=TenureType.choices)

    def validate(self, attrs):
        if attrs["owner"] == "other" and not attrs.get("owner_name", "").strip():
            raise serializers.ValidationError({"owner_name": "Indiquez le nom du propriétaire."})
        return attrs


class ParcelCreateSerializer(GeometryInputMixin):
    local_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    geometry = serializers.JSONField(required=False, allow_null=True, help_text=GEOJSON_HELP)
    position = serializers.ListField(
        child=serializers.FloatField(),
        min_length=2,
        max_length=2,
        required=False,
        allow_null=True,
        help_text="Sans contour : position [longitude, latitude] en WGS 84 (contour à relever).",
    )
    operator = serializers.UUIDField(
        required=False,
        allow_null=True,
        help_text="Exploitant principal (producteur rattaché à l'organisation), désigné dès la "
        "création.",
    )

    arrangement_type = serializers.ChoiceField(
        choices=ArrangementType.choices,
        required=False,
        help_text="Mode d'exploitation (location, métayage, prêt…) ; avec `operator`.",
    )
    ownership = EnrolmentOwnershipSerializer(
        required=False,
        allow_null=True,
        help_text="Foncier déclaré (statut « déclarée ») : enregistré avec la parcelle.",
    )
    lease = LeaseTermsSerializer(
        required=False, allow_null=True, help_text="Conditions d'exploitation, avec `operator`."
    )
    site = SiteProfileWriteSerializer(
        required=False,
        allow_null=True,
        help_text="Sol, eau et irrigation, accès : première version du profil de site.",
    )
    soil_test = SoilTestWriteSerializer(
        required=False,
        allow_null=True,
        help_text="Mesure du kit de sol faite à l'enrôlement (facultative).",
    )

    def validate_position(self, value):
        if value is None:
            return None
        lon, lat = value
        if not (-180 <= lon <= 180 and -90 <= lat <= 90):
            raise serializers.ValidationError("Position hors limites : [longitude, latitude].")
        return value

    def validate(self, attrs):
        if attrs.get("geometry") and attrs.get("position"):
            raise serializers.ValidationError(
                {"position": "Donnez un contour ou une position, pas les deux."}
            )
        return attrs


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


class OperatorCreateSerializer(LeaseTermsSerializer):
    producer = serializers.UUIDField()
    operator_role = serializers.ChoiceField(choices=OperatorRole.choices)
    arrangement_type = serializers.ChoiceField(
        choices=ArrangementType.choices, default=ArrangementType.UNKNOWN
    )
    start_date = serializers.DateField()
    replace_primary = serializers.BooleanField(default=False)


class UnitCreateSerializer(serializers.Serializer):
    code = serializers.CharField(
        max_length=16, required=False, allow_blank=True, help_text="Vide : U1, U2… proposé."
    )
    geometry = serializers.JSONField(
        required=False,
        allow_null=True,
        help_text="Contour facultatif (GeoJSON Polygon) ; sa surface remplace `area_m2`.",
    )
    capture_method = serializers.ChoiceField(
        choices=CaptureMethod.choices, required=False, help_text="Méthode de relevé (information)."
    )
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


# ── Import de fichiers (J15b) ────────────────────────────────────────────


class ImportMappingSerializer(serializers.Serializer):
    name_column = serializers.CharField(allow_null=True, allow_blank=True, required=False)
    operator_column = serializers.CharField(allow_null=True, allow_blank=True, required=False)
    operator_key = serializers.ChoiceField(
        choices=["membership_number", "phone", "none"], default="none"
    )


class ImportRowSerializer(serializers.Serializer):
    index = serializers.IntegerField(
        help_text="Numéro de l'entité dans le fichier (à partir de 1)."
    )
    label = serializers.CharField(help_text="Nom retenu pour la parcelle.")
    status = serializers.ChoiceField(choices=["ok", "flagged", "refused"])
    messages = serializers.ListField(child=serializers.CharField())
    kind = serializers.ChoiceField(choices=["polygon", "point", "none"])
    area_m2 = serializers.CharField(allow_null=True)
    operator = serializers.DictField(allow_null=True)
    geometry = serializers.DictField(allow_null=True, help_text="GeoJSON (WGS 84).")


class ImportProducerLineSerializer(serializers.Serializer):
    index = serializers.IntegerField(help_text="Ligne de l'onglet Producteurs (à partir de 1).")
    name = serializers.CharField()
    phone = serializers.CharField(help_text="Téléphone au format international, ou vide.")
    membership_number = serializers.CharField()
    locality = serializers.CharField()
    status = serializers.ChoiceField(choices=["ok", "flagged", "refused"])
    action = serializers.ChoiceField(
        choices=["create", "existing"],
        allow_null=True,
        help_text="`create` : nouvelle fiche ; `existing` : déjà dans le registre.",
    )
    messages = serializers.ListField(child=serializers.CharField())
    created = serializers.BooleanField(required=False, help_text="Import confirmé : fiche créée.")


class ImportProducerSummarySerializer(serializers.Serializer):
    total = serializers.IntegerField()
    create = serializers.IntegerField()
    existing = serializers.IntegerField()
    flagged = serializers.IntegerField()
    refused = serializers.IntegerField()


class ImportSummarySerializer(serializers.Serializer):
    total = serializers.IntegerField()
    ok = serializers.IntegerField()
    flagged = serializers.IntegerField()
    refused = serializers.IntegerField()
    without_contour = serializers.IntegerField()
    with_operator = serializers.IntegerField()
    created = serializers.IntegerField(required=False)
    producers_created = serializers.IntegerField(required=False)
    producers = ImportProducerSummarySerializer(
        required=False, help_text="Modèle « Coopérative » : onglet Producteurs."
    )


class ImportReportLineSerializer(serializers.Serializer):
    index = serializers.IntegerField()
    label = serializers.CharField()
    status = serializers.ChoiceField(choices=["ok", "flagged", "refused"])
    messages = serializers.ListField(child=serializers.CharField())
    operator = serializers.CharField(allow_null=True, help_text="Exploitant reconnu.")
    agroid = serializers.CharField(allow_null=True, help_text="AgroID attribué ; vide : non créée.")


class ParcelImportSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    file_name = serializers.CharField()
    file_format = serializers.CharField()
    file_size = serializers.IntegerField()
    status = serializers.ChoiceField(choices=ImportStatus.choices)
    columns = serializers.ListField(child=serializers.CharField())
    mapping = ImportMappingSerializer()
    summary = ImportSummarySerializer()
    parcels_created = serializers.IntegerField()
    producers_created = serializers.IntegerField()
    created_at = serializers.DateTimeField()
    committed_at = serializers.DateTimeField(allow_null=True)
    rows = ImportRowSerializer(many=True, required=False, help_text="Aperçu (import non confirmé).")
    report = ImportReportLineSerializer(
        many=True, required=False, help_text="Bilan ligne par ligne (import confirmé)."
    )
    producers = ImportProducerLineSerializer(
        many=True,
        required=False,
        help_text="Modèle « Coopérative » : onglet Producteurs (aperçu, ou bilan après import).",
    )


class ImportUploadSerializer(serializers.Serializer):
    file = serializers.FileField(
        help_text="Excel (.xlsx, dont le modèle « Coopérative »), CSV, JSON, GeoJSON, KML, KMZ, "
        "Shapefile (.zip avec .shp, .shx, .dbf, .prj) ou GPX. Tableaux : colonne « contour » "
        "(WKT ou relevé KoboToolbox / ODK), ou « latitude » et « longitude ». 10 Mo et 1 000 "
        "lignes au plus."
    )


class ImportCommitSerializer(serializers.Serializer):
    include_flagged = serializers.BooleanField(
        default=False, help_text="Créer aussi les lignes signalées (à vérifier)."
    )
