"""Vues du domaine Producteurs.

- /producers/ : registre des producteurs de l'organisation du contexte (X-Workspace org).
  Un producteur non rattaché (lien actif) à cette organisation renvoie 404.
- /me/producer/ : profil producteur du compte connecté (cas B, espace personnel).
"""

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Q
from drf_spectacular.utils import (
    OpenApiParameter,
    OpenApiResponse,
    extend_schema,
    extend_schema_view,
)
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.actors import selectors, services
from apps.actors.models import Producer, RegistrationChannel
from apps.actors.serializers import (
    AttachProducerSerializer,
    DetachProducerSerializer,
    DuplicateResponseSerializer,
    PersonalProfileSerializer,
    ProducerCreateSerializer,
    ProducerSerializer,
    ProducerUpdateSerializer,
)
from apps.core.permissions import WorkspacePermission


def _run(service, **kwargs):
    try:
        return service(**kwargs)
    except DjangoValidationError as exc:
        detail = exc.message_dict if hasattr(exc, "error_dict") else exc.messages
        raise ValidationError(detail) from exc


def _candidate(producer: Producer, organization) -> dict:
    """Doublon probable : informations minimales hors de l'organisation (D-08)."""
    in_org = selectors.active_assignment(producer, organization) is not None
    phone = next(
        (c.value for c in producer.contacts.all() if c.contact_type in ("phone", "whatsapp")), ""
    )
    name = (
        f"{producer.first_name} {producer.last_name}"
        if in_org
        else f"{producer.first_name} {producer.last_name[:1]}.".strip()
    )
    return {
        "id": producer.pk,
        "display_name": name,
        "locality": producer.locality_text,
        "phone_hint": f"•• {phone[-2:]}" if phone else "",
        "in_organization": in_org,
        "can_attach": not in_org
        and not producer.is_archived
        and producer.registration_channel == RegistrationChannel.ORGANIZATION,
    }


