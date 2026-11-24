"""API Parcelles (J13, MVP-38) — les deux espaces.

- `X-Workspace: org:<uuid>` : parcelles suivies par l'organisation (lien actif). Écriture
  réservée à l'organisation qui a enregistré la parcelle ; l'accompagnement lit seulement.
- `X-Workspace: personal` : parcelles avec un accès personnel ouvert. Écriture avec un
  accès `manage` (parcelles déclarées par le producteur lui-même).

Une parcelle hors du périmètre de l'espace renvoie **404**, jamais 403 (son existence n'est
pas révélée).
"""

from __future__ import annotations

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Prefetch, Q
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import (
    OpenApiExample,
    OpenApiParameter,
    OpenApiResponse,
    extend_schema,
    extend_schema_view,
)
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.actors.selectors import visible_producers
from apps.core.permissions import WorkspacePermission
from apps.core.workspace import PERSONAL
from apps.organizations.models import Organization
from apps.parcels import agroid as agroid_format
from apps.parcels import geometry as geo
from apps.parcels import selectors, serializers, services
from apps.parcels.models import (
    AccessLevel,
    LinkStatus,
    LinkType,
    Parcel,
    ParcelOperatorAssignment,
    ParcelOrganizationLink,
    ParcelRegistrationChannel,
)

MAP_LIMIT = 1000  # parcelles par réponse de carte ; au-delà, zoomer

POLYGON_EXAMPLE = {
    "type": "Polygon",
    "coordinates": [
        [
            [-14.9600, 16.6500],
            [-14.9591, 16.6500],
            [-14.9591, 16.6509],
            [-14.9600, 16.6509],
            [-14.9600, 16.6500],
        ]
    ],
}

ORG_PERMISSIONS = {
    "list": "parcels.view",
    "summary": "parcels.view",
    "retrieve": "parcels.view",
    "map": "parcels.view",
    "history": "parcels.view",
    "create": "parcels.create",
    "geometries": "parcels.create",
    "partial_update": "parcels.manage",
    "retire": "parcels.manage",
    "owners": "parcels.manage",
    "end_owner": "parcels.manage",
    "operators": "parcels.manage",
    "end_operator": "parcels.manage",
    "units": "parcels.manage",
    "retire_unit": "parcels.manage",
    "link_request": "parcels.manage",
    "review": "parcels.validate_geometry",
    "personal_access": "parcels.grant_personal_access",
    "revoke_personal_access": "parcels.grant_personal_access",
}

PERSONAL_PERMISSIONS = {
    "list": "personal.parcels.view",
    "summary": "personal.parcels.view",
    "retrieve": "personal.parcels.view",
    "map": "personal.parcels.view",
    "history": "personal.parcels.view",
    "create": "personal.parcels.register",
    "geometries": "personal.parcels.manage",
    "partial_update": "personal.parcels.manage",
    "retire": "personal.parcels.manage",
    "owners": "personal.parcels.manage",
    "end_owner": "personal.parcels.manage",
    "operators": "personal.parcels.manage",
    "end_operator": "personal.parcels.manage",
    "units": "personal.parcels.manage",
    "retire_unit": "personal.parcels.manage",
    # review, personal_access, link_request : actions d'organisation uniquement.
}


def _run(service, *args, **kwargs):
    try:
        return service(*args, **kwargs)
    except DjangoValidationError as exc:
        detail = exc.message_dict if hasattr(exc, "error_dict") else exc.messages
        raise ValidationError(detail) from exc


def parse_bbox(raw: str | None):
    """« minLon,minLat,maxLon,maxLat » → Polygon 4326, ou erreur 400 explicite."""
    from django.contrib.gis.geos import Polygon

    if not raw:
        return None
    try:
        min_lon, min_lat, max_lon, max_lat = (float(v) for v in raw.split(","))
    except ValueError as exc:
        raise ValidationError(
            {"bbox": "Format attendu : minLon,minLat,maxLon,maxLat (degrés, WGS 84)."}
        ) from exc
    if not (-180 <= min_lon < max_lon <= 180 and -90 <= min_lat < max_lat <= 90):
        raise ValidationError({"bbox": "Emprise incohérente : min < max, longitude puis latitude."})
    return Polygon.from_bbox((min_lon, min_lat, max_lon, max_lat))


