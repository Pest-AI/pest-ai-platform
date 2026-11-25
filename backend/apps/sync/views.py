from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.workspace import HEADER, resolve_workspace
from apps.sync import services
from apps.sync.serializers import PushRequestSerializer, PushResponseSerializer

DEVICE_ERRORS = {
    "device_other_user": "Cet appareil est enregistré au nom d'un autre utilisateur.",
    "device_revoked": "Cet appareil a été révoqué (perte, vol) : contactez PEST AI.",
}


class WorkspaceMember(BasePermission):
    """Espace X-Workspace vérifié (adhésion active ou profil personnel) ; aucune permission
    métier ici : chaque opération revérifie la sienne en rejouant la vue en ligne."""

    def has_permission(self, request, view):
        request.workspace = resolve_workspace(request)  # 400 / 403 levés ici
        # L'accès plateforme exceptionnel (super_admin) est en lecture seule.
        return not request.workspace.is_platform_access


class SyncPushView(APIView):
    """Envoi des saisies faites hors ligne (J20)."""

    permission_classes = [IsAuthenticated, WorkspaceMember]

    @extend_schema(
        tags=["sync"],
        summary="Envoyer les saisies hors ligne",
        description=(
            "Lot de 50 opérations au plus, dans l'ordre de l'appareil. Chaque opération est "
            "rejouée par la vue de saisie en ligne (mêmes droits, mêmes contrôles) dans son "
            "propre point de sauvegarde. Idempotent : une opération déjà reçue renvoie "
            "`duplicate` et son résultat d'origine. Une valeur « @op:<uuid> » désigne l'objet"
            " créé par une opération précédente. Une modification sur une version dépassée "
            "devient un conflit (rien n'est écrasé). `pending` : à renvoyer après l'opération"
            " dont elle dépend."
        ),
        request=PushRequestSerializer,
        responses=PushResponseSerializer,
    )
    def post(self, request):
        serializer = PushRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            session, results = services.push(
                user=request.user,
                workspace=request.workspace,
                workspace_header=request.headers.get(HEADER, ""),
                device_info=data["device"],
                operations=[dict(o) for o in data["operations"]],
            )
        except PermissionError as exc:
            raise PermissionDenied(DEVICE_ERRORS.get(str(exc), "Appareil refusé.")) from exc
        return Response(
            {"session": session.pk, "status": session.status, "results": results},
            status=status.HTTP_200_OK,
        )