@extend_schema_view(
    list=extend_schema(
        tags=["producers"],
        summary="Producteurs de l'organisation",
        description="Producteurs rattachés (lien actif) à l'organisation du contexte. "
        "Recherche `q` sur le nom, la localité, le téléphone ou le numéro d'adhérent. "
        "Permission : `producers.view`.",
        parameters=[
            OpenApiParameter("q", str, description="Texte recherché."),
            OpenApiParameter("status", str, enum=["active", "inactive"]),
        ],
    ),
    retrieve=extend_schema(
        tags=["producers"], summary="Fiche producteur", description="Permission : `producers.view`."
    ),
    create=extend_schema(
        tags=["producers"],
        summary="Enregistrer un producteur",
        description="Crée la fiche (cas A, sans compte) et la rattache à l'organisation. "
        "Si des doublons probables existent (même téléphone, ou même nom dans la même localité), "
        "renvoie **409** avec les candidats : rattacher une fiche existante (`/producers/attach/`) "
        "ou renvoyer la demande avec `confirm_new: true`. Permission : `producers.create`.",
        request=ProducerCreateSerializer,
        responses={
            201: ProducerSerializer,
            409: OpenApiResponse(DuplicateResponseSerializer, description="Doublons probables"),
        },
    ),
    partial_update=extend_schema(
        tags=["producers"],
        summary="Modifier un producteur",
        description="Fiche, téléphone principal et rattachement (type, numéro d'adhérent). "
        "Un producteur qui a son propre compte (inscrit lui-même) ne peut pas être modifié par une "
        "organisation. Permission : `producers.manage`.",
        request=ProducerUpdateSerializer,
        responses=ProducerSerializer,
    ),
    attach=extend_schema(
        tags=["producers"],
        summary="Rattacher une fiche existante",
        description="Rattache à l'organisation un producteur déjà enregistré (doublon signalé). "
        "Impossible pour un producteur inscrit lui-même : son accord sera nécessaire. "
        "Permission : `producers.create`.",
        request=AttachProducerSerializer,
        responses={201: ProducerSerializer},
    ),
    detach=extend_schema(
        tags=["producers"],
        summary="Clore le rattachement",
        description="Le producteur n'est plus suivi par l'organisation "
        "(historique conservé, rien n'est supprimé). "
        "Son rôle producteur éventuel dans l'organisation est retiré. "
        "Permission : `producers.manage`.",
        request=DetachProducerSerializer,
        responses={204: None},
    ),
)
class ProducerViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = ProducerSerializer
    queryset = Producer.objects.none()  # pour la génération du schéma ; voir get_queryset()
    permission_classes = [IsAuthenticated, WorkspacePermission]
    required_permissions = {
        "list": "producers.view",
        "retrieve": "producers.view",
        "create": "producers.create",
        "attach": "producers.create",
        "partial_update": "producers.manage",
        "detach": "producers.manage",
    }
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Producer.objects.none()
        organization = self.request.workspace.organization
        queryset = selectors.visible_producers(organization)
        params = self.request.query_params
        q = (params.get("q") or "").strip()
        if q:
            queryset = queryset.filter(
                Q(first_name__icontains=q)
                | Q(last_name__icontains=q)
                | Q(locality_text__icontains=q)
                | Q(contacts__value__icontains=q.replace(" ", ""))
                | Q(
                    assignments__organization=organization, assignments__membership_number__iexact=q
                )
            ).distinct()
        if params.get("status") in ("active", "inactive"):
            queryset = queryset.filter(status=params["status"])
        return queryset

    def get_serializer_context(self):
        context = super().get_serializer_context()
        workspace = getattr(self.request, "workspace", None)
        context["organization"] = workspace.organization if workspace else None
        return context

    def _fresh(self, producer):
        return self.get_serializer(
            selectors.visible_producers(self.request.workspace.organization).get(pk=producer.pk)
        )

    def create(self, request, *args, **kwargs):
        serializer = ProducerCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = dict(serializer.validated_data)
        organization = request.workspace.organization
        try:
            producer = _run(
                services.register_producer,
                organization=organization,
                registered_by=request.user,
                phone_number=data.pop("phone_number", "") or None,
                relationship_type=data.pop("relationship_type", None),
                membership_number=data.pop("membership_number", None),
                start_date=data.pop("start_date", None),
                confirm_new=data.pop("confirm_new", False),
                **data,
            )
        except services.DuplicateProducerError as exc:
            return Response(
                {
                    "detail": "Ce producteur semble déjà enregistré.",
                    "candidates": [_candidate(p, organization) for p in exc.candidates],
                },
                status=status.HTTP_409_CONFLICT,
            )
        return Response(self._fresh(producer).data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        producer = self.get_object()
        if producer.registration_channel == RegistrationChannel.SELF_SIGNUP:
            raise ValidationError({"producer": "Ce producteur gère lui-même son profil."})
        serializer = ProducerUpdateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        data = dict(serializer.validated_data)
        assignment_fields = {
            k: data.pop(k) for k in ("relationship_type", "membership_number") if k in data
        }
        kwargs = {"phone_number": data.pop("phone_number")} if "phone_number" in data else {}
        _run(services.update_producer, producer=producer, updated_by=request.user, **kwargs, **data)
        if assignment_fields:
            assignment = selectors.active_assignment(producer, request.workspace.organization)
            _run(
                services.update_assignment,
                assignment=assignment,
                updated_by=request.user,
                **assignment_fields,
            )
        return Response(self._fresh(producer).data)

    @action(detail=False, methods=["post"])
    def attach(self, request):
        serializer = AttachProducerSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = dict(serializer.validated_data)
        producer = Producer.objects.filter(pk=data.pop("producer_id")).first()
        if producer is None:
            raise NotFound("Producteur introuvable.")
        _run(
            services.attach_producer,
            producer=producer,
            organization=request.workspace.organization,
            attached_by=request.user,
            **data,
        )
        return Response(self._fresh(producer).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def detach(self, request, pk=None):
        producer = self.get_object()
        serializer = DetachProducerSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        assignment = selectors.active_assignment(producer, request.workspace.organization)
        _run(
            services.end_assignment,
            assignment=assignment,
            ended_by=request.user,
            end_date=serializer.validated_data.get("end_date"),
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema_view(
    get=extend_schema(
        tags=["account"],
        summary="Mon profil producteur",
        description="Profil producteur lié au compte connecté (404 s'il n'existe pas). "
        "Un profil actif ouvre l'espace personnel (`X-Workspace: personal`).",
        responses=PersonalProfileSerializer,
    ),
    post=extend_schema(
        tags=["account"],
        summary="Créer mon profil producteur (indépendant)",
        description="Cas B : le producteur s'inscrit lui-même, sans organisation. "
        "Le profil ouvre l'espace personnel. Un compte n'a qu'un profil producteur.",
        request=PersonalProfileSerializer,
        responses={201: PersonalProfileSerializer},
    ),
)
class MyProducerProfileView(APIView):
    permission_classes = [IsAuthenticated]
    serializer_class = PersonalProfileSerializer

    def get(self, request):
        producer = Producer.objects.filter(user=request.user, is_archived=False).first()
        if producer is None:
            raise NotFound("Aucun profil producteur pour ce compte.")
        return Response(PersonalProfileSerializer(producer).data)

    def post(self, request):
        serializer = PersonalProfileSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        producer = _run(
            services.create_personal_profile, user=request.user, **serializer.validated_data
        )
        return Response(PersonalProfileSerializer(producer).data, status=status.HTTP_201_CREATED)