BBOX_PARAM = OpenApiParameter(
    "bbox",
    str,
    description="Emprise de la carte : `minLon,minLat,maxLon,maxLat` (WGS 84). "
    "Ex. `-15.1,16.5,-14.8,16.8`. Garde les parcelles dont le contour courant la touche.",
)
GEOMETRY_ERROR = OpenApiResponse(
    description="Contour refusé (côtés qui se croisent, hors limites, GeoJSON illisible…).",
    examples=[
        OpenApiExample(
            "Contour invalide",
            value={
                "geometry": [
                    "Contour invalide (côtés qui se croisent ou anneau mal fermé) : "
                    "Self-intersection[-14.9595 16.65045]."
                ]
            },
        )
    ],
)


@extend_schema_view(
    list=extend_schema(
        tags=["parcels"],
        summary="Parcelles de l'espace actif",
        description="Organisation : parcelles qu'elle suit (lien actif). Espace personnel : "
        "parcelles auxquelles le producteur a accès. Paginé (50). Pour la carte, "
        "utilisez `/parcels/map/`.",
        parameters=[
            OpenApiParameter("q", str, description="AgroID (saisie tolérée) ou nom local."),
            OpenApiParameter(
                "status", str, enum=["draft", "pending_validation", "active", "retired"]
            ),
            OpenApiParameter("producer", str, description="UUID d'un exploitant en cours."),
            BBOX_PARAM,
        ],
    ),
    retrieve=extend_schema(
        tags=["parcels"],
        summary="Fiche parcelle",
        description="AgroID, contour courant et son contrôle, propriétaires et exploitants en "
        "cours, unités de culture, droits de l'espace actif (`access`).",
    ),
    create=extend_schema(
        tags=["parcels"],
        summary="Enregistrer une parcelle",
        description="Crée la parcelle et lui attribue son AgroID. Le contour (facultatif) devient "
        "la version 1 et est contrôlé (D-19) : un contour suspect est accepté mais signalé, la "
        "parcelle passe alors « en attente de validation ». Organisation : `parcels.create` ; "
        "espace personnel : le producteur déclare sa propre parcelle.",
        request=serializers.ParcelCreateSerializer,
        responses={201: serializers.ParcelDetailSerializer, 400: GEOMETRY_ERROR},
        examples=[
            OpenApiExample(
                "Parcelle relevée au GPS",
                request_only=True,
                value={
                    "local_name": "Champ du fleuve",
                    "geometry": POLYGON_EXAMPLE,
                    "capture_method": "gps_walk",
                    "gps_accuracy_m": 4.5,
                },
            )
        ],
    ),
    partial_update=extend_schema(
        tags=["parcels"],
        summary="Renommer une parcelle",
        description="Seul le nom local se modifie ici ; le contour passe par "
        "`/geometries/` (nouvelle version), les relations par leurs routes dédiées.",
        request=serializers.ParcelUpdateSerializer,
        responses=serializers.ParcelDetailSerializer,
    ),
)
class ParcelViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    queryset = Parcel.objects.none()  # schéma ; voir get_queryset()
    serializer_class = serializers.ParcelDetailSerializer
    permission_classes = [IsAuthenticated, WorkspacePermission]
    http_method_names = ["get", "post", "patch", "head", "options"]

    # ── Contexte ────────────────────────────────────────────────────────

    @property
    def required_permissions(self):
        workspace = getattr(self.request, "workspace", None)
        if workspace is not None and workspace.kind == PERSONAL:
            return PERSONAL_PERMISSIONS
        return ORG_PERMISSIONS

    @property
    def is_personal(self) -> bool:
        return self.request.workspace.kind == PERSONAL

    def _scope(self):
        workspace = self.request.workspace
        if workspace.kind == PERSONAL:
            return selectors.personal_parcels(workspace.producer)
        return selectors.visible_parcels(workspace.organization)

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Parcel.objects.none()
        queryset = self._scope().prefetch_related(
            Prefetch(
                "operators",
                queryset=ParcelOperatorAssignment.objects.select_related("producer"),
            )
        )
        params = self.request.query_params
        q = (params.get("q") or "").strip()
        if q:
            canonical = agroid_format.normalize(q)
            queryset = queryset.filter(
                Q(agroid=canonical) if canonical else Q(local_name__icontains=q)
            )
        if params.get("status") in Parcel.Status.values:
            queryset = queryset.filter(status=params["status"])
        if params.get("producer"):
            queryset = queryset.filter(
                operators__producer_id=params["producer"], operators__end_date__isnull=True
            )
        bbox = parse_bbox(params.get("bbox"))
        if bbox is not None:
            queryset = queryset.filter(
                geometries__is_current=True, geometries__geometry__intersects=bbox
            )
        return queryset.distinct().order_by("-created_at")

    def get_serializer_class(self):
        if self.action == "list":
            return serializers.ParcelListSerializer
        return serializers.ParcelDetailSerializer

    def get_serializer_context(self):
        context = super().get_serializer_context()
        workspace = getattr(self.request, "workspace", None)
        if workspace is None or getattr(self, "swagger_fake_view", False):
            return context
        context["visible_ids"] = {str(pk) for pk in self._scope().values_list("pk", flat=True)}
        if workspace.kind == PERSONAL:
            me = workspace.producer
            # Espace personnel : seulement les relations qui concernent le producteur lui-même
            # (les noms de tiers enregistrés par une organisation ne sortent pas, D-07).
            context["relation_filter"] = lambda r: me.pk in {
                getattr(r, "owner_producer_id", None),
                getattr(r, "producer_id", None),
                r.recorded_by_producer_id,
            }
        return context

    def _access_level(self, parcel) -> str:
        workspace = self.request.workspace
        if workspace.kind == PERSONAL:
            access = selectors.personal_access(workspace.producer, parcel)
            return access.access_level if access else AccessLevel.VIEW
        registering = ParcelOrganizationLink.objects.filter(
            parcel=parcel,
            organization=workspace.organization,
            link_type=LinkType.REGISTERING,
            status=LinkStatus.ACTIVE,
            end_date__isnull=True,
        ).exists()
        can_write = registering and (
            workspace.has_permission("parcels.manage") or workspace.has_permission("parcels.create")
        )
        return AccessLevel.MANAGE if can_write else AccessLevel.VIEW

    def _detail(self, parcel, code=status.HTTP_200_OK):
        parcel = self.get_queryset().get(pk=parcel.pk)
        context = self.get_serializer_context() | {"access_level": self._access_level(parcel)}
        return Response(
            serializers.ParcelDetailSerializer(parcel, context=context).data, status=code
        )

    def _writable(self, parcel):
        """Écriture : lien d'enregistrement de l'organisation, ou accès personnel `manage`."""
        workspace = self.request.workspace
        if workspace.kind == PERSONAL:
            access = selectors.personal_access(workspace.producer, parcel)
            if access is None or access.access_level != AccessLevel.MANAGE:
                raise PermissionDenied("Accès en consultation seulement.")
            return
        if not ParcelOrganizationLink.objects.filter(
            parcel=parcel,
            organization=workspace.organization,
            link_type=LinkType.REGISTERING,
            status=LinkStatus.ACTIVE,
            end_date__isnull=True,
        ).exists():
            raise PermissionDenied(
                "Seule l'organisation qui a enregistré la parcelle la modifie ; "
                "les organisations d'accompagnement la consultent."
            )

    def _recorder(self) -> dict:
        workspace = self.request.workspace
        if workspace.kind == PERSONAL:
            return {"recorded_by_producer": workspace.producer}
        return {"recorded_by_organization": workspace.organization}

    def _producer(self, producer_id):
        """Producteur désigné : visible par l'organisation, ou soi-même dans l'espace personnel."""
        workspace = self.request.workspace
        if workspace.kind == PERSONAL:
            if str(producer_id) != str(workspace.producer.pk):
                raise ValidationError(
                    {"producer": "Dans votre espace, vous ne désignez que vous-même."}
                )
            return workspace.producer
        producer = visible_producers(workspace.organization).filter(pk=producer_id).first()
        if producer is None:
            raise ValidationError({"producer": "Producteur introuvable dans votre organisation."})
        return producer

    # ── Parcelle ────────────────────────────────────────────────────────

    def create(self, request, *args, **kwargs):
        serializer = serializers.ParcelCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        origin = (
            {"producer": request.workspace.producer}
            if self.is_personal
            else {"organization": request.workspace.organization}
        )
        parcel = _run(
            services.create_parcel,
            by=request.user,
            local_name=data.get("local_name", ""),
            geometry=data.get("geometry"),
            capture_method=data["capture_method"],
            gps_accuracy_m=data.get("gps_accuracy_m"),
            captured_at=data.get("captured_at"),
            **origin,
        )
        return self._detail(parcel, status.HTTP_201_CREATED)

    def retrieve(self, request, *args, **kwargs):
        return self._detail(self.get_object())

    def partial_update(self, request, *args, **kwargs):
        parcel = self.get_object()
        self._writable(parcel)
        serializer = serializers.ParcelUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        parcel.local_name = serializer.validated_data["local_name"].strip()
        parcel.updated_by = request.user
        parcel.save(update_fields=["local_name", "updated_by", "updated_at"])
        return self._detail(parcel)

    @extend_schema(
        tags=["parcels"],
        summary="Résumé des parcelles de l'espace",
        description="Indicateurs du tableau de bord : nombre de parcelles (hors retirées), "
        "nombre par statut, surface totale des contours courants (m²), contours à vérifier, "
        "emprise de l'ensemble (`bbox`, pour cadrer la carte) ou null.",
        responses=serializers.ParcelSummarySerializer,
    )
    @action(detail=False, methods=["get"])
    def summary(self, request):
        from django.contrib.gis.db.models import Extent
        from django.db.models import Count, Sum

        scope = self._scope()
        live = Parcel.objects.filter(pk__in=scope.values("pk")).exclude(
            status=Parcel.Status.RETIRED
        )
        by_status = {
            row["status"]: row["n"] for row in scope.values("status").annotate(n=Count("id"))
        }
        totals = live.aggregate(area=Sum("current_area_m2"), extent=Extent("centroid"))
        flagged = (
            selectors.current_geometries(live.values("pk"))
            .filter(validation_status__in=["flagged", "pending"])
            .count()
        )
        extent = totals["extent"]
        return Response(
            {
                "count": live.count(),
                "by_status": by_status,
                "total_area_m2": str(totals["area"] or 0),
                "to_review": flagged,
                "bbox": [round(v, 6) for v in extent] if extent else None,
            }
        )

    @extend_schema(
        tags=["parcels"],
        summary="Parcelles pour la carte (GeoJSON)",
        description="`FeatureCollection` des contours courants dans l'emprise `bbox` "
        f"(obligatoire). Au plus {MAP_LIMIT} parcelles : si `truncated` vaut true, zoomez. "
        "Propriétés : id, agroid, local_name, status, area_m2, validation_status. "
        "Filtres `status` et `producer` comme la liste.",
        parameters=[
            BBOX_PARAM,
            OpenApiParameter("status", str),
            OpenApiParameter("producer", str),
        ],
        responses={
            200: OpenApiResponse(
                OpenApiTypes.OBJECT,
                examples=[
                    OpenApiExample(
                        "FeatureCollection",
                        value={
                            "type": "FeatureCollection",
                            "truncated": False,
                            "features": [
                                {
                                    "type": "Feature",
                                    "id": "3f2a…",
                                    "geometry": {
                                        "type": "MultiPolygon",
                                        "coordinates": [POLYGON_EXAMPLE["coordinates"]],
                                    },
                                    "properties": {
                                        "agroid": "PAI-SN-7K4M9X2Q",
                                        "local_name": "Champ du fleuve",
                                        "status": "active",
                                        "area_m2": "9987.42",
                                        "validation_status": "valid",
                                    },
                                }
                            ],
                        },
                    )
                ],
            )
        },
    )
    @action(detail=False, methods=["get"])
    def map(self, request):
        if not request.query_params.get("bbox"):
            raise ValidationError({"bbox": "Emprise obligatoire pour la carte."})
        parcels = list(self.get_queryset()[: MAP_LIMIT + 1])
        truncated = len(parcels) > MAP_LIMIT
        parcels = parcels[:MAP_LIMIT]
        currents = {g.parcel_id: g for g in selectors.current_geometries([p.pk for p in parcels])}
        features = []
        for parcel in parcels:
            current = currents.get(parcel.pk)
            if current is None:
                continue
            features.append(
                {
                    "type": "Feature",
                    "id": str(parcel.pk),
                    "geometry": geo.to_geojson(current.geometry),
                    "properties": {
                        "agroid": parcel.agroid,
                        "local_name": parcel.local_name,
                        "status": parcel.status,
                        "area_m2": str(current.area_m2),
                        "validation_status": current.validation_status,
                    },
                }
            )
        return Response({"type": "FeatureCollection", "truncated": truncated, "features": features})

    @extend_schema(
        tags=["parcels"],
        summary="Historique de la parcelle",
        description="Toutes les versions du contour (la plus récente d'abord), propriétaires et "
        "exploitants passés et en cours. Rien n'est jamais effacé.",
        responses=serializers.ParcelHistorySerializer,
    )
    @action(detail=True, methods=["get"])
    def history(self, request, pk=None):
        parcel = self.get_object()
        context = self.get_serializer_context()
        keep = context.get("relation_filter") or (lambda r: True)
        owners = [
            o
            for o in parcel.ownerships.select_related(
                "owner_producer", "owner_organization"
            ).order_by("-start_date")
            if keep(o)
        ]
        operators = [
            a
            for a in parcel.operators.select_related("producer").order_by("-start_date")
            if keep(a)
        ]
        return Response(
            {
                "geometries": serializers.GeometryVersionSerializer(
                    selectors.geometry_history(parcel), many=True, context=context
                ).data,
                "owners": serializers.OwnershipSerializer(owners, many=True).data,
                "operators": serializers.OperatorSerializer(operators, many=True).data,
            }
        )

    @extend_schema(
        tags=["parcels"],
        summary="Nouveau contour",
        description="Enregistre une nouvelle version du contour (l'ancienne est conservée) et la "
        "contrôle (D-19). Organisation : `parcels.create` "
        "(l'agent terrain peut relever à nouveau).",
        request=serializers.NewGeometrySerializer,
        responses={201: serializers.ParcelDetailSerializer, 400: GEOMETRY_ERROR},
        examples=[
            OpenApiExample(
                "Contour relevé au GPS",
                request_only=True,
                value={
                    "geometry": POLYGON_EXAMPLE,
                    "capture_method": "gps_walk",
                    "gps_accuracy_m": 3,
                },
            )
        ],
    )
    @action(detail=True, methods=["post"])
    def geometries(self, request, pk=None):
        parcel = self.get_object()
        self._writable(parcel)
        serializer = serializers.NewGeometrySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        _run(
            services.add_geometry,
            parcel,
            data["geometry"],
            by=request.user,
            capture_method=data["capture_method"],
            gps_accuracy_m=data.get("gps_accuracy_m"),
            captured_at=data.get("captured_at"),
        )
        return self._detail(parcel, status.HTTP_201_CREATED)

    @extend_schema(
        tags=["parcels"],
        summary="Trancher un contour signalé",
        parameters=[OpenApiParameter("geometry_id", OpenApiTypes.UUID, OpenApiParameter.PATH)],
        description="Confirme (`valid`) ou refuse (`rejected`, motif obligatoire) un contour "
        "signalé. Permission : `parcels.validate_geometry`. Toute organisation qui suit la "
        "parcelle peut trancher ; la décision est inscrite dans le rapport du contour.",
        request=serializers.ReviewSerializer,
        responses=serializers.ParcelDetailSerializer,
    )
    @action(detail=True, methods=["post"], url_path=r"geometries/(?P<geometry_id>[^/.]+)/review")
    def review(self, request, pk=None, geometry_id=None):
        parcel = self.get_object()
        version = parcel.geometries.filter(pk=geometry_id).first()
        if version is None:
            raise NotFound("Contour introuvable.")
        serializer = serializers.ReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        _run(
            services.review_geometry,
            version,
            decision=serializer.validated_data["decision"],
            by=request.user,
            note=serializer.validated_data.get("note", ""),
        )
        return self._detail(parcel)

    @extend_schema(
        tags=["parcels"],
        summary="Retirer une parcelle",
        description="Parcelle disparue ou fusionnée : statut `retired`, archivée ; "
        "son AgroID reste réservé à vie. Motif obligatoire.",
        request=serializers.ReasonSerializer,
        responses=serializers.ParcelDetailSerializer,
    )
    @action(detail=True, methods=["post"])
    def retire(self, request, pk=None):
        parcel = self.get_object()
        self._writable(parcel)
        serializer = serializers.ReasonSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        _run(
            services.retire_parcel,
            parcel,
            by=request.user,
            reason=serializer.validated_data["reason"],
        )
        return self._detail(parcel)

    # ── Propriété et exploitation ───────────────────────────────────────

    @extend_schema(
        tags=["parcels"],
        summary="Ajouter un propriétaire",
        description="Exactement un propriétaire : `owner_producer`, `owner_organization` ou "
        "`owner_name` (propriétaire non enregistré, D-07). Un changement de propriétaire = clore "
        "l'ancien (`/owners/{id}/end/`) puis en ajouter un nouveau. Dans l'espace personnel, la "
        "déclaration reste « déclarée ». N'ouvre aucun accès à la parcelle.",
        request=serializers.OwnershipCreateSerializer,
        responses={201: serializers.OwnershipSerializer},
    )
    @action(detail=True, methods=["post"])
    def owners(self, request, pk=None):
        parcel = self.get_object()
        self._writable(parcel)
        serializer = serializers.OwnershipCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = dict(serializer.validated_data)
        owner_producer_id = data.pop("owner_producer", None)
        owner_producer = self._producer(owner_producer_id) if owner_producer_id else None
        owner_org_id = data.pop("owner_organization", None)
        owner_organization = None
        if owner_org_id:
            owner_organization = Organization.objects.filter(pk=owner_org_id).first()
            if owner_organization is None:
                raise ValidationError({"owner_organization": "Organisation introuvable."})
        if self.is_personal:
            data["verification_status"] = "declared"
        ownership = _run(
            services.record_ownership,
            parcel,
            by=request.user,
            owner_producer=owner_producer,
            owner_organization=owner_organization,
            **data,
            **self._recorder(),
        )
        return Response(
            serializers.OwnershipSerializer(ownership).data, status=status.HTTP_201_CREATED
        )

    @extend_schema(
        tags=["parcels"],
        summary="Clore une propriété",
        parameters=[OpenApiParameter("owner_id", OpenApiTypes.UUID, OpenApiParameter.PATH)],
        request=serializers.EndRelationSerializer,
        responses=serializers.OwnershipSerializer,
    )
    @action(detail=True, methods=["post"], url_path=r"owners/(?P<owner_id>[^/.]+)/end")
    def end_owner(self, request, pk=None, owner_id=None):
        parcel = self.get_object()
        self._writable(parcel)
        ownership = parcel.ownerships.filter(pk=owner_id).first()
        if ownership is None:
            raise NotFound("Propriété introuvable.")
        serializer = serializers.EndRelationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        _run(
            services.end_ownership,
            ownership,
            end_date=serializer.validated_data["end_date"],
            by=request.user,
        )
        return Response(serializers.OwnershipSerializer(ownership).data)

    @extend_schema(
        tags=["parcels"],
        summary="Désigner un exploitant",
        description="Un seul exploitant principal à la fois (D-06) : `replace_primary: true` clôt "
        "le principal en cours à `start_date`. Organisation : le producteur doit être rattaché à "
        "l'organisation ; espace personnel : le producteur se désigne lui-même. N'ouvre aucun "
        "accès à la parcelle.",
        request=serializers.OperatorCreateSerializer,
        responses={201: serializers.OperatorSerializer},
    )
    @action(detail=True, methods=["post"])
    def operators(self, request, pk=None):
        parcel = self.get_object()
        self._writable(parcel)
        serializer = serializers.OperatorCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        assignment = _run(
            services.assign_operator,
            parcel,
            self._producer(data["producer"]),
            by=request.user,
            role=data["operator_role"],
            start_date=data["start_date"],
            arrangement_type=data["arrangement_type"],
            replace_primary=data["replace_primary"],
            **self._recorder(),
        )
        return Response(
            serializers.OperatorSerializer(assignment).data, status=status.HTTP_201_CREATED
        )

    @extend_schema(
        tags=["parcels"],
        summary="Clore une exploitation",
        parameters=[OpenApiParameter("operator_id", OpenApiTypes.UUID, OpenApiParameter.PATH)],
        request=serializers.EndRelationSerializer,
        responses=serializers.OperatorSerializer,
    )
    @action(detail=True, methods=["post"], url_path=r"operators/(?P<operator_id>[^/.]+)/end")
    def end_operator(self, request, pk=None, operator_id=None):
        parcel = self.get_object()
        self._writable(parcel)
        assignment = parcel.operators.filter(pk=operator_id).first()
        if assignment is None:
            raise NotFound("Exploitation introuvable.")
        serializer = serializers.EndRelationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        _run(
            services.end_operator,
            assignment,
            end_date=serializer.validated_data["end_date"],
            by=request.user,
        )
        return Response(serializers.OperatorSerializer(assignment).data)

    # ── Unités de culture ───────────────────────────────────────────────

    @extend_schema(
        tags=["parcels"],
        summary="Ajouter une unité de culture",
        description="Code unique dans la parcelle (U1, U2…), surface facultative (D-16).",
        request=serializers.UnitCreateSerializer,
        responses={201: serializers.CultivationUnitSerializer},
    )
    @action(detail=True, methods=["post"])
    def units(self, request, pk=None):
        parcel = self.get_object()
        self._writable(parcel)
        serializer = serializers.UnitCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        unit = _run(
            services.create_cultivation_unit, parcel, by=request.user, **serializer.validated_data
        )
        return Response(
            serializers.CultivationUnitSerializer(unit).data, status=status.HTTP_201_CREATED
        )

    @extend_schema(
        tags=["parcels"],
        summary="Retirer une unité de culture",
        parameters=[OpenApiParameter("unit_id", OpenApiTypes.UUID, OpenApiParameter.PATH)],
        request=serializers.ReasonSerializer,
        responses=serializers.CultivationUnitSerializer,
    )
    @action(detail=True, methods=["post"], url_path=r"units/(?P<unit_id>[^/.]+)/retire")
    def retire_unit(self, request, pk=None, unit_id=None):
        parcel = self.get_object()
        self._writable(parcel)
        unit = parcel.units.filter(pk=unit_id).first()
        if unit is None:
            raise NotFound("Unité introuvable.")
        serializer = serializers.ReasonSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        _run(
            services.retire_cultivation_unit,
            unit,
            by=request.user,
            reason=serializer.validated_data["reason"],
        )
        return Response(serializers.CultivationUnitSerializer(unit).data)

    # ── Liens et accès personnels (organisation uniquement) ─────────────

    @extend_schema(
        tags=["parcels"],
        summary="Demander à suivre une parcelle (par son AgroID)",
        description="Le producteur communique l'AgroID de sa parcelle. Parcelle déclarée par "
        "un producteur : la demande attend son accord (D-03) et ne donne aucun accès d'ici là ; "
        "parcelle d'une autre organisation : suivi d'accompagnement immédiat. La réponse ne "
        "révèle rien d'autre de la parcelle. AgroID inconnu : 404.",
        request=serializers.LinkRequestSerializer,
        responses={201: serializers.LinkRequestStatusSerializer},
    )
    @action(detail=False, methods=["post"], url_path="link-requests")
    def link_request(self, request):
        serializer = serializers.LinkRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        parcel = selectors.by_agroid(serializer.validated_data["agroid"])
        if parcel is None or parcel.status == Parcel.Status.RETIRED:
            raise NotFound("Aucune parcelle active avec cet AgroID.")
        link = _run(
            services.request_organization_link,
            parcel,
            request.workspace.organization,
            by=request.user,
        )
        return Response(
            {
                "id": link.pk,
                "agroid": parcel.agroid,
                "status": link.status,
                "start_date": link.start_date,
            },
            status=status.HTTP_201_CREATED,
        )

    @extend_schema(
        tags=["parcels"],
        summary="Ouvrir l'accès personnel à un producteur",
        description="Le producteur (rattaché à l'organisation, avec un compte) voit la parcelle "
        "dans son espace personnel, en consultation (D-02). Permission : "
        "`parcels.grant_personal_access` (administrateur, gérant).",
        request=serializers.PersonalAccessSerializer,
        responses={201: OpenApiTypes.OBJECT},
    )
    @action(detail=True, methods=["post"], url_path="personal-access")
    def personal_access(self, request, pk=None):
        parcel = self.get_object()
        serializer = serializers.PersonalAccessSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        producer = self._producer(serializer.validated_data["producer"])
        access = _run(
            services.grant_personal_access,
            parcel,
            producer,
            organization=request.workspace.organization,
            by=request.user,
        )
        return Response(
            {"id": access.pk, "producer": producer.pk, "access_level": access.access_level},
            status=status.HTTP_201_CREATED,
        )

    @extend_schema(
        tags=["parcels"],
        summary="Retirer l'accès personnel",
        parameters=[OpenApiParameter("access_id", OpenApiTypes.UUID, OpenApiParameter.PATH)],
        description="Seuls les accès accordés par l'organisation de l'espace actif.",
        request=serializers.ReasonSerializer,
        responses={204: None},
    )
    @action(
        detail=True,
        methods=["post"],
        url_path=r"personal-access/(?P<access_id>[^/.]+)/revoke",
    )
    def revoke_personal_access(self, request, pk=None, access_id=None):
        parcel = self.get_object()
        access = parcel.personal_accesses.filter(
            pk=access_id, granted_by_organization=request.workspace.organization
        ).first()
        if access is None:
            raise NotFound("Accès introuvable.")
        serializer = serializers.ReasonSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        _run(
            services.revoke_personal_access,
            access,
            by=request.user,
            reason=serializer.validated_data["reason"],
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


class MyParcelLinkRequestsView(APIView):
    """Espace personnel : demandes de suivi en attente sur mes parcelles (D-03)."""

    permission_classes = [IsAuthenticated, WorkspacePermission]
    required_permissions = {"GET": "personal.parcels.consent_link"}

    @extend_schema(
        tags=["parcels"],
        summary="Demandes de suivi en attente",
        description="Organisations qui demandent à suivre une de vos parcelles. Espace "
        "`personal` uniquement. Tant que vous n'avez pas accepté, elles ne voient rien.",
        responses=serializers.PendingLinkSerializer(many=True),
    )
    def get(self, request):
        links = selectors.pending_link_requests(request.workspace.producer)
        return Response(
            [
                {
                    "id": link.pk,
                    "organization": link.organization.name,
                    "parcel_id": link.parcel_id,
                    "agroid": link.parcel.agroid,
                    "local_name": link.parcel.local_name,
                    "requested_at": link.start_date,
                }
                for link in links
            ]
        )


class MyParcelLinkDecisionView(APIView):
    """Espace personnel : accepter ou refuser une demande de suivi."""

    permission_classes = [IsAuthenticated, WorkspacePermission]
    required_permissions = {"POST": "personal.parcels.consent_link"}
    decision = "accept"

    @extend_schema(
        tags=["parcels"],
        summary="Répondre à une demande de suivi",
        description="`accept` : l'organisation voit la parcelle (rien de votre espace personnel "
        "ne lui est transmis). `decline` : la demande est close, aucun accès.",
        request=None,
        responses={200: serializers.LinkRequestStatusSerializer},
    )
    def post(self, request, link_id):
        link = (
            ParcelOrganizationLink.objects.select_related("parcel")
            .filter(
                pk=link_id,
                parcel__registered_by_producer=request.workspace.producer,
                parcel__registration_channel=ParcelRegistrationChannel.PRODUCER_SELF,
            )
            .first()
        )
        if link is None:
            raise NotFound("Demande introuvable.")
        service = (
            services.consent_organization_link
            if self.decision == "accept"
            else services.decline_organization_link
        )
        link = _run(service, link, by=request.user)
        return Response(
            {
                "id": link.pk,
                "agroid": link.parcel.agroid,
                "status": link.status,
                "start_date": link.start_date,
            }
        )
