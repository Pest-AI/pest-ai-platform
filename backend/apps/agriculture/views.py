"""API Agriculture : référentiel des cultures, campagnes, cycles, opérations et récoltes.

Deux espaces (X-Workspace) : organisation (permissions campaigns.* / crop_cycles.*) ou
espace personnel du producteur (personal.crop_cycles.manage). Chaque requête ne lit que les
enregistrements de son espace (`for_workspace`) ; un objet d'un autre espace répond 404.
"""

from __future__ import annotations

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Count, DecimalField, OuterRef, Q, Subquery, Sum
from django.db.models.functions import Coalesce
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.agriculture import serializers, services
from apps.agriculture.models import (
    AgriculturalCampaign,
    Crop,
    CropCycle,
    HarvestRecord,
)
from apps.core.permissions import WorkspacePermission
from apps.core.workspace import PERSONAL

TAG = ["agriculture"]


def _run(service, *args, **kwargs):
    try:
        return service(*args, **kwargs)
    except DjangoValidationError as exc:
        detail = exc.message_dict if hasattr(exc, "error_dict") else exc.messages
        raise ValidationError(detail) from exc


class SpaceViewSetMixin:
    """Choisit le jeu de permissions selon l'espace et fournit le contexte vérifié."""

    ORG_PERMISSIONS: dict = {}
    PERSONAL_PERMISSIONS: dict = {}
    permission_classes = [IsAuthenticated, WorkspacePermission]

    @property
    def required_permissions(self):
        workspace = getattr(self.request, "workspace", None)
        if workspace is not None and workspace.kind == PERSONAL:
            return self.PERSONAL_PERMISSIONS
        return self.ORG_PERMISSIONS

    @property
    def workspace(self):
        return self.request.workspace

    def _get(self, queryset):
        obj = queryset.filter(pk=self.kwargs["pk"]).first()
        if obj is None:
            raise NotFound("Introuvable dans cet espace.")
        return obj


# ── Référentiel ──────────────────────────────────────────────────────────


@extend_schema_view(
    list=extend_schema(
        tags=TAG,
        summary="Cultures",
        description="Référentiel des cultures actives et de leurs variétés. MVP : riz, oignon, "
        "tomate, maïs, piment (`is_ai_supported`).",
    ),
    retrieve=extend_schema(tags=TAG, summary="Culture"),
)
class CropViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = serializers.CropSerializer
    pagination_class = None
    queryset = Crop.objects.filter(is_active=True).prefetch_related("varieties")


# ── Campagnes ────────────────────────────────────────────────────────────

CAMPAIGN_FILTERS = [
    OpenApiParameter("status", str, description="planned, active, closed"),
    OpenApiParameter("year", int),
    OpenApiParameter("season_type", str, description="rainy, cold_dry, hot_dry, other"),
    OpenApiParameter("archived", bool, description="Inclure les campagnes archivées."),
]


