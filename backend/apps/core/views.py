"""Vue du contexte d'espace (D-01) : ce que le compte peut faire dans l'espace demandé."""

from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.workspace import resolve_workspace


class WorkspaceContextSerializer(serializers.Serializer):
    kind = serializers.ChoiceField(choices=["organization", "personal"])
    organization_id = serializers.UUIDField(allow_null=True)
    producer_id = serializers.UUIDField(
        allow_null=True, help_text="Profil producteur (espace personnel)."
    )
    roles = serializers.ListField(child=serializers.CharField())
    permissions = serializers.ListField(child=serializers.CharField())
    is_platform_access = serializers.BooleanField()


class WorkspaceContextView(APIView):
    """GET /api/v1/workspace/ : contexte vérifié de l'en-tête X-Workspace."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["workspace"],
        summary="Contexte de l'espace",
        description="Vérifie l'en-tête `X-Workspace` et renvoie les rôles et permissions du compte "
        "dans cet espace. Les interfaces s'en servent pour masquer les actions non autorisées ; "
        "le serveur revérifie chaque action. 400 si l'en-tête est absent ou invalide, "
        "403 si l'espace n'est pas accessible.",
        responses=WorkspaceContextSerializer,
    )
    def get(self, request):
        context = resolve_workspace(request)
        return Response(
            {
                "kind": context.kind,
                "organization_id": getattr(context.organization, "pk", None),
                "producer_id": getattr(context.producer, "pk", None),
                "roles": sorted(context.role_codes),
                "permissions": sorted(context.permission_codes),
                "is_platform_access": context.is_platform_access,
            }
        )