@extend_schema_view(
    list=extend_schema(
        tags=TAG,
        summary="Campagnes de l'espace",
        parameters=CAMPAIGN_FILTERS,
        description="Campagnes de l'organisation active, ou de l'espace personnel. "
        "Permission : `campaigns.view` ou `personal.crop_cycles.manage`.",
    ),
    retrieve=extend_schema(tags=TAG, summary="Campagne"),
)
class CampaignViewSet(
    SpaceViewSetMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = serializers.CampaignSerializer
    http_method_names = ["get", "post", "patch", "head", "options"]
    ORG_PERMISSIONS = {
        "list": "campaigns.view",
        "retrieve": "campaigns.view",
        "create": "campaigns.manage",
        "partial_update": "campaigns.manage",
        "archive": "campaigns.manage",
    }
    PERSONAL_PERMISSIONS = dict.fromkeys(ORG_PERMISSIONS, "personal.crop_cycles.manage")

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return AgriculturalCampaign.objects.none()
        qs = AgriculturalCampaign.objects.for_workspace(self.workspace).annotate(
            cycle_count=Count("crop_cycles", filter=Q(crop_cycles__is_archived=False))
        )
        params = self.request.query_params
        if self.action == "list":
            if params.get("archived") not in ("true", "1"):
                qs = qs.filter(is_archived=False)
            for key in ("status", "season_type"):
                if params.get(key):
                    qs = qs.filter(**{key: params[key]})
            if (params.get("year") or "").isdigit():
                qs = qs.filter(year=int(params["year"]))
        return qs

    @extend_schema(
        tags=TAG,
        summary="Créer une campagne",
        description="Saison (D-18) : rainy (hivernage), cold_dry (contre-saison froide), "
        "hot_dry (contre-saison chaude), other. Nom unique dans l'espace.",
        request=serializers.CampaignWriteSerializer,
        responses={201: serializers.CampaignSerializer},
    )
    def create(self, request):
        s = serializers.CampaignWriteSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        campaign = _run(
            services.create_campaign, workspace=self.workspace, by=request.user, **s.validated_data
        )
        campaign.cycle_count = 0
        return Response(
            serializers.CampaignSerializer(campaign).data, status=status.HTTP_201_CREATED
        )

    @extend_schema(
        tags=TAG,
        summary="Modifier une campagne",
        description="Statut : planned → active → closed. Une campagne clôturée ne se modifie plus "
        "et n'accepte plus de nouveau cycle.",
        request=serializers.CampaignUpdateSerializer,
        responses=serializers.CampaignSerializer,
    )
    def partial_update(self, request, pk=None):
        s = serializers.CampaignUpdateSerializer(data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        campaign = self._get(self.get_queryset())
        _run(services.update_campaign, campaign, by=request.user, **s.validated_data)
        return Response(serializers.CampaignSerializer(self._get(self.get_queryset())).data)

    @extend_schema(
        tags=TAG,
        summary="Archiver une campagne",
        description="Jamais supprimée : archivée avec un motif.",
        request=serializers.AgricultureArchiveSerializer,
        responses=serializers.CampaignSerializer,
    )
    @action(detail=True, methods=["post"])
    def archive(self, request, pk=None):
        s = serializers.AgricultureArchiveSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        campaign = self._get(self.get_queryset())
        _run(services.archive, campaign, by=request.user, reason=s.validated_data["reason"])
        return Response(serializers.CampaignSerializer(self._get(self.get_queryset())).data)


# ── Cycles ───────────────────────────────────────────────────────────────

CYCLE_FILTERS = [
    OpenApiParameter("campaign", str, description="UUID de campagne."),
    OpenApiParameter("crop", str, description="Code de culture (confirmée, sinon déclarée)."),
    OpenApiParameter("parcel", str, description="UUID de parcelle."),
    OpenApiParameter("status", str, description="planned, in_progress, harvested, abandoned"),
    OpenApiParameter("operator", str, description="UUID du producteur exploitant."),
    OpenApiParameter("archived", bool, description="Inclure les cycles archivés."),
]


def _harvest_total():
    return Coalesce(
        Subquery(
            HarvestRecord.objects.filter(crop_cycle=OuterRef("pk"), is_archived=False)
            .values("crop_cycle")
            .annotate(total=Sum("quantity_kg"))
            .values("total")[:1]
        ),
        None,
        output_field=DecimalField(max_digits=14, decimal_places=2),
    )


def filter_by_crop(queryset, code: str):
    """Culture retenue : confirmée si elle existe, sinon déclarée."""
    return queryset.filter(
        Q(confirmed_crop__code=code) | Q(confirmed_crop__isnull=True, declared_crop__code=code)
    )


@extend_schema_view(
    list=extend_schema(
        tags=TAG,
        summary="Cycles de culture de l'espace",
        parameters=CYCLE_FILTERS,
        description="Permission : `crop_cycles.view` ou `personal.crop_cycles.manage`.",
        responses=serializers.CropCycleSerializer(many=True),
    ),
    retrieve=extend_schema(
        tags=TAG,
        summary="Cycle de culture",
        description="Avec opérations, récoltes et chevauchements signalés (D-17).",
        responses=serializers.CropCycleDetailSerializer,
    ),
)
class CropCycleViewSet(
    SpaceViewSetMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = serializers.CropCycleSerializer
    http_method_names = ["get", "post", "patch", "head", "options"]
    ORG_PERMISSIONS = {
        "list": "crop_cycles.view",
        "retrieve": "crop_cycles.view",
        "create": "crop_cycles.manage",
        "partial_update": "crop_cycles.manage",
        "archive": "crop_cycles.manage",
        "operations": "crop_cycles.view",
        "harvests": "crop_cycles.view",
        "confirm_crop": "crop_cycles.confirm",
    }
    # Confirmation de culture : action d'agronome, jamais dans l'espace personnel.
    PERSONAL_PERMISSIONS = {
        k: "personal.crop_cycles.manage" for k in ORG_PERMISSIONS if k != "confirm_crop"
    }

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return CropCycle.objects.none()
        qs = (
            CropCycle.objects.for_workspace(self.workspace)
            .select_related(
                "parcel",
                "cultivation_unit",
                "campaign",
                "operator",
                "declared_crop",
                "confirmed_crop",
                "variety",
            )
            .annotate(total_harvest_kg=_harvest_total())
        )
        if self.action != "list":
            return qs
        params = self.request.query_params
        if params.get("archived") not in ("true", "1"):
            qs = qs.filter(is_archived=False)
        for key, field in (
            ("campaign", "campaign_id"),
            ("parcel", "parcel_id"),
            ("operator", "operator_id"),
        ):
            value = params.get(key)
            if value:
                try:
                    qs = qs.filter(**{field: value})
                except DjangoValidationError as exc:
                    raise ValidationError({key: "Identifiant invalide."}) from exc
        if params.get("status"):
            qs = qs.filter(status=params["status"])
        if params.get("crop"):
            qs = filter_by_crop(qs, params["crop"])
        return qs

    def get_serializer_class(self):
        return (
            serializers.CropCycleDetailSerializer
            if self.action == "retrieve"
            else serializers.CropCycleSerializer
        )

    def _detail(self, code=status.HTTP_200_OK):
        cycle = self._get(self.get_queryset())
        return Response(serializers.CropCycleDetailSerializer(cycle).data, status=code)

    @extend_schema(
        tags=TAG,
        summary="Démarrer un cycle de culture",
        description="Sur une parcelle de l'espace (lien actif, ou accès personnel), éventuellement "
        "une de ses unités, dans une campagne du même espace. L'exploitant par défaut est "
        "l'exploitant principal de la parcelle. Un chevauchement avec un autre cycle est "
        "accepté et signalé dans `overlaps` (D-17).",
        request=serializers.CropCycleCreateSerializer,
        responses={201: serializers.CropCycleDetailSerializer},
    )
    def create(self, request):
        s = serializers.CropCycleCreateSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        data = dict(s.validated_data)
        cycle = _run(
            services.create_crop_cycle,
            workspace=self.workspace,
            by=request.user,
            parcel_id=data.pop("parcel"),
            declared_crop=data.pop("declared_crop"),
            cultivation_unit_id=data.pop("cultivation_unit", None),
            campaign_id=data.pop("campaign", None),
            variety=data.pop("variety", None),
            operator_id=data.pop("operator", None),
            **data,
        )
        self.kwargs["pk"] = cycle.pk
        return self._detail(status.HTTP_201_CREATED)

    @extend_schema(
        tags=TAG,
        summary="Modifier un cycle",
        description="Dates, surface, variété, campagne, statut (planned → in_progress → "
        "harvested ; abandoned tant qu'il n'est pas récolté). La parcelle ne change jamais.",
        request=serializers.CropCycleUpdateSerializer,
        responses=serializers.CropCycleDetailSerializer,
    )
    def partial_update(self, request, pk=None):
        s = serializers.CropCycleUpdateSerializer(data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        data = dict(s.validated_data)
        if "campaign" in data:
            data["campaign_id"] = data.pop("campaign")
        cycle = self._get(self.get_queryset())
        _run(services.update_crop_cycle, cycle, workspace=self.workspace, by=request.user, **data)
        return self._detail()

    @extend_schema(
        tags=TAG,
        summary="Confirmer la culture",
        description="Culture vérifiée par une personne habilitée (`crop_cycles.confirm`, "
        "agronome). La culture déclarée reste conservée.",
        request=serializers.ConfirmCropSerializer,
        responses=serializers.CropCycleDetailSerializer,
    )
    @action(detail=True, methods=["post"], url_path="confirm-crop")
    def confirm_crop(self, request, pk=None):
        s = serializers.ConfirmCropSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        cycle = self._get(self.get_queryset())
        _run(services.confirm_crop, cycle, by=request.user, crop=s.validated_data["crop"])
        return self._detail()

    @extend_schema(
        tags=TAG,
        summary="Archiver un cycle",
        description="Un cycle n'est jamais supprimé (garanti en base).",
        request=serializers.AgricultureArchiveSerializer,
        responses=serializers.CropCycleDetailSerializer,
    )
    @action(detail=True, methods=["post"])
    def archive(self, request, pk=None):
        s = serializers.AgricultureArchiveSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        cycle = self._get(self.get_queryset())
        _run(services.archive, cycle, by=request.user, reason=s.validated_data["reason"])
        return self._detail()

    @extend_schema(
        tags=TAG,
        summary="Opérations d'un cycle",
        description="GET : liste. POST : enregistrer une opération (préparation du sol, semis, "
        "irrigation, fertilisation, traitement…), réalisée ou prévue. POST exige "
        "`crop_cycles.manage`.",
        request=serializers.OperationCreateSerializer,
        responses={
            200: serializers.OperationSerializer(many=True),
            201: serializers.OperationSerializer,
        },
    )
    @action(detail=True, methods=["get", "post"])
    def operations(self, request, pk=None):
        cycle = self._get(self.get_queryset())
        if request.method == "GET":
            items = cycle.operations.filter(is_archived=False)
            return Response(serializers.OperationSerializer(items, many=True).data)
        self._require_manage()
        s = serializers.OperationCreateSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        op = _run(
            services.record_operation,
            cycle,
            workspace=self.workspace,
            by=request.user,
            **s.validated_data,
        )
        return Response(serializers.OperationSerializer(op).data, status=status.HTTP_201_CREATED)

    @extend_schema(
        tags=TAG,
        summary="Récoltes d'un cycle",
        description="GET : liste. POST : enregistrer une récolte (quantité normalisée en kg, "
        "unité d'origine facultative, méthode de mesure). POST exige `crop_cycles.manage`.",
        request=serializers.HarvestCreateSerializer,
        responses={
            200: serializers.HarvestSerializer(many=True),
            201: serializers.HarvestSerializer,
        },
    )
    @action(detail=True, methods=["get", "post"])
    def harvests(self, request, pk=None):
        cycle = self._get(self.get_queryset())
        if request.method == "GET":
            items = cycle.harvests.filter(is_archived=False)
            return Response(serializers.HarvestSerializer(items, many=True).data)
        self._require_manage()
        s = serializers.HarvestCreateSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        harvest = _run(
            services.record_harvest,
            cycle,
            workspace=self.workspace,
            by=request.user,
            **s.validated_data,
        )
        return Response(serializers.HarvestSerializer(harvest).data, status=status.HTTP_201_CREATED)

    def _require_manage(self):
        from rest_framework.exceptions import PermissionDenied

        code = (
            "personal.crop_cycles.manage"
            if self.workspace.kind == PERSONAL
            else "crop_cycles.manage"
        )
        if not self.workspace.has_permission(code):
            raise PermissionDenied("Votre rôle ne permet pas d'enregistrer cette donnée.")
